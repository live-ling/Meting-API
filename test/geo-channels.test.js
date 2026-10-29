/**
 * 多通道归属地 + 日志按 IP 聚合的回归测试。
 *
 * 覆盖：
 * 1. 默认配置：ShowAPI 主通道 + ipwho.is 备用，其余通道关闭；
 * 2. 后台可以调整顺序、禁用主通道、启用其他通道并持久化；
 * 3. 日志查询按 IP 折叠成组，展开详情可以通过 ipExact 只取该 IP 的调用。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-geo-channels-'))
process.env.DATA_DIR = TEST_DATA_DIR

let store
let apiLogger
let geo
let app
let authHeaders

beforeAll(async () => {
    store = (await import('../src/admin/store.js')).default
    apiLogger = (await import('../src/service/api-logger.js')).default
    geo = await import('../src/service/geo.js')
    const { Hono } = await import('hono')
    const { default: adminRoutes } = await import('../src/admin/api.js')
    app = new Hono()
    adminRoutes(app)
    const loginRes = await app.request('/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    const loginBody = await loginRes.json()
    authHeaders = {
        'X-Auth-Username': 'admin',
        'X-Auth-Token': loginBody.data.token,
    }
})

afterAll(() => {
    try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }) } catch {}
})

describe('归属地通道配置', () => {
    it('默认 ShowAPI 主通道 + ipwho.is 备用，其余关闭', () => {
        const config = store.getGeoConfig()
        expect(config.enabled).toBe(true)
        expect(config.providers.showapi.enabled).toBe(true)
        expect(config.providers.ipwhois.enabled).toBe(true)
        expect(config.providers.ipapi.enabled).toBe(false)
        expect(config.providers.ipsb.enabled).toBe(false)
        expect(config.providers.showapi.order).toBeLessThan(config.providers.ipwhois.order)
    })

    it('保存其他通道时不会丢掉旧版 geoApiKey', async () => {
        store.config.geoApiKey = 'legacykey123456'
        delete store.config.geoProviders
        const result = await store.setGeoConfig({
            enabled: true,
            providers: [{ id: 'ipwhois', enabled: true }],
        })
        expect(result.success).toBe(true)
        expect(store.getGeoConfig().providers.showapi.key).toBe('legacykey123456')
        expect(store.config.geoApiKey).toBeUndefined()
    })

    it('可以禁用 ShowAPI、启用 ipapi.co 并调整优先级', async () => {
        const result = await store.setGeoConfig({
            enabled: true,
            providers: [
                { id: 'showapi', enabled: false, clearKey: true },
                { id: 'ipwhois', enabled: true, order: 30 },
                { id: 'ipapi', enabled: true, order: 5 },
            ],
        })
        expect(result.success).toBe(true)
        const config = store.getGeoConfig()
        expect(config.providers.showapi.enabled).toBe(false)
        expect(config.providers.ipapi.enabled).toBe(true)
        expect(config.providers.ipapi.order).toBe(5)
        expect(config.providers.ipwhois.order).toBe(30)
    })

    it('保存后的通道配置写入 config.json，重启不会丢', async () => {
        const raw = JSON.parse(fs.readFileSync(path.join(TEST_DATA_DIR, 'config.json'), 'utf-8'))
        expect(raw.geoProviders.ipapi.enabled).toBe(true)
        expect(raw.geoProviders.showapi.enabled).toBe(false)
    })

    it('GET /admin/geo 返回通道元数据、启用状态和密钥掩码', async () => {
        const res = await app.request('/admin/geo', { headers: authHeaders })
        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.data.enabled).toBe(true)
        expect(Array.isArray(body.data.providers)).toBe(true)
        expect(body.data.providers.map((item) => item.id)).toEqual(['ipapi', 'showapi', 'ipwhois', 'ipsb'])
        const ipapi = body.data.providers.find((item) => item.id === 'ipapi')
        expect(ipapi.enabled).toBe(true)
        expect(ipapi.needsKey).toBe(false)
        expect(ipapi.supportsIPv6).toBe(true)
        const showapi = body.data.providers.find((item) => item.id === 'showapi')
        expect(showapi.enabled).toBe(false)
        expect(showapi.keyPreview).toBe('')
    })

    it('PUT /admin/geo 可一次保存多个通道的启用、顺序和密钥', async () => {
        const res = await app.request('/admin/geo', {
            method: 'PUT',
            headers: { ...authHeaders, 'content-type': 'application/json' },
            body: JSON.stringify({
                enabled: true,
                providers: [
                    { id: 'ipwhois', enabled: true, order: 10 },
                    { id: 'showapi', enabled: true, order: 20, key: '12345678abcd' },
                    { id: 'ipapi', enabled: false },
                ],
            }),
        })
        const body = await res.json()
        expect(body.success).toBe(true)
        const showapi = body.data.providers.find((item) => item.id === 'showapi')
        expect(showapi.enabled).toBe(true)
        expect(showapi.hasKey).toBe(true)
        expect(showapi.keyPreview).toBe('****abcd')
        const ids = body.data.providers.map((item) => item.id)
        expect(ids.indexOf('ipwhois')).toBeLessThan(ids.indexOf('showapi'))
    })
})

describe('API 日志按 IP 聚合', () => {
    it('同一 IP 的多次调用折叠成一组，并按最近调用排序', () => {
        apiLogger.addLog({
            ip: '10.0.0.1', server: 'netease', type: 'url', requestId: '100',
            status: 'success', statusCode: 302, durationMs: 10,
            referer: 'https://blog.example.com/', host: 'api.example.com',
        })
        apiLogger.addLog({
            ip: '10.0.0.1', server: 'netease', type: 'lrc', requestId: '101',
            status: 'success', statusCode: 200, durationMs: 30,
            referer: 'https://blog.example.com/', host: 'api.example.com',
        })
        apiLogger.addLog({
            ip: '10.0.0.1', server: 'tencent', type: 'url', requestId: '102',
            status: 'error', statusCode: 500, durationMs: 50,
            referer: '', host: 'api.example.com',
        })
        apiLogger.addLog({
            ip: '10.0.0.2', server: 'netease', type: 'search', requestId: '200',
            status: 'success', statusCode: 200, durationMs: 20,
            referer: 'https://other.example.com/', host: 'api.example.com',
        })

        const grouped = apiLogger.getGroupedLogs({ page: 1, pageSize: 10 })
        expect(grouped.grouped).toBe(true)
        expect(grouped.total).toBe(2)
        expect(grouped.totalCalls).toBe(4)

        const first = grouped.items[0]
        const target = grouped.items.find((item) => item.ip === '10.0.0.1')
        expect(first.lastSeen).toBeGreaterThanOrEqual(target.lastSeen)
        expect(target.count).toBe(3)
        expect(target.successCount).toBe(2)
        expect(target.errorCount).toBe(1)
        expect(target.topServer).toBe('netease')
        expect(target.topType).toBe('url')
        expect(target.statusCodes.map((item) => Number(item.code)).sort()).toEqual([200, 302, 500])
        expect(target.topReferer).toBe('blog.example.com')
        expect(target.avgDurationMs).toBe(30)
        expect(['100', '101', '102']).toContain(target.latest.requestId)
    })

    it('GET /admin/api-logs?group=ip 返回分组与展开详情所需字段', async () => {
        const res = await app.request('/admin/api-logs?group=ip&page=1&pageSize=25', { headers: authHeaders })
        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.grouped).toBe(true)
        expect(Array.isArray(body.items)).toBe(true)
        const target = body.items.find((item) => item.ip === '10.0.0.1')
        expect(target).toBeTruthy()
        expect(target.count).toBe(3)
        expect(target.latest).toBeTruthy()
        expect(target.statusCodes.length).toBeGreaterThan(0)
        expect(typeof body.totalCalls).toBe('number')

        const detailRes = await app.request(
            '/admin/api-logs?group=none&ipExact=10.0.0.1&page=1&pageSize=20',
            { headers: authHeaders }
        )
        const detailBody = await detailRes.json()
        expect(detailBody.grouped).toBe(false)
        expect(detailBody.items.every((item) => item.ip === '10.0.0.1')).toBe(true)
    })

    it('ipExact 只返回该 IP 的调用，用于展开详情', () => {
        const detail = apiLogger.getLogs({ ipExact: '10.0.0.1', page: 1, pageSize: 20 })
        expect(detail.grouped).toBe(false)
        expect(detail.total).toBe(3)
        expect(detail.items.every((item) => item.ip === '10.0.0.1')).toBe(true)
        expect(detail.items[0].timestamp).toBeGreaterThanOrEqual(detail.items[1].timestamp)
    })

    it('查询到的归属地会落到日志分组上，并带来源通道', async () => {
        const fetchMock = vi.fn(async (url) => {
            expect(String(url)).toContain('ipwho.is')
            return new Response(JSON.stringify({
                success: true,
                country: 'United States',
                country_code: 'US',
                region: 'California',
                city: 'Mountain View',
                connection: { isp: 'Google LLC' },
            }), { status: 200, headers: { 'content-type': 'application/json' } })
        })
        vi.stubGlobal('fetch', fetchMock)

        const entry = await geo.lookupGeo('8.8.8.8', store.getGeoConfig())
        expect(entry.countryCode).toBe('US')
        apiLogger.addLog({
            ip: '8.8.8.8', server: 'netease', type: 'song', requestId: '300',
            status: 'success', statusCode: 200, durationMs: 12,
            referer: 'https://blog.example.com/', host: 'api.example.com',
        })

        const grouped = apiLogger.getGroupedLogs({ ip: '8.8.8.8', page: 1, pageSize: 10 })
        expect(grouped.items).toHaveLength(1)
        expect(grouped.items[0].geo).toMatchObject({ countryCode: 'US', source: 'ipwhois' })
        expect(grouped.items[0].geoLabel).toContain('United States')
        expect(grouped.items[0].geo.providerLabel).toBe('ipwho.is')
        vi.unstubAllGlobals()
    })

    it('来源统计会带平台/类型/地区/Host 分布和 Top IP', () => {
        const stats = apiLogger.getRefererStats({ hours: 24, limit: 10 })
        const item = stats.items.find(entry => entry.host === 'blog.example.com')
        expect(item).toBeTruthy()
        expect(item.count).toBe(3)
        expect(item.uniqueIPs).toBe(2)
        expect(item.servers[0]).toMatchObject({ name: 'netease', count: 3 })
        expect(item.types.length).toBeGreaterThanOrEqual(2)
        expect(item.hostHeaders[0]).toMatchObject({ name: 'api.example.com', count: 3 })
        expect(item.topIPs.length).toBe(2)
        expect(item.topIPs.some(ip => ip.ip === '8.8.8.8' && ip.geoLabel)).toBe(true)
        expect(item.topIPs.some(ip => ip.ip === '8.8.8.8' && ip.success === 1)).toBe(true)
    })

    it('refererSite 可以只筛出某个来源的调用', () => {
        const result = apiLogger.getLogs({ refererSite: 'blog.example.com', page: 1, pageSize: 50 })
        expect(result.total).toBe(3)
        expect(result.items.every(item => item.referer.includes('blog.example.com'))).toBe(true)
        const direct = apiLogger.getLogs({ refererSite: 'direct', page: 1, pageSize: 50 })
        expect(direct.total).toBe(1)
        expect(direct.items[0].referer).toBe('')
    })

    it('统计与趋势支持近 24 小时 / 7 天 / 30 天范围', () => {
        const stats24 = apiLogger.getStats({ hours: 24 })
        const stats7d = apiLogger.getStats({ hours: 168 })
        expect(stats24.rangeCount).toBe(5)
        expect(stats7d.rangeCount).toBe(5)
        expect(stats24.hours).toBe(24)
        expect(stats7d.hours).toBe(168)
        expect(stats7d.last24h).toBe(5)

        const series24 = apiLogger.getTimeseries({ hours: 24 })
        const series7d = apiLogger.getTimeseries({ hours: 168 })
        const series30d = apiLogger.getTimeseries({ hours: 720 })
        expect(series24).toHaveLength(24)
        expect(series24[0].bucketMs).toBe(60 * 60 * 1000)
        expect(series7d).toHaveLength(28)
        expect(series7d[0].bucketMs).toBe(6 * 60 * 60 * 1000)
        expect(series30d).toHaveLength(30)
        expect(series30d[0].bucketMs).toBe(24 * 60 * 60 * 1000)
        expect(series7d.reduce((sum, item) => sum + item.total, 0)).toBe(5)
    })

    it('仪表盘接口接受 hours=168', async () => {
        const statsRes = await app.request('/admin/api-logs/stats?hours=168', { headers: authHeaders })
        const stats = await statsRes.json()
        expect(stats.success).toBe(true)
        expect(stats.data.hours).toBe(168)
        expect(stats.data.rangeCount).toBe(5)

        const seriesRes = await app.request('/admin/api-logs/timeseries?hours=168', { headers: authHeaders })
        const series = await seriesRes.json()
        expect(series.success).toBe(true)
        expect(series.data).toHaveLength(28)
        expect(series.data[0].bucketMs).toBe(6 * 60 * 60 * 1000)
    })
})

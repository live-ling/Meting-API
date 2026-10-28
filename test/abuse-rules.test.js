/**
 * 滥用检测新增规则测试：search 日配额 + 抓取型 UA 拦截
 *
 * 这两条规则直接作用在 /api 上，必须证明它们：
 *   - 真的能挡住慢速刷接口与搜索引擎抓取；
 *   - 绝不会连带挡掉页面与管理后台（登录页必须永远可达）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-abuse-'))
process.env.DATA_DIR = TEST_DATA_DIR

let app
let store
let abuse

const YISO = 'Mozilla/5.0 (compatible; YisouSpider; +http://www.yisou.com/)'
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0 Safari/537.36'

const hit = (url, { ip = '203.0.113.10', ua = CHROME } = {}) => app.request(url, {
    headers: { 'X-Forwarded-For': ip, 'User-Agent': ua },
})

beforeAll(async () => {
    const { Hono } = await import('hono')
    abuse = await import('../src/middleware/abuse-detector.js')
    store = (await import('../src/admin/store.js')).default

    app = new Hono()
    app.use('*', abuse.abuseDetectorMiddleware)
    // 用一个假的上游，避免测试依赖外网
    app.get('/api', (c) => c.json([{ title: 'ok' }]))
    app.get('/admin', (c) => c.text('admin page'))
    app.get('/admin/login', (c) => c.text('login page'))
    app.get('/', (c) => c.text('home'))
})

describe('search 日配额', () => {
    it('超过每日上限后返回 429 且带 Retry-After', async () => {
        await store.setAbuseConfig({ quota: { enabled: true, searchDailyLimit: 2 } }, 'test')
        const ip = '198.51.100.20'

        const first = await hit('/api?server=netease&type=search&id=jay', { ip })
        const second = await hit('/api?server=netease&type=search&id=jay', { ip })
        expect(first.status).toBe(200)
        expect(second.status).toBe(200)

        const third = await hit('/api?server=netease&type=search&id=jay', { ip })
        expect(third.status).toBe(429)
        const body = await third.json()
        expect(body.message).toContain('配额')
        expect(Number(third.headers.get('Retry-After'))).toBeGreaterThan(0)
    })

    it('配额只作用于 search，其他 type 不受影响', async () => {
        const ip = '198.51.100.21'
        for (let i = 0; i < 4; i++) {
            const res = await hit('/api?server=netease&type=song&id=1', { ip })
            expect(res.status).toBe(200)
        }
    })

    it('不同 IP 的配额互相独立', async () => {
        await store.setAbuseConfig({ quota: { enabled: true, searchDailyLimit: 1 } }, 'test')
        expect((await hit('/api?server=netease&type=search&id=a', { ip: '198.51.100.30' })).status).toBe(200)
        expect((await hit('/api?server=netease&type=search&id=a', { ip: '198.51.100.30' })).status).toBe(429)
        expect((await hit('/api?server=netease&type=search&id=a', { ip: '198.51.100.31' })).status).toBe(200)
    })
})

describe('抓取型 UA 拦截', () => {
    it('YisouSpider 访问 /api 返回 403', async () => {
        const res = await hit('/api?server=netease&type=playlist&id=1', { ip: '198.51.100.40', ua: YISO })
        expect(res.status).toBe(403)
        expect((await res.json()).error).toBe('Forbidden')
    })

    it('普通浏览器 UA 不受影响', async () => {
        const res = await hit('/api?server=netease&type=playlist&id=1', { ip: '198.51.100.41' })
        expect(res.status).toBe(200)
    })

    it('同一 UA 访问页面与后台仍然放行', async () => {
        const ip = '198.51.100.42'
        expect((await hit('/', { ip, ua: YISO })).status).toBe(200)
        expect((await hit('/admin', { ip, ua: YISO })).status).toBe(200)
        expect((await hit('/admin/login', { ip, ua: YISO })).status).toBe(200)
    })

    it('规则关闭后不再拦截', async () => {
        await store.setAbuseConfig({ rules: { rapidRequests: true, invalidParams: true, pathEnumeration: true, suspiciousPatterns: true, uaBlock: false } }, 'test')
        const res = await hit('/api?server=netease&type=playlist&id=1', { ip: '198.51.100.43', ua: YISO })
        expect(res.status).toBe(200)
        await store.setAbuseConfig({ rules: { rapidRequests: true, invalidParams: true, pathEnumeration: true, suspiciousPatterns: true, uaBlock: true } }, 'test')
    })
})

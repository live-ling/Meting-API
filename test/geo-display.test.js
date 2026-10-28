/**
 * IP 归属地：ShowAPI 返回字段不能只保留省/市，测试查询要能展示完整信息；
 * 后台「获取我的 IP」优先取 X-Forwarded-For 的第一个地址。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-geo-'))
process.env.DATA_DIR = TEST_DATA_DIR

let geo
let getClientIP
let Hono

const SHOWAPI_BODY = {
    showapi_res_error: '',
    showapi_res_code: 0,
    showapi_res_id: 'test',
    showapi_res_body: {
        region: '湖北',
        remark: '',
        isp: '中国移动',
        en_name: 'China',
        city: '武汉',
        ip: '111.60.83.121',
        country: '中国',
        ret_code: 0,
        county: '洪山',
        continents: '亚洲',
        city_code: '420111',
        lnt: '114.3438',
        lat: '30.4999',
        en_name_short: 'CN',
    },
}

beforeAll(async () => {
    geo = await import('../src/service/geo.js')
    getClientIP = (await import('../src/middleware/abuse-detector.js')).getClientIP
    Hono = (await import('hono')).Hono
})

afterAll(() => {
    vi.unstubAllGlobals()
    try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }) } catch {}
})

describe('ShowAPI 完整字段', () => {
    it('保留省市区、运营商、大洲、编码、经纬度与英文名', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SHOWAPI_BODY), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })))

        const result = await geo.queryShowAPI('111.60.83.121', 'test-key')
        expect(result.success).toBe(true)
        expect(result.data).toMatchObject({
            ip: '111.60.83.121',
            country: '中国',
            countryCode: 'CN',
            region: '湖北',
            city: '武汉',
            county: '洪山',
            isp: '中国移动',
            continents: '亚洲',
            cityCode: '420111',
            lat: '30.4999',
            lng: '114.3438',
            enName: 'China',
            enNameShort: 'CN',
        })
    })

    it('非公网 IP 不调用接口', async () => {
        const fn = vi.fn()
        vi.stubGlobal('fetch', fn)
        const result = await geo.queryShowAPI('127.0.0.1', 'test-key')
        expect(result.success).toBe(false)
        expect(fn).not.toHaveBeenCalled()
    })

    it('IPv6 自动走 ipwho.is 备用接口', async () => {
        const fn = vi.fn(async (url) => {
            expect(String(url)).toContain('ipwho.is')
            return new Response(JSON.stringify({
                success: true,
                ip: '2001:4860:4860::8888',
                continent: 'North America',
                country: 'United States',
                country_code: 'US',
                region: 'California',
                city: 'Mountain View',
                latitude: 37.386051,
                longitude: -122.083847,
                connection: { asn: 15169, org: 'Google LLC', isp: 'Google LLC' },
            }), { status: 200, headers: { 'content-type': 'application/json' } })
        })
        vi.stubGlobal('fetch', fn)

        const result = await geo.queryShowAPI('2001:4860:4860::8888', '')
        expect(result.success).toBe(true)
        expect(result.data).toMatchObject({
            country: 'United States',
            countryCode: 'US',
            region: 'California',
            city: 'Mountain View',
            continents: 'North America',
            isp: 'Google LLC',
            lat: '37.386051',
            lng: '-122.083847',
            source: 'ipwhois',
        })
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('IPv4 的 ShowAPI 失败时回退 ipwho.is', async () => {
        const fn = vi.fn(async (url) => {
            if (String(url).includes('showapi.com')) {
                return new Response(JSON.stringify({
                    showapi_res_code: 0,
                    showapi_res_body: { ip: '8.8.8.8', ret_code: -1, remark: 'ip格式不正确!' },
                }), { status: 200, headers: { 'content-type': 'application/json' } })
            }
            return new Response(JSON.stringify({
                success: true,
                country: 'United States',
                country_code: 'US',
                region: 'California',
                city: 'Mountain View',
                connection: { isp: 'Google LLC' },
            }), { status: 200, headers: { 'content-type': 'application/json' } })
        })
        vi.stubGlobal('fetch', fn)

        const result = await geo.queryShowAPI('8.8.8.8', 'test-key')
        expect(result.success).toBe(true)
        expect(result.data.source).toBe('ipwhois')
        expect(fn).toHaveBeenCalledTimes(2)
    })
})

describe('获取客户端 IP', () => {
    it('优先取 X-Forwarded-For 的第一个地址', async () => {
        const app = new Hono()
        app.get('/ip', (c) => c.text(getClientIP(c)))
        const res = await app.request('/ip', {
            headers: { 'X-Forwarded-For': '203.0.113.9, 10.0.0.1, 10.0.0.2' },
        })
        expect(await res.text()).toBe('203.0.113.9')
    })

    it('没有 XFF 时回退 X-Real-IP', async () => {
        const app = new Hono()
        app.get('/ip', (c) => c.text(getClientIP(c)))
        const res = await app.request('/ip', { headers: { 'X-Real-IP': '198.51.100.7' } })
        expect(await res.text()).toBe('198.51.100.7')
    })
})

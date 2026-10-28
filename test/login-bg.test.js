/**
 * 登录页背景图：配置校验 + 服务端缓存 + 同源图片路由。
 *
 * 重点回归「刷新登录页会换图」这个问题：同一进程内反复请求必须命中缓存，
 * 只有显式 refresh / 换接口 / 缓存过期才会重新抓取。fetch 全部打桩，不碰外网。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-login-bg-'))
process.env.DATA_DIR = TEST_DATA_DIR

const OLD_IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0x04, 0x05])
const NEW_IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17])

let app
let store
let service

const stubImageFetch = (bytes) => {
    const calls = []
    const fn = vi.fn(async (url) => {
        calls.push(String(url))
        return new Response(bytes, {
            status: 200,
            headers: { 'content-type': 'image/jpeg', 'content-length': String(bytes.length) },
        })
    })
    vi.stubGlobal('fetch', fn)
    return { fn, calls }
}

const adminAuthHeaders = async () => {
    const res = await app.request('/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    const body = await res.json()
    expect(body.success).toBe(true)
    return {
        'X-Auth-Username': 'admin',
        'X-Auth-Token': body.data.token,
    }
}

beforeAll(async () => {
    store = (await import('../src/admin/store.js')).default
    service = await import('../src/admin/login-bg.js')
    const { default: adminRoutes } = await import('../src/admin/api.js')
    const { Hono } = await import('hono')

    app = new Hono()
    adminRoutes(app)
    // 与 app.js 相同的注册顺序：图片路由在后台页面兜底之前
    app.get('/admin/login-bg', service.loginBgHandler)
})

afterAll(() => {
    vi.unstubAllGlobals()
    try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }) } catch {}
})

describe('登录页背景图配置', () => {
    it('默认启用，使用 uapis 的 ACG 接口并缓存 6 小时', () => {
        const cfg = store.getLoginBgConfig()
        expect(cfg.enabled).toBe(true)
        expect(cfg.apiUrl).toBe('https://uapis.cn/api/v1/random/image?category=acg')
        expect(cfg.ttlHours).toBe(6)
    })

    it('拒绝内网 / 非 http 的图片接口', async () => {
        expect((await store.setLoginBgConfig({ apiUrl: 'http://127.0.0.1/a.jpg' })).success).toBe(false)
        expect((await store.setLoginBgConfig({ apiUrl: 'file:///tmp/a.jpg' })).success).toBe(false)
        expect((await store.setLoginBgConfig({ apiUrl: 'https://uapis.cn/api/v1/random/image?category=acg' })).success).toBe(true)
    })

    it('拒绝越界的缓存有效期', async () => {
        expect((await store.setLoginBgConfig({ ttlHours: 0 })).success).toBe(false)
        expect((await store.setLoginBgConfig({ ttlHours: 169 })).success).toBe(false)
        expect((await store.setLoginBgConfig({ ttlHours: 2.5 })).success).toBe(false)
        expect((await store.setLoginBgConfig({ ttlHours: 12 })).success).toBe(true)
        expect(store.getLoginBgConfig().ttlHours).toBe(12)
    })
})

describe('同源背景图缓存', () => {
    it('第一次请求抓取并落盘，第二次直接命中缓存', async () => {
        service.clearLoginBgCache()
        await store.setLoginBgConfig({ enabled: true, ttlHours: 6 })
        const { fn } = stubImageFetch(OLD_IMAGE)

        const first = await app.request('/admin/login-bg')
        expect(first.status).toBe(200)
        expect(first.headers.get('content-type')).toContain('image/jpeg')
        expect(first.headers.get('x-login-bg')).toBe('MISS')
        expect(new Uint8Array(await first.arrayBuffer())).toEqual(OLD_IMAGE)
        expect(fn).toHaveBeenCalledTimes(1)

        const second = await app.request('/admin/login-bg')
        expect(second.status).toBe(200)
        expect(second.headers.get('x-login-bg')).toBe('HIT')
        expect(fn).toHaveBeenCalledTimes(1)
        expect(new Uint8Array(await second.arrayBuffer())).toEqual(OLD_IMAGE)

        // 磁盘缓存：重启后也能恢复
        expect(fs.existsSync(path.join(TEST_DATA_DIR, 'login-bg', 'image.bin'))).toBe(true)
        const meta = JSON.parse(fs.readFileSync(path.join(TEST_DATA_DIR, 'login-bg', 'meta.json'), 'utf-8'))
        expect(meta.apiUrl).toContain('uapis.cn')
        expect(meta.size).toBe(OLD_IMAGE.length)
    })

    it('带 If-None-Match 时返回 304，不重复传图', async () => {
        const first = await app.request('/admin/login-bg')
        const etag = first.headers.get('etag')
        expect(etag).toBeTruthy()

        const revalidated = await app.request('/admin/login-bg', {
            headers: { 'If-None-Match': etag },
        })
        expect(revalidated.status).toBe(304)
        expect(await revalidated.text()).toBe('')
    })

    it('显式刷新才换图；设置接口返回缓存状态', async () => {
        const auth = await adminAuthHeaders()

        const settings = await app.request('/admin/login-bg/settings', { headers: auth })
        const settingsBody = await settings.json()
        expect(settingsBody.success).toBe(true)
        expect(settingsBody.data.cache.size).toBe(OLD_IMAGE.length)

        stubImageFetch(NEW_IMAGE)
        const refreshed = await app.request('/admin/login-bg/refresh', { method: 'POST', headers: auth })
        const refreshedBody = await refreshed.json()
        expect(refreshedBody.success).toBe(true)
        expect(refreshedBody.data.cache.size).toBe(NEW_IMAGE.length)

        const image = await app.request('/admin/login-bg')
        expect(image.headers.get('x-login-bg')).toBe('HIT')
        expect(new Uint8Array(await image.arrayBuffer())).toEqual(NEW_IMAGE)
    })

    it('缓存过期后抓取失败时保留旧图并给出警告', async () => {
        const auth = await adminAuthHeaders()
        const realNow = Date.now()

        // 把时间推到 TTL 之后，让 ensureImage 认为缓存已过期
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(realNow + 7 * 60 * 60 * 1000)
        try {
            vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

            const refreshed = await app.request('/admin/login-bg/refresh', { method: 'POST', headers: auth })
            const body = await refreshed.json()
            expect(body.success).toBe(true)
            expect(body.warning).toContain('network down')

            const image = await app.request('/admin/login-bg')
            expect(image.headers.get('x-login-bg')).toBe('STALE')
            expect(new Uint8Array(await image.arrayBuffer())).toEqual(NEW_IMAGE)
        } finally {
            vi.useRealTimers()
        }
    })

    it('完全无缓存且抓取失败时返回 502，不返回半张图', async () => {
        service.clearLoginBgCache()
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

        const image = await app.request('/admin/login-bg')
        expect(image.status).toBe(502)
        expect(image.headers.get('x-login-bg')).toBe('ERROR')
    })

    it('关闭后图片路由返回 404，不再打接口', async () => {
        await store.setLoginBgConfig({ enabled: false })
        const { fn } = stubImageFetch(OLD_IMAGE)

        const image = await app.request('/admin/login-bg')
        expect(image.status).toBe(404)
        expect(fn).not.toHaveBeenCalled()

        await store.setLoginBgConfig({ enabled: true })
    })
})

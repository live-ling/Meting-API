/**
 * 网易云扫码登录单测
 *
 * 覆盖：
 *   1. Set-Cookie 筛选与合并（白名单、顺序、幂等）
 *   2. 会话状态机 801 -> 802 -> 803
 *   3. 803 后入库、同账号去重、失败不留脏数据
 *   4. 过期、越权（别人拿到 sessionId 也用不了）、取消、单飞
 *   5. 轮询复用同一客户端身份（_ntes_nuid + NMTID），且不伪造 IP
 *   6. 8821 风控码明确失败、803 凭据在 body.cookie 的兜底
 *
 * 网络与 store 全部注入假实现，不碰真实网易云，也不写真实 data/。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pairsFromSetCookie, mergeCookiePairs, isSameCookie } from '../src/admin/netease-cookie.js'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-qr-'))
process.env.DATA_DIR = TEST_DATA_DIR

let createQrLoginManager
let QrLoginError

const SET_COOKIE_803 = [
    'MUSIC_U=v2_abcdef; Max-Age=1296000; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/; HttpOnly',
    '__csrf=csrf123; Max-Age=1296000; Path=/',
    'NMTID=nm456; Path=/',
    '_ntes_nuid=should_be_dropped; Path=/',
]

const makeStore = (existing = []) => ({
    getCookies: vi.fn(() => existing),
    addCookie: vi.fn(async (platform, cookie) => {
        expect(platform).toBe('netease')
        return { success: true, data: { id: 'new-cookie' } }
    }),
    updateCookie: vi.fn(async () => ({ success: true })),
})

const makeRequest = (steps) => {
    let index = 0
    return vi.fn(async () => steps[Math.min(index++, steps.length - 1)])
}

const okValidate = vi.fn(async () => ({
    valid: true,
    error: null,
    userInfo: { userId: 42, nickname: '测试用户', canPlayVip: true },
}))

const build = (overrides = {}) => createQrLoginManager({
    request: makeRequest([
        { data: { code: 200, unikey: 'unikey-abc' } },
        { data: { code: 801, message: '等待扫码' } },
        { data: { code: 802, message: '扫描成功，等待确认' } },
        { data: { code: 803, message: '授权登陆成功' }, setCookie: SET_COOKIE_803 },
    ]),
    validate: okValidate,
    store: makeStore(),
    pickIp: () => '58.14.0.0',
    qrEncode: async (text) => 'data:image/png;base64,FAKE:' + text.length,
    ...overrides,
})

beforeAll(async () => {
    const mod = await import('../src/admin/netease-qr.js')
    createQrLoginManager = mod.createQrLoginManager
    QrLoginError = mod.QrLoginError
})

describe('Set-Cookie 筛选与合并', () => {
    it('只保留白名单字段，丢掉属性与跟踪字段', () => {
        const pairs = pairsFromSetCookie(SET_COOKIE_803)
        expect(pairs).toEqual({
            MUSIC_U: 'v2_abcdef',
            __csrf: 'csrf123',
            NMTID: 'nm456',
        })
        expect(pairs._ntes_nuid).toBeUndefined()
    })

    it('合并时保留旧字段，新值覆盖同名旧值', () => {
        const merged = mergeCookiePairs('MUSIC_U=old; __csrf=oldcsrf; os=pc', { MUSIC_U: 'new' })
        expect(merged).toBe('MUSIC_U=new; __csrf=oldcsrf; os=pc')
        expect(mergeCookiePairs('', { MUSIC_U: 'a', __csrf: 'b' })).toBe('MUSIC_U=a; __csrf=b')
    })

    it('isSameCookie 忽略顺序', () => {
        expect(isSameCookie('a=1; b=2', 'b=2; a=1')).toBe(true)
        expect(isSameCookie('a=1; b=2', 'a=1; b=3')).toBe(false)
    })
})

describe('扫码会话状态机', () => {
    it('create 只返回 sessionId 与图片，不泄露 unikey', async () => {
        const manager = build()
        const view = await manager.create('admin')

        expect(view.status).toBe('waiting')
        expect(view.expiresIn).toBe(180)
        expect(view.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true)
        expect(JSON.stringify(view)).not.toContain('unikey-abc')
        expect(Object.keys(view).sort()).toEqual(['expiresIn', 'qrDataUrl', 'sessionId', 'status'])
    })

    it('建 key 与轮询复用同一 _ntes_nuid，且走新版接口、不伪造 IP', async () => {
        const calls = []
        const request = vi.fn(async (method, url, data, options) => {
            calls.push({ url, data, options })
            return url.includes('unikey')
                ? { data: { code: 200, unikey: 'k' }, setCookie: ['NMTID=nm1; Path=/'] }
                : { data: { code: 801 } }
        })
        const manager = build({ request })
        const { sessionId } = await manager.create('admin')
        await manager.check(sessionId, 'admin')

        expect(calls).toHaveLength(2)
        expect(calls[0].url).toContain('interface.music.163.com')
        expect(calls[0].data.type).toBe(3)
        expect(calls[0].options.spoofIp).toBe(false)
        expect(calls[1].options.spoofIp).toBe(false)

        const first = calls[0].options.cookie
        const second = calls[1].options.cookie
        const nuid = (first.match(/_ntes_nuid=([^;]+)/) || [])[1]
        expect(nuid).toBeTruthy()
        expect(second).toContain('_ntes_nuid=' + nuid)
        // 建 key 下发的 NMTID 要带到后续轮询
        expect(second).toContain('NMTID=nm1')
    })

    it('801 等待 -> 802 已扫 -> 803 确认入库', async () => {
        const store = makeStore()
        const manager = build({ store })
        const { sessionId } = await manager.create('admin')

        expect(await manager.check(sessionId, 'admin')).toMatchObject({ status: 'waiting', code: 801 })
        expect(await manager.check(sessionId, 'admin')).toMatchObject({ status: 'scanned', code: 802 })

        const confirmed = await manager.check(sessionId, 'admin')
        expect(confirmed.status).toBe('confirmed')
        expect(confirmed.cookieId).toBe('new-cookie')
        expect(confirmed.userInfo.nickname).toBe('测试用户')

        expect(store.addCookie).toHaveBeenCalledTimes(1)
        const [, cookie] = store.addCookie.mock.calls[0]
        expect(cookie).toContain('MUSIC_U=v2_abcdef')
        expect(cookie).toContain('__csrf=csrf123')
        expect(cookie).not.toContain('should_be_dropped')

        // 803 之后重复查询走缓存，不再打上游
        expect(await manager.check(sessionId, 'admin')).toMatchObject({ status: 'confirmed' })
    })

    it('同一账号已有记录时按 userId 覆盖，而不是新增', async () => {
        const store = makeStore([
            { id: 'old-cookie', platform: 'netease', cookie: 'MUSIC_U=old', userInfo: { userId: 42 } },
        ])
        const manager = build({ store })
        const { sessionId } = await manager.create('admin')
        await manager.check(sessionId, 'admin')
        await manager.check(sessionId, 'admin')
        const confirmed = await manager.check(sessionId, 'admin')

        expect(confirmed.cookieId).toBe('old-cookie')
        expect(store.addCookie).not.toHaveBeenCalled()
        expect(store.updateCookie).toHaveBeenCalledWith('old-cookie', expect.objectContaining({
            cookie: expect.stringContaining('MUSIC_U=v2_abcdef'),
            isActive: true,
            isValid: true,
        }), 'admin', true)
    })

    it('Cookie 校验不通过时标记 failed，不写库', async () => {
        const store = makeStore()
        const manager = build({
            store,
            validate: async () => ({ valid: false, error: 'Cookie已过期', userInfo: null }),
        })
        const { sessionId } = await manager.create('admin')
        await manager.check(sessionId, 'admin')
        await manager.check(sessionId, 'admin')
        const failed = await manager.check(sessionId, 'admin')

        expect(failed).toMatchObject({ status: 'failed', error: 'Cookie已过期' })
        expect(store.addCookie).not.toHaveBeenCalled()
        expect(store.updateCookie).not.toHaveBeenCalled()
    })

    it('803 但响应头没有 MUSIC_U 时标记 failed，不写库', async () => {
        const store = makeStore()
        const manager = build({
            store,
            request: makeRequest([
                { data: { code: 200, unikey: 'unikey-abc' } },
                { data: { code: 801 } },
                { data: { code: 802 } },
                { data: { code: 803 }, setCookie: ['NMTID=only; Path=/'] },
            ]),
        })
        const { sessionId } = await manager.create('admin')
        await manager.check(sessionId, 'admin')
        await manager.check(sessionId, 'admin')
        const failed = await manager.check(sessionId, 'admin')

        expect(failed.status).toBe('failed')
        expect(failed.error).toContain('MUSIC_U')
        expect(store.addCookie).not.toHaveBeenCalled()
    })

    it('803 的凭据在 body.cookie 里也能取到', async () => {
        const store = makeStore()
        const manager = build({
            store,
            request: makeRequest([
                { data: { code: 200, unikey: 'unikey-abc' } },
                { data: { code: 801 } },
                { data: { code: 802 } },
                { data: { code: 803, cookie: 'MUSIC_U=from_body; __csrf=bodycsrf; _ntes_nuid=x' } },
            ]),
        })
        const { sessionId } = await manager.create('admin')
        await manager.check(sessionId, 'admin')
        await manager.check(sessionId, 'admin')
        const confirmed = await manager.check(sessionId, 'admin')

        expect(confirmed.status).toBe('confirmed')
        const [, cookie] = store.addCookie.mock.calls[0]
        expect(cookie).toContain('MUSIC_U=from_body')
        expect(cookie).toContain('__csrf=bodycsrf')
        expect(cookie).not.toContain('_ntes_nuid')
    })

    it('8821 风控码给出明确提示，不写库、不再空转', async () => {
        const store = makeStore()
        const manager = build({
            store,
            request: makeRequest([
                { data: { code: 200, unikey: 'unikey-abc' } },
                { data: { code: 801 } },
                { data: { code: 802 } },
                { data: { code: 8821, message: '请切换其他登录方式或升级新版本再试' } },
            ]),
        })
        const { sessionId } = await manager.create('admin')
        await manager.check(sessionId, 'admin')
        await manager.check(sessionId, 'admin')
        const failed = await manager.check(sessionId, 'admin')

        expect(failed.status).toBe('failed')
        expect(failed.code).toBe(8821)
        expect(failed.error).toContain('行为验证')
        expect(store.addCookie).not.toHaveBeenCalled()

        // 失败后继续查询返回同一个失败结果，不再打上游
        expect(await manager.check(sessionId, 'admin')).toMatchObject({ status: 'failed', code: 8821 })
    })

    it('超过 TTL 返回 expired，且不能再被查询', async () => {
        let clock = 1_000
        const manager = build({ now: () => clock, ttl: 1_000 })
        const { sessionId } = await manager.create('admin')

        clock += 2_000
        expect(await manager.check(sessionId, 'admin')).toMatchObject({ status: 'expired' })
        await expect(manager.check(sessionId, 'admin')).rejects.toBeInstanceOf(QrLoginError)
    })

    it('会话绑定发起人，别人拿到 sessionId 也用不了', async () => {
        const manager = build()
        const { sessionId } = await manager.create('admin')
        await expect(manager.check(sessionId, 'intruder')).rejects.toMatchObject({ status: 404 })
        expect(manager.cancel(sessionId, 'intruder')).toEqual({ success: true })
        await expect(manager.check(sessionId, 'admin')).resolves.toMatchObject({ status: 'waiting' })
    })

    it('create 单飞：同一管理员重复调用复用同一个会话', async () => {
        const request = makeRequest([{ data: { code: 200, unikey: 'unikey-abc' } }])
        const manager = build({ request })
        const first = await manager.create('admin')
        const second = await manager.create('admin')

        expect(second.sessionId).toBe(first.sessionId)
        expect(request).toHaveBeenCalledTimes(1)
    })

    it('cancel 之后会话立即失效', async () => {
        const manager = build()
        const { sessionId } = await manager.create('admin')
        expect(manager.cancel(sessionId, 'admin')).toEqual({ success: true })
        await expect(manager.check(sessionId, 'admin')).rejects.toMatchObject({ status: 404 })
    })
})

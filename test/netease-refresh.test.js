/**
 * 网易云 Cookie 自动续签单测
 *
 * 核心保证：
 *   - 只有 code=200 且响应头里确实带 MUSIC_U 才写库
 *   - 新 Cookie 必须先通过校验，校验不过保留旧值
 *   - 值没变化时不产生无意义的落盘
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-refresh-'))
process.env.DATA_DIR = TEST_DATA_DIR

let NeteaseCookieRefresher

beforeAll(async () => {
    ({ NeteaseCookieRefresher } = await import('../src/admin/netease-refresh.js'))
})

const build = (overrides = {}) => {
    const store = {
        getCookies: vi.fn(() => []),
        updateCookie: vi.fn(async () => ({ success: true })),
    }
    const refresher = new NeteaseCookieRefresher({
        store,
        request: vi.fn(async () => ({
            data: { code: 200 },
            setCookie: ['MUSIC_U=new_value; Max-Age=1296000; Path=/', '__csrf=new_csrf; Path=/'],
        })),
        validate: vi.fn(async () => ({
            valid: true,
            error: null,
            userInfo: { userId: 42, nickname: '测试用户' },
        })),
        now: () => 1_700_000_000_000,
        ...overrides,
    })
    return { refresher, store }
}

const COOKIE = { id: 'c1', platform: 'netease', isActive: true, cookie: 'MUSIC_U=old; __csrf=old_csrf; os=pc' }

describe('网易云 Cookie 续签', () => {
    it('200 且带 MUSIC_U 时合并字段并写库', async () => {
        const { refresher, store } = build()
        const changed = await refresher.refreshOne(COOKIE)

        expect(changed).toBe(true)
        expect(store.updateCookie).toHaveBeenCalledTimes(1)
        const [id, patch, operator, skip] = store.updateCookie.mock.calls[0]
        expect(id).toBe('c1')
        expect(patch.cookie).toBe('MUSIC_U=new_value; __csrf=new_csrf; os=pc')
        expect(patch.isValid).toBe(true)
        expect(patch.userInfo.nickname).toBe('测试用户')
        expect(operator).toBe('refresh')
        expect(skip).toBe(true)
    })

    it('code 不是 200 时不动 Cookie', async () => {
        const { refresher, store } = build({
            request: vi.fn(async () => ({ data: { code: 301 }, setCookie: [] })),
        })
        expect(await refresher.refreshOne(COOKIE)).toBe(false)
        expect(store.updateCookie).not.toHaveBeenCalled()
    })

    it('响应头里没有 MUSIC_U 时不动 Cookie（避免把旧值冲掉）', async () => {
        const { refresher, store } = build({
            request: vi.fn(async () => ({ data: { code: 200 }, setCookie: ['__csrf=only_csrf; Path=/'] })),
        })
        expect(await refresher.refreshOne(COOKIE)).toBe(false)
        expect(store.updateCookie).not.toHaveBeenCalled()
    })

    it('新 Cookie 校验失败时保留旧值', async () => {
        const { refresher, store } = build({
            validate: vi.fn(async () => ({ valid: false, error: 'Cookie已过期', userInfo: null })),
        })
        expect(await refresher.refreshOne(COOKIE)).toBe(false)
        expect(store.updateCookie).not.toHaveBeenCalled()
    })

    it('值没有变化时不落盘', async () => {
        const { refresher, store } = build({
            request: vi.fn(async () => ({
                data: { code: 200 },
                setCookie: ['MUSIC_U=old; Path=/', '__csrf=old_csrf; Path=/'],
            })),
        })
        expect(await refresher.refreshOne(COOKIE)).toBe(false)
        expect(store.updateCookie).not.toHaveBeenCalled()
    })

    it('没有 MUSIC_U 的 Cookie 直接跳过，不发请求', async () => {
        const request = vi.fn()
        const { refresher } = build({ request })
        expect(await refresher.refreshOne({ id: 'x', cookie: 'MUSIC_A=anon' })).toBe(false)
        expect(request).not.toHaveBeenCalled()
    })

    it('refreshAll 只处理启用的网易云 Cookie 并汇总结果', async () => {
        const { refresher, store } = build()
        store.getCookies.mockReturnValue([
            { ...COOKIE, id: 'c1' },
            { ...COOKIE, id: 'c2', isActive: false },
        ])

        const summary = await refresher.refreshAll()
        expect(summary).toEqual({ checked: 1, refreshed: 1, failed: 0 })
        expect(store.updateCookie).toHaveBeenCalledTimes(1)
        expect(refresher.lastRunAt).toBe(1_700_000_000_000)
    })
})

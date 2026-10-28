/**
 * 管理后台登录回归测试
 *
 * 背景：这个 fork 在历史修改中多次把登录搞坏（令牌失效、锁定误伤、
 * 中间件顺序变化导致 /admin/login 被限流拦掉等）。这里把登录链路
 * 固化成用例，任何后续改动都必须先跑通它。
 *
 * 覆盖：
 *   1. 密码错误 / 连续失败锁定
 *   2. 正常登录签发令牌
 *   3. 令牌校验（有效 / 缺失 / 伪造）
 *   4. 非管理员访问管理员接口 / 退出登录令牌失效
 *   5. 滥用检测中间件不得拦掉登录（历史事故点）
 *
 * 注意：DATA_DIR 必须在本文件静态 import 之前设置，所以所有业务模块都用
 * 动态 import 加载，确保 store / apiLogger 落在临时目录里，不碰真实 data/。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-auth-'))
process.env.DATA_DIR = TEST_DATA_DIR

const JSON_HEADERS = { 'content-type': 'application/json' }

let app
let store

/** 造一个和 app.js 同构的最小应用：滥用检测 -> 管理接口 -> 管理页面兜底 */
const buildApp = async () => {
    const { Hono } = await import('hono')
    const { default: adminRoutes } = await import('../src/admin/api.js')
    const { default: abuseDetectorMiddleware } = await import('../src/middleware/abuse-detector.js')
    const { default: appConfig } = await import('../src/config.js')

    const instance = new Hono()
    instance.use('*', abuseDetectorMiddleware)
    adminRoutes(instance)

    // 与 app.js 相同的后台路径兜底（存在于真实应用，登录页由它返回）
    instance.use('*', async (c, next) => {
        const adminPath = store.getAdminPath() || appConfig.ADMIN_PATH
        const p = c.req.path
        if (p === '/' + adminPath || p.startsWith('/' + adminPath + '/')) {
            return c.html('<!doctype html><title>admin</title>')
        }
        await next()
    })
    return instance
}

const login = async (username, password, code) => {
    const res = await app.request('/admin/login', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ username, password, ...(code ? { code } : {}) }),
    })
    return { res, body: await res.json() }
}

const authHeaders = (username, token) => ({
    'X-Auth-Username': username,
    'X-Auth-Token': token,
})

beforeAll(async () => {
    store = (await import('../src/admin/store.js')).default
    app = await buildApp()
})

describe('管理后台登录', () => {
    it('用默认账号可以登录并拿到令牌', async () => {
        const { res, body } = await login('admin', 'admin123')
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(typeof body.data.token).toBe('string')
        expect(body.data.token.length).toBeGreaterThan(8)
        expect(body.data.role).toBe('admin')
    })

    it('密码错误返回 401 且带剩余次数提示', async () => {
        const { res, body } = await login('admin', 'wrong-password')
        expect(res.status).toBe(401)
        expect(body.success).toBe(false)
        expect(body.error).toContain('密码错误')
    })

    it('连续失败达到阈值后锁定账户，正确密码也登不进去', async () => {
        await store.addUser({ username: 'locktest', password: 'locktest123', role: 'user' }, 'test')
        for (let i = 0; i < 4; i++) {
            const { body } = await login('locktest', 'nope')
            expect(body.success).toBe(false)
        }
        const fifth = await login('locktest', 'nope')
        expect(fifth.body.locked).toBe(true)

        const { res, body } = await login('locktest', 'locktest123')
        expect(res.status).toBe(401)
        expect(body.error).toContain('锁定')

        // 清理，避免影响同文件后续用例
        store.clearFailedLogins('locktest')
    })

    it('不存在的用户同样拒绝', async () => {
        const { res, body } = await login('ghost-user', 'whatever')
        expect(res.status).toBe(401)
        expect(body.success).toBe(false)
    })
})

describe('令牌校验', () => {
    it('有效令牌可以通过 /admin/check', async () => {
        const { body } = await login('admin', 'admin123')
        const res = await app.request('/admin/check', { headers: authHeaders('admin', body.data.token) })
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.data.username).toBe('admin')
        expect(data.data.role).toBe('admin')
    })

    it('缺少认证头返回 401', async () => {
        const res = await app.request('/admin/check')
        expect(res.status).toBe(401)
    })

    it('伪造令牌返回 401', async () => {
        const res = await app.request('/admin/check', { headers: authHeaders('admin', 'forged-token') })
        expect(res.status).toBe(401)
    })

    it('用户名与令牌不匹配返回 401', async () => {
        const { body } = await login('admin', 'admin123')
        const res = await app.request('/admin/check', { headers: authHeaders('someone-else', body.data.token) })
        expect(res.status).toBe(401)
    })
})

describe('权限与登出', () => {
    it('普通用户可以登录，但访问管理员接口返回 403', async () => {
        await store.addUser({ username: 'plain', password: 'plain123', role: 'user' }, 'test')
        const { res, body } = await login('plain', 'plain123')
        expect(res.status).toBe(200)

        const denied = await app.request('/admin/users', { headers: authHeaders('plain', body.data.token) })
        expect(denied.status).toBe(403)

        const allowed = await app.request('/admin/cookies', { headers: authHeaders('plain', body.data.token) })
        expect(allowed.status).toBe(200)
    })

    it('登出后原令牌立即失效', async () => {
        const { body } = await login('admin', 'admin123')
        const token = body.data.token

        const before = await app.request('/admin/check', { headers: authHeaders('admin', token) })
        expect(before.status).toBe(200)

        const out = await app.request('/admin/logout', { method: 'POST', headers: authHeaders('admin', token) })
        expect(out.status).toBe(200)

        const after = await app.request('/admin/check', { headers: authHeaders('admin', token) })
        expect(after.status).toBe(401)
    })
})

describe('扫码登录接口权限', () => {
    it('未登录访问扫码接口返回 401', async () => {
        const res = await app.request('/admin/cookies/qr/netease/create', { method: 'POST' })
        expect(res.status).toBe(401)
    })

    it('普通用户不能发起扫码登录（403，且不会触达上游）', async () => {
        await store.addUser({ username: 'qr-plain', password: 'qr-plain123', role: 'user' }, 'test')
        const { body } = await login('qr-plain', 'qr-plain123')
        expect(body.success).toBe(true)

        const res = await app.request('/admin/cookies/qr/netease/create', {
            method: 'POST',
            headers: authHeaders('qr-plain', body.data.token),
        })
        expect(res.status).toBe(403)
    })

    it('普通用户不能写 Cookie（403），只读列表仍可用', async () => {
        const { body } = await login('qr-plain', 'qr-plain123')
        const write = await app.request('/admin/cookies', {
            method: 'POST',
            headers: { ...authHeaders('qr-plain', body.data.token), 'content-type': 'application/json' },
            body: JSON.stringify({ platform: 'netease', cookie: 'MUSIC_U=fake', skipValidation: true }),
        })
        expect(write.status).toBe(403)

        const read = await app.request('/admin/cookies', { headers: authHeaders('qr-plain', body.data.token) })
        expect(read.status).toBe(200)
    })
})

describe('滥用检测不得误伤登录', () => {
    it('同一 IP 高频请求后仍能打开登录页并登录', async () => {
        const ip = '203.0.113.77'
        const headers = { ...JSON_HEADERS, 'X-Forwarded-For': ip }

        // 超过默认每分钟 120 次的上限，触发限流判定
        for (let i = 0; i < 150; i++) {
            await app.request('/admin/check', { headers: { 'X-Forwarded-For': ip } })
        }

        const page = await app.request('/admin', { headers: { 'X-Forwarded-For': ip } })
        expect(page.status).toBe(200)

        const res = await app.request('/admin/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({ username: 'admin', password: 'admin123' }),
        })
        expect(res.status).toBe(200)
        expect((await res.json()).success).toBe(true)
    })

    it('携带有效令牌的请求不受频控影响', async () => {
        const { body } = await login('admin', 'admin123')
        const headers = { ...authHeaders('admin', body.data.token), 'X-Forwarded-For': '198.51.100.9' }
        for (let i = 0; i < 160; i++) {
            const res = await app.request('/admin/check', { headers })
            expect(res.status).toBe(200)
        }
    })
})

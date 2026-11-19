/**
 * url 成功配额测试：
 *   - 同一 IP 在窗口内取「不同歌曲」的直链，超过 max 后新的歌曲被 429；
 *   - 同一首歌的重复请求/重试永远放行（不重复计数）；
 *   - 失败响应（404 no url / 4xx）不消耗配额——只有 302 才计数；
 *   - 窗口过期后自动重置。
 *
 * 该规则针对的是「拿 API 当 VIP 直链解锁源」的批量脚本：
 * 真实用户听歌间隔 ≥3 分钟，物理上碰不到线；脚本同秒刷十几个不同 id 立刻撞线。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-urlquota-'))
process.env.DATA_DIR = TEST_DATA_DIR

let app
let store
let abuse

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36'

// 直接打中间件 + 一个模拟 302 的上游，不依赖真实 provider
const hit = (url, { ip } = {}) => app.request(url, {
    headers: { 'X-Forwarded-For': ip, 'User-Agent': CHROME },
})

beforeAll(async () => {
    const { Hono } = await import('hono')
    abuse = await import('../src/middleware/abuse-detector.js')
    store = (await import('../src/admin/store.js')).default

    app = new Hono()
    app.use('*', abuse.abuseDetectorMiddleware)
    // 模拟 api.js 的 url 成功路径：302 + recordUrlSuccess
    app.get('/api', (c) => {
        const type = new URL(c.req.url).searchParams.get('type')
        if (type === 'url') {
            const ip = c.get('clientIP')
            const server = new URL(c.req.url).searchParams.get('server') || 'netease'
            const id = new URL(c.req.url).searchParams.get('id') || ''
            abuse.recordUrlSuccess(ip, server, id, abuse.getEffectiveAbuseConfig())
            return c.redirect('https://example.com/a.mp3')
        }
        return c.json([{ title: 'ok' }])
    })
})

const setQuota = (max, windowMs = 60000) =>
    store.setAbuseConfig({ urlSuccessQuota: { enabled: true, max, windowMs } }, 'test')

describe('url 成功配额', () => {
    it('窗口内取不同歌曲超过 max 后，新歌被 429 且带 Retry-After', async () => {
        await setQuota(3)
        const ip = '198.51.100.50'
        for (const id of ['101', '102', '103']) {
            const res = await hit(`/api?server=netease&type=url&id=${id}`, { ip })
            expect(res.status).toBe(302)
        }
        // 第 4 首（新 id）撞线
        const blocked = await hit('/api?server=netease&type=url&id=104', { ip })
        expect(blocked.status).toBe(429)
        expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
        const body = await blocked.json()
        expect(body.error).toBe('Too Many Requests')
    })

    it('同一首歌的重复请求不重复计数，永远放行', async () => {
        await setQuota(2)
        const ip = '198.51.100.51'
        // 同一首 101 连续取 5 次，全部放行
        for (let i = 0; i < 5; i++) {
            const res = await hit('/api?server=netease&type=url&id=101', { ip })
            expect(res.status).toBe(302)
        }
        // 第二首也放行
        expect((await hit('/api?server=netease&type=url&id=102', { ip })).status).toBe(302)
        // 第三首（新 id）才撞线
        expect((await hit('/api?server=netease&type=url&id=103', { ip })).status).toBe(429)
    })

    it('只作用于 type=url，其他类型不受影响', async () => {
        await setQuota(1)
        const ip = '198.51.100.52'
        expect((await hit('/api?server=netease&type=url&id=201', { ip })).status).toBe(302)
        // url 已撞线
        expect((await hit('/api?server=netease&type=url&id=202', { ip })).status).toBe(429)
        // 但 song/lrc/pic 不受影响
        for (const t of ['song', 'lrc', 'pic', 'playlist']) {
            expect((await hit(`/api?server=netease&type=${t}&id=201`, { ip })).status).toBe(200)
        }
    })

    it('不同 IP 的配额互相独立', async () => {
        await setQuota(1)
        expect((await hit('/api?server=netease&type=url&id=301', { ip: '198.51.100.53' })).status).toBe(302)
        expect((await hit('/api?server=netease&type=url&id=302', { ip: '198.51.100.53' })).status).toBe(429)
        expect((await hit('/api?server=netease&type=url&id=301', { ip: '198.51.100.54' })).status).toBe(302)
    })

    it('规则关闭后不再拦截', async () => {
        await store.setAbuseConfig({ urlSuccessQuota: { enabled: false } }, 'test')
        const ip = '198.51.100.55'
        for (let i = 0; i < 30; i++) {
            expect((await hit(`/api?server=netease&type=url&id=${400 + i}`, { ip })).status).toBe(302)
        }
        await setQuota(20)
    })
})

describe('recordUrlSuccess 单元行为', () => {
    it('同一对 server+id 只计入一次', async () => {
        await setQuota(10)
        const config = abuse.getEffectiveAbuseConfig()
        const ip = '198.51.100.60'
        expect(abuse.recordUrlSuccess(ip, 'netease', '501', config)).toBe(true)
        expect(abuse.recordUrlSuccess(ip, 'netease', '501', config)).toBe(false)
        expect(abuse.recordUrlSuccess(ip, 'netease', '502', config)).toBe(true)
    })

    it('窗口过期后重新开窗', async () => {
        await setQuota(1, 1000) // 1 秒窗口
        const config = abuse.getEffectiveAbuseConfig()
        const ip = '198.51.100.61'
        const t0 = Date.now()
        expect(abuse.recordUrlSuccess(ip, 'netease', '601', config, t0)).toBe(true)
        // 窗口内：新 id 撞线
        expect(abuse.checkUrlSuccessQuota(ip, 'netease', '602', config, t0 + 500)).not.toBeNull()
        // 窗口过期后：自动重置
        expect(abuse.checkUrlSuccessQuota(ip, 'netease', '602', config, t0 + 1500)).toBeNull()
        await setQuota(20)
    })
})

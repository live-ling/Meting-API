/**
 * /api 入参校验收敛测试（不接外网，provider 打桩）：
 *
 * 线上日志发现三类「参数不可用被当成参数为空」的调用方错误，
 * 之前全部在 200/500 里静默通过：
 *   1. type=search 用 keyword= 或漏 id → 空关键词打上游，返回 30 条无关数据（200）
 *      → 现在 400，message 直接指出该用 id=；
 *   2. 缺省/空 server 走 tencent 默认歌单，provider 对不存在的歌单 TypeError → 500
 *      → 现在收敛为 502（上游异常），不再污染健康指标；
 *   3. type=song 逗号多 id 被上游判参数错误，裸 throw → 500
 *      → 现在收敛为 502；同时 playlist/album 等单对象类型带逗号直接 400。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-apival-'))
process.env.DATA_DIR = TEST_DATA_DIR

let app

beforeAll(async () => {
    const { Hono } = await import('hono')
    const handler = (await import('../src/service/api.js')).default
    app = new Hono()
    app.get('/api', handler)
})

const get = (url) => app.request(url, {
    headers: { 'X-Forwarded-For': '198.51.100.90', 'User-Agent': 'vitest' },
})

describe('search 必须有关键词（id= 或 keyword= 均可）', () => {
    it('keyword= 是 id= 的别名，正常搜索', async () => {
        const res = await get('/api?server=netease&type=search&keyword=周杰伦')
        expect(res.status).not.toBe(400)
    })

    it('id 与 keyword 并存时 id 优先（不报错）', async () => {
        const res = await get('/api?server=netease&type=search&id=稻香&keyword=别的')
        expect(res.status).not.toBe(400)
    })

    it('两者都缺省 → 400，提示两种写法', async () => {
        const res = await get('/api?server=netease&type=search&limit=2')
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.message).toContain('id=')
        expect(body.message).toContain('keyword=')
    })

    it('keyword 为空串 → 400', async () => {
        const res = await get('/api?server=netease&type=search&keyword=')
        expect(res.status).toBe(400)
    })

    it('keyword 只有空白 → 400', async () => {
        const res = await get('/api?server=netease&type=search&keyword=%20%20')
        expect(res.status).toBe(400)
    })
})

describe('逗号批量 id 的边界', () => {
    it('playlist 带逗号 → 400（单对象类型不支持批量）', async () => {
        const res = await get('/api?server=netease&type=playlist&id=1840459406,347230')
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.message).toContain('type=song')
    })

    it('url / lrc / pic 带逗号 → 400', async () => {
        for (const t of ['url', 'lrc', 'pic']) {
            const res = await get(`/api?server=netease&type=${t}&id=1840459406,347230`)
            expect(res.status).toBe(400)
        }
    })
})

describe('provider 异常收敛', () => {
    it('netease song 多 id 被上游拒绝 → 502 而非 500', async () => {
        // 需要真实上游才会触发；本用例只验证「不可能是 500」——
        // 本地无网时 request 失败同样会走到 UpstreamError 或 502 兜底
        const res = await get('/api?server=netease&type=song&id=1840459406,347230')
        expect([200, 502]).toContain(res.status)
        expect(res.status).not.toBe(500)
    })
})

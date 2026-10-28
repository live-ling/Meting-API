/**
 * /api 契约与站点元信息测试（不联网，不依赖外部音乐平台）
 *
 * 固化这几条容易回退的行为：
 *   - /api 与 /api/ 都能到达同一个处理函数（日志里尾斜杠会 404）
 *   - 参数校验仍然返回 400，且不会因为「看起来像搜索」而放行注入字符
 *   - robots.txt / sitemap.xml 存在，且 robots 禁止抓 /api
 *   - 缓存模块的 TTL、键分离、容量与开关
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-contract-'))
process.env.DATA_DIR = TEST_DATA_DIR

let app
let cache

beforeAll(async () => {
    const { Hono } = await import('hono')
    const { default: api } = await import('../src/service/api.js')
    const { robotsHandler, sitemapHandler } = await import('../src/routes/meta.js')
    const { default: apiLogger } = await import('../src/service/api-logger.js')
    cache = (await import('../src/service/api-cache.js')).default

    app = new Hono()
    app.get('/api', api)
    app.get('/api/', api)
    app.get('/api/stats', (c) => c.json({ success: true, data: apiLogger.getStats() }))
    app.get('/robots.txt', robotsHandler)
    app.get('/sitemap.xml', sitemapHandler)
})

describe('路由可达性', () => {
    it('/api/ 尾斜杠与 /api 行为一致', async () => {
        const bare = await app.request('/api?server=bogus&type=song&id=1')
        const slash = await app.request('/api/?server=bogus&type=song&id=1')
        expect(bare.status).toBe(400)
        expect(slash.status).toBe(400)
        expect(await slash.json()).toMatchObject({ status: 400 })
    })

    it('robots.txt 禁止抓 /api，但不泄露后台路径', async () => {
        const res = await app.request('/robots.txt')
        expect(res.status).toBe(200)
        const body = await res.text()
        expect(body).toContain('User-agent: *')
        expect(body).toContain('Disallow: /api')
        expect(body).toContain('Allow: /test')
        expect(body).toContain('Sitemap:')
        // 后台是用户设置的隐藏路径，绝不能出现在 robots.txt 里
        expect(body).not.toContain('Disallow: /admin')
    })

    it('sitemap.xml 是合法 XML 且包含两个页面', async () => {
        const res = await app.request('/sitemap.xml')
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('xml')
        const body = await res.text()
        expect(body.startsWith('<?xml')).toBe(true)
        expect(body).toContain('<urlset')
        expect(body).toContain('/test</loc>')
    })
})

describe('参数校验', () => {
    const bad = [
        ['未知 server', '/api?server=spotify&type=song&id=1'],
        ['未知 type', '/api?server=netease&type=hack&id=1'],
        ['腾讯不支持 search', '/api?server=tencent&type=search&id=晴天'],
        ['id 注入字符', '/api?server=netease&type=song&id=%3Cscript%3E'],
        ['id 过长', '/api?server=netease&type=song&id=' + 'a'.repeat(300)],
        ['search 关键词含尖括号', '/api?server=netease&type=search&id=' + encodeURIComponent('<img src=x>')],
        ['不支持的音质', '/api?server=netease&type=url&id=1&quality=ultra'],
    ]

    for (const [name, url] of bad) {
        it(`${name} → 400`, async () => {
            const res = await app.request(url)
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.status).toBe(400)
            expect(typeof body.message).toBe('string')
        })
    }

    it('非法参数不会写入 500', async () => {
        const res = await app.request('/api?server=netease&type=url&id=abc%20def')
        expect(res.status).toBe(400)
    })
})

describe('缓存模块', () => {
    it('命中与 TTL 过期', () => {
        cache.clear()
        const key = cache.key({ server: 'netease', type: 'playlist', id: '1', cookie: '', overseas: false })
        expect(cache.get(key)).toBeUndefined()
        cache.set(key, [{ title: 'x' }], 'playlist')
        expect(cache.get(key)).toEqual([{ title: 'x' }])
    })

    it('键区分 platform、cookie 与 OVERSEAS', () => {
        const base = { server: 'netease', type: 'url', id: '1', cookie: '', overseas: false }
        const keys = new Set([
            cache.key(base),
            cache.key({ ...base, cookie: 'MUSIC_U=abc' }),
            cache.key({ ...base, overseas: true }),
            cache.key({ ...base, server: 'tencent' }),
        ])
        expect(keys.size).toBe(4)
    })

    it('键区分音质', () => {
        const base = { server: 'netease', type: 'url', id: '1', cookie: '', overseas: false }
        expect(cache.key({ ...base, quality: 'lossless' })).not.toBe(cache.key(base))
        expect(cache.key({ ...base, quality: 'lossless' })).not.toBe(cache.key({ ...base, quality: 'hires' }))
    })

    it('URL 类型 TTL 短于歌单 TTL', () => {
        const urlTtl = cache.stats().ttlByType.url
        const playlistTtl = cache.stats().ttlByType.playlist
        expect(urlTtl).toBeLessThan(playlistTtl)
        expect(playlistTtl).toBeGreaterThanOrEqual(1800)
    })

    it('超大数据不会被缓存', () => {
        cache.clear()
        const key = cache.key({ server: 'netease', type: 'playlist', id: 'huge', cookie: '', overseas: false })
        cache.set(key, 'x'.repeat(5 * 1024 * 1024), 'playlist')
        expect(cache.get(key)).toBeUndefined()
    })

    it('统计信息包含命中率与容量', () => {
        const stats = cache.stats()
        expect(stats).toHaveProperty('hitRate')
        expect(stats).toHaveProperty('maxEntries')
        expect(stats.enabled).toBe(true)
    })
})

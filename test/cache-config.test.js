/**
 * /api 响应缓存的后台配置：
 * 默认 TTL 必须与访问日志分析结论一致；后台改 TTL/上限/开关要立即生效。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-cache-'))
process.env.DATA_DIR = TEST_DATA_DIR

let store
let cache
let cacheConfig
let ttlForType

const key = (id = '1', type = 'playlist') => cache.key({
    server: 'netease',
    type,
    id,
    cookie: '',
    overseas: false,
})

beforeAll(async () => {
    store = (await import('../src/admin/store.js')).default
    const cacheModule = await import('../src/service/api-cache.js')
    cache = cacheModule.default
    ttlForType = cacheModule.ttlForType
    cacheConfig = await import('../src/service/cache-config.js')
})

afterAll(() => {
    try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }) } catch {}
})

describe('缓存默认值', () => {
    it('默认 TTL 与日志分析结论一致', () => {
        const c = cacheConfig.resolveCacheConfig(null, {})
        expect(c.enabled).toBe(true)
        expect(c.ttlByType.url).toBe(10 * 60)
        expect(c.ttlByType.playlist).toBe(30 * 60)
        expect(c.ttlByType.lrc).toBe(60 * 60)
        expect(c.maxEntries).toBe(500)
    })

    it('环境变量 CACHE_ENABLED=0 是总开关，TTL 环境变量作为默认值', () => {
        expect(cacheConfig.resolveCacheConfig(null, { CACHE_ENABLED: '0' }).enabled).toBe(false)
        const c = cacheConfig.resolveCacheConfig(null, { CACHE_TTL_SECONDS: '300' })
        expect(c.ttlByType.url).toBe(300)
        expect(c.ttlByType.playlist).toBe(300)
    })

    it('后台 per-type TTL 覆盖环境变量', () => {
        const c = cacheConfig.resolveCacheConfig(
            { ttlByType: { url: 120 } },
            { CACHE_TTL_SECONDS: '300' }
        )
        expect(c.ttlByType.url).toBe(120)
        expect(c.ttlByType.playlist).toBe(300)
    })
})

describe('缓存配置持久化与生效', () => {
    it('保存 TTL/上限后缓存模块立即使用新值', async () => {
        const result = await store.setCacheConfig({
            enabled: true,
            maxEntries: 100,
            ttlByType: { url: 120, playlist: 1200, lrc: 3600 },
        }, 'test')
        expect(result.success).toBe(true)

        expect(ttlForType('url')).toBe(120 * 1000)
        expect(ttlForType('playlist')).toBe(1200 * 1000)
        const stats = cache.stats()
        expect(stats.maxEntries).toBe(100)
        expect(stats.ttlByType.url).toBe(120)

        cache.clear()
        cache.set(key('1'), [{ title: 'x' }], 'playlist')
        expect(cache.get(key('1'))).toEqual([{ title: 'x' }])
    })

    it('关闭后不再读取/写入缓存，重新启用后恢复', async () => {
        cache.clear()
        cache.set(key('2'), [{ title: 'before-off' }], 'playlist')
        expect(cache.get(key('2'))).toBeTruthy()

        await store.setCacheConfig({ enabled: false }, 'test')
        expect(cache.stats().enabled).toBe(false)
        expect(cache.get(key('2'))).toBeUndefined()
        cache.set(key('3'), [{ title: 'while-off' }], 'playlist')
        expect(cache.get(key('3'))).toBeUndefined()

        await store.setCacheConfig({ enabled: true }, 'test')
        expect(cache.stats().enabled).toBe(true)
    })

    it('拒绝非法 TTL、未知类型与越界上限', async () => {
        expect((await store.setCacheConfig({ ttlByType: { url: 30 } }, 'test')).success).toBe(false)
        expect((await store.setCacheConfig({ ttlByType: { nope: 600 } }, 'test')).success).toBe(false)
        expect((await store.setCacheConfig({ maxEntries: 10 }, 'test')).success).toBe(false)
        expect((await store.setCacheConfig({ maxEntries: 200000 }, 'test')).success).toBe(false)
        expect((await store.setCacheConfig({ maxEntries: 1000 }, 'test')).success).toBe(true)
    })
})

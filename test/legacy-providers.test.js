/**
 * 酷狗 / 百度 / 酷我 provider 的纯函数测试（不联网）
 *
 * 这三个平台走 @meting/core（与原始项目同一套上游），
 * 这里固化「库的字段 → /api 字段」的映射与注册表状态，
 * 网络可用性由 providers.test.js 的示例请求覆盖。
 */
import { describe, it, expect } from 'vitest'
import { mapSong, SUPPORT_TYPE, createProvider } from '../src/providers/legacy/index.js'
import Providers from '../src/providers/index.js'

describe('@meting/core 结果映射', () => {
    it('把 name/artist[]/url_id/pic_id/lyric_id 映射成 title/author/url/pic/lrc', () => {
        const mapped = mapSong({
            id: 'B3A52A7A958BF0AED0EBFBA2E9A818B7',
            name: '晴天',
            artist: ['周杰伦'],
            album: '叶惠美',
            url_id: 'B3A52A7A958BF0AED0EBFBA2E9A818B7',
            pic_id: 'B3A52A7A958BF0AED0EBFBA2E9A818B7',
            lyric_id: 'B3A52A7A958BF0AED0EBFBA2E9A818B7',
            source: 'kugou',
        })
        expect(mapped).toEqual({
            title: '晴天',
            author: '周杰伦',
            url: 'B3A52A7A958BF0AED0EBFBA2E9A818B7',
            pic: 'B3A52A7A958BF0AED0EBFBA2E9A818B7',
            lrc: 'B3A52A7A958BF0AED0EBFBA2E9A818B7',
        })
    })

    it('多歌手用 " / " 连接，与 netease/tencent 一致', () => {
        expect(mapSong({ name: 'x', artist: ['暴林', '乔玲儿'] }).author).toBe('暴林 / 乔玲儿')
    })

    it('artist 是字符串时原样保留', () => {
        expect(mapSong({ name: 'x', artist: '周杰伦' }).author).toBe('周杰伦')
    })

    it('缺少 *_id 时回退到 id', () => {
        const mapped = mapSong({ id: 'abc', name: 'x', artist: [] })
        expect(mapped.url).toBe('abc')
        expect(mapped.pic).toBe('abc')
        expect(mapped.lrc).toBe('abc')
    })

    it('非对象返回 null，便于调用方过滤', () => {
        expect(mapSong(null)).toBeNull()
        expect(mapSong('晴天')).toBeNull()
        expect(mapSong(undefined)).toBeNull()
    })
})

describe('provider 注册与状态', () => {
    it('SUPPORT_TYPE 覆盖 8 种类型', () => {
        expect([...SUPPORT_TYPE].sort()).toEqual(
            ['album', 'artist', 'lrc', 'pic', 'playlist', 'search', 'song', 'url'].sort()
        )
    })

    it('createProvider 产出 support_type / status / handle', () => {
        const provider = createProvider('kugou')
        expect(provider.support_type).toEqual(SUPPORT_TYPE)
        expect(provider.status).toBe('ok')
        expect(typeof provider.handle).toBe('function')
    })

    it('注册表包含 5 个平台', () => {
        const providers = new Providers()
        expect(providers.get_provider_list()).toEqual(
            expect.arrayContaining(['netease', 'tencent', 'kugou', 'baidu', 'kuwo'])
        )
        expect(providers.get_provider_list()).toHaveLength(5)
    })

    it('kugou 标记为可用，baidu / kuwo 标记为上游不可用并给出原因', () => {
        const providers = new Providers()
        expect(providers.get('kugou').status).toBe('ok')
        for (const server of ['baidu', 'kuwo']) {
            const provider = providers.get(server)
            expect(provider.status).toBe('down')
            expect(provider.statusNote.length).toBeGreaterThan(10)
        }
    })

    it('每个平台都声明了 support_type 与 handle', () => {
        const providers = new Providers()
        for (const server of providers.get_provider_list()) {
            const provider = providers.get(server)
            expect(Array.isArray(provider.support_type)).toBe(true)
            expect(provider.support_type.length).toBeGreaterThan(0)
            expect(typeof provider.handle).toBe('function')
        }
    })
})

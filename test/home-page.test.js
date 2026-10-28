/**
 * 首页内容回归（不联网、不依赖外部音乐平台）
 *
 * 盯住两件容易被改坏的事：
 *   1. 首屏「接口地址」的标签文案（历史文案是「你的接口地址」）；
 *   2. 音质档位表必须与 /api 实际接受的取值一一对应，且每档都有说明，
 *      不能出现「接口能收、页面没写」的漂移。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { homePage } from '../src/home-page.js'
import { QUALITY_VALUES, DEFAULT_QUALITY, qualityAliasesOf } from '../src/service/quality-values.js'
import { QUALITY_LEVELS, qualityCountLabel } from '../src/pages/home/quality.js'

let html = ''

beforeAll(async () => {
    const app = new Hono()
    app.get('/', homePage)
    const res = await app.request('http://example.test/', { headers: { host: 'example.test' } })
    expect(res.status).toBe(200)
    html = await res.text()
})

describe('首页首屏', () => {
    it('接口地址标签用「接口地址」，不再用「你的接口地址」', () => {
        expect(html).toContain('<span class="endpoint-label">接口地址</span>')
        expect(html).not.toContain('你的接口地址')
    })

    it('首屏音质写成完整区间，而不是只提 128k / 320k', () => {
        expect(html).toContain('128k / 192k / 320k / 无损 / Hi-Res')
    })

    it('「八档音质」这类文案跟着取值表走', () => {
        expect(QUALITY_VALUES).toHaveLength(8)
        expect(qualityCountLabel()).toBe('八档')
        expect(html).toContain('八档音质')
    })
})

describe('音质档位表', () => {
    it('接口接受的每一档都在表里', () => {
        for (const value of QUALITY_VALUES) {
            expect(html).toContain(`<code class="quality-value">${value}</code>`)
        }
        expect(html.match(/<code class="quality-value">/g)).toHaveLength(QUALITY_VALUES.length)
    })

    it('每一档都写了说明，没有落到兜底行', () => {
        expect(QUALITY_LEVELS.map(level => level.value)).toEqual(QUALITY_VALUES)
        for (const level of QUALITY_LEVELS) {
            expect(level.label).not.toBe(level.value)
            expect(level.netease).not.toBe('—')
            expect(level.tencent).not.toBe('—')
            expect(level.access.length).toBeGreaterThan(0)
        }
    })

    it('默认档与 /api 一致，且在表里被标出来', () => {
        expect(DEFAULT_QUALITY).toBe('standard')
        expect(html).toContain('<span class="quality-default">默认</span>')
    })

    it('简写全部列出', () => {
        for (const alias of ['128', '192', '320', 'hq', 'flac', 'sq', 'hi-res', 'hr', 'effect', 'master']) {
            expect(html).toContain(`<code>${alias}</code>`)
        }
        expect(qualityAliasesOf('lossless')).toEqual(['lossless', 'flac', 'sq'])
    })

    it('说明覆盖关键行为：只对 url 生效、非法值 400、静默回落、无直链 404、其他平台忽略', () => {
        expect(html).toContain('只对 <code>type=url</code> 生效')
        expect(html).toContain('传了表外的值直接 400')
        expect(html).toContain('X-Audio-Quality-Actual')
        expect(html).toContain('X-Audio-Bitrate')
        expect(html).toContain('no url')
        expect(html).toContain('酷狗 / 百度 / 酷我 目前忽略 quality')
    })
})

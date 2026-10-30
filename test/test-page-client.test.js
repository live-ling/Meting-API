/**
 * /test 试听页交互行为回归（不联网）
 *
 * client.js 被 toString() 内联进 HTML，无法用纯函数测；这里用一个最小的假 DOM
 * 直接调用 mountTestPage，盯住这次改动的核心行为：
 *   1. 首屏自动加载默认数据源；
 *   2. 连播：非最后一首播完自动切下一首；最后一首播完停在当前曲；
 *   3. 429 冷却只写工作台状态，且不再自动重试；
 *   4. 预设平台不可用时不静默沿用上一个平台；
 *   5. 换源 / 重载会先停掉当前播放，界面重置干净。
 *
 * 假 DOM / Audio 实现见 test/support/test-page-dom.js。
 */
import { describe, it, expect, vi } from 'vitest'
import { createTestCore } from '../src/pages/test/core.js'
import { mountTestPage } from '../src/pages/test/client.js'
import { buildRoot, makeDoc, makeEnv, jsonResponse, twoSongs, flush, sleep } from './support/test-page-dom.js'

describe('test page client behavior', () => {
    it('首屏自动加载默认数据源（网易云歌单 2877205781）', async () => {
        const fetcher = vi.fn(async () => jsonResponse(twoSongs()))
        const doc = makeDoc()
        buildRoot(doc)
        const env = makeEnv(fetcher)
        mountTestPage(createTestCore(), doc, env)
        await flush()

        expect(fetcher).toHaveBeenCalledTimes(1)
        const url = fetcher.mock.calls[0][0]
        expect(url).toContain('server=netease')
        expect(url).toContain('type=playlist')
        expect(url).toContain('id=2877205781')

        const status = doc._root.querySelector('[data-ui="status"]')
        expect(status.textContent).toBe('数据已加载；请选择曲目。')
        expect(doc._root.querySelector('[data-ui="list"]').children).toHaveLength(2)
    })

    it('连播：非最后一首播完自动切下一首', async () => {
        const fetcher = vi.fn(async () => jsonResponse(twoSongs()))
        const doc = makeDoc()
        const { ui } = buildRoot(doc)
        const env = makeEnv(fetcher)
        const { audio } = mountTestPage(createTestCore(), doc, env)
        await flush()

        ui.list.children[0].dispatch('click', {})
        await flush()
        expect(ui.play.disabled).toBe(false)
        ui.play.dispatch('click', {})
        await sleep(1700); await flush()
        expect(audio.getAttribute('src')).toBe('https://e.test/a.mp3')

        audio.dispatch('ended', {})
        await sleep(1700); await flush()
        expect(audio.getAttribute('src')).toBe('https://e.test/b.mp3')
    })

    it('连播：最后一首播完停在当前曲', async () => {
        const fetcher = vi.fn(async () => jsonResponse(twoSongs()))
        const doc = makeDoc()
        const { ui } = buildRoot(doc)
        const env = makeEnv(fetcher)
        const { audio } = mountTestPage(createTestCore(), doc, env)
        await flush()

        ui.list.children[1].dispatch('click', {})
        await flush()
        ui.play.dispatch('click', {})
        await sleep(1700); await flush()
        expect(audio.getAttribute('src')).toBe('https://e.test/b.mp3')

        audio.dispatch('ended', {})
        await flush()
        expect(ui.status.textContent).toBe('已播到最后一首。')
        expect(audio.getAttribute('src')).toBe('https://e.test/b.mp3')
    })

    it('429 冷却只写工作台状态，且不自动重试', async () => {
        const fetcher = vi.fn(async () => ({ ok: false, status: 429, headers: { get: () => '2' }, json: async () => ({}) }))
        const doc = makeDoc()
        const { ui } = buildRoot(doc)
        const env = makeEnv(fetcher)
        mountTestPage(createTestCore(), doc, env)
        await flush()

        expect(fetcher).toHaveBeenCalledTimes(1)
        expect(ui.status.textContent).toContain('冷却')

        ui.load.dispatch('click', {})
        await flush()
        expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('预设平台不可用时不静默沿用上一个平台', async () => {
        const fetcher = vi.fn(async () => jsonResponse(twoSongs()))
        const doc = makeDoc()
        const { ui, root } = buildRoot(doc, {
            servers: [
                { value: 'netease', support: 'song,playlist,album,artist,search', checked: true },
                { value: 'tencent', support: '', disabled: true },
            ],
            types: [{ value: 'playlist', checked: true }],
        })
        const preset = doc.createElement('button')
        preset.setAttribute('data-source-ui', 'preset')
        preset.setAttribute('data-preset-server', 'tencent')
        preset.setAttribute('data-preset-type', 'playlist')
        preset.setAttribute('data-preset-id', '123')
        root.appendChild(preset)

        const env = makeEnv(fetcher)
        mountTestPage(createTestCore(), doc, env)
        await flush()
        expect(fetcher).toHaveBeenCalledTimes(1)

        preset.dispatch('click', {})
        await flush()
        expect(fetcher).toHaveBeenCalledTimes(1)
        expect(ui.status.textContent).toContain('不可用')
        expect(root.dataset.server).toBe('netease')
    })

    it('换源 / 重载会先停掉当前播放并重置界面', async () => {
        const fetcher = vi.fn(async () => jsonResponse(twoSongs()))
        const doc = makeDoc()
        const { ui, root, servers } = buildRoot(doc, {
            servers: [
                { value: 'netease', label: '网易云音乐', support: 'song,playlist,album,artist,search', checked: true },
                { value: 'tencent', label: 'QQ 音乐', support: 'song,playlist', checked: false },
            ],
            types: [{ value: 'playlist', label: '歌单', checked: true }],
        })
        const env = makeEnv(fetcher)
        const { audio } = mountTestPage(createTestCore(), doc, env)
        await flush()

        ui.list.children[0].dispatch('click', {})
        await flush()
        ui.play.dispatch('click', {})
        await sleep(1700); await flush()
        expect(audio.paused).toBe(false)
        expect(audio.getAttribute('src')).toBe('https://e.test/a.mp3')

        // 切到另一个平台并重新载入：必须先停当前播放
        servers[0].checked = false   // 真 DOM 里选 radio 会自动取消同组其它项
        servers[1].checked = true
        servers[1].dispatch('change', {})
        ui.load.dispatch('click', {})
        await sleep(1700); await flush()

        expect(audio.paused).toBe(true)
        expect(audio.getAttribute('src')).toBe('')
        expect(root.dataset.server).toBe('tencent')
        // 展示名跟着选中项刷新，供 load 重置工作台时回填
        expect(root.dataset.serverLabel).toBe('QQ 音乐')
        expect(root.dataset.typeLabel).toBe('歌单')
        expect(ui.status.textContent).toBe('数据已加载；请选择曲目。')
        expect(ui.title.textContent).toBe('A')
        expect(ui.list.children).toHaveLength(2)
    })
})

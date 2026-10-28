/**
 * 管理后台页面结构回归：
 * - 设置页按分类拆成选项卡，每个面板只放两张卡片，避免挤成一长列；
 * - 侧栏收起按钮位于左下角，手机端仍由顶栏汉堡按钮打开；
 * - API 调用日志不再重复显示页面标题。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-admin-ui-'))
process.env.DATA_DIR = TEST_DATA_DIR

let html = ''

const panelChunk = (name) => {
    const start = html.indexOf(`id="settingsPanel${name}"`)
    if (start === -1) return ''
    const nextStarts = ['Account', 'Security', 'Integrations', 'Cache']
        .map((n) => html.indexOf(`id="settingsPanel${n}"`))
        .filter((i) => i > start)
        .sort((a, b) => a - b)
    return html.slice(start, nextStarts[0] ?? html.indexOf('id="cookieModal"', start))
}

beforeAll(async () => {
    const { Hono } = await import('hono')
    const { adminPageHandler } = await import('../src/admin/page.js')
    const app = new Hono()
    app.get('/admin', adminPageHandler)
    html = await (await app.request('/admin')).text()
})

afterAll(() => {
    try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }) } catch {}
})

describe('管理后台设置页选项卡', () => {
    it('设置页有四个分类选项卡与对应面板', () => {
        expect((html.match(/class="settings-tab(?![a-z-])/g) || []).length).toBe(4)
        expect((html.match(/class="settings-panel(?![a-z-])/g) || []).length).toBe(4)
        expect(html).toContain('data-settings-panel="Account"')
        expect(html).toContain('data-settings-panel="Security"')
        expect(html).toContain('data-settings-panel="Integrations"')
        expect(html).toContain('data-settings-panel="Cache"')
    })

    it('每个分类只放两张卡片，不再把六张卡挤在一起', () => {
        for (const name of ['Account', 'Security', 'Integrations', 'Cache']) {
            const chunk = panelChunk(name)
            expect(chunk, name).not.toBe('')
            expect((chunk.match(/class="card settings-section"/g) || []).length, name).toBe(2)
        }
        // 整页四个分类网格，而不是一个大网格
        expect((html.match(/class="settings-grid"/g) || []).length).toBe(4)
    })

    it('默认只展开账户面板', () => {
        expect(html).toContain('class="settings-panel active" id="settingsPanelAccount"')
        expect(html).toContain('class="settings-panel" id="settingsPanelSecurity"')
        expect(html).toContain('class="settings-panel" id="settingsPanelIntegrations"')
        expect(html).toContain('class="settings-panel" id="settingsPanelCache"')
    })
})

describe('侧栏与 API 日志标题', () => {
    it('收起按钮在侧栏底部的 sidebar-foot 里', () => {
        const footStart = html.indexOf('class="sidebar-foot"')
        const toggle = html.indexOf('id="navToggle"')
        const menuEnd = html.indexOf('</ul>', html.indexOf('class="sidebar-menu"'))
        expect(footStart).toBeGreaterThan(menuEnd)
        expect(toggle).toBeGreaterThan(footStart)
        expect(html).toContain('class="nav-toggle sidebar-toggle"')
    })

    it('顶栏只保留手机端汉堡按钮，不再放桌面收起按钮', () => {
        const headerStart = html.indexOf('class="header-title"')
        const headerEnd = html.indexOf('</div>', headerStart)
        const header = html.slice(headerStart, headerEnd)
        expect(header).toContain('navToggleMobile')
        expect(header).not.toContain('id="navToggle"')
    })

    it('API 调用日志页面不再重复标题', () => {
        const start = html.indexOf('id="apilogsSection"')
        const end = html.indexOf('id="settingsSection"')
        const section = html.slice(start, end)
        expect(section).not.toContain('API 调用日志')
        // 页面顶部标题仍然保留
        expect(html).toContain("apilogs: 'API 调用日志'")
    })
})

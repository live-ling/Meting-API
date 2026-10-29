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

    it('日志分页与长文本压缩结构存在', () => {
        expect(html).toContain('id="logsPagination"')
        expect(html).toContain('id="monitorLogPagination"')
        expect(html).toContain('table-api-logs')
        expect(html).toContain('table-scroll-y')
        expect(html).toContain('cell-clip-type')
        expect(html).toContain('cell-clip-song')
    })
})

describe('API 日志按 IP 折叠与归属地展示', () => {
    it('默认按 IP 折叠，聚合行不再显示平台和类型', () => {
        expect(html).toContain('id="apiLogGroupByIp"')
        expect(html).toContain('id="apiLogsHead"')
        expect(html).toContain('API_LOG_GROUP_HEAD')
        expect(html).toContain('<th>最近调用</th><th>IP 地址</th><th>归属地</th>')
        // 详情表移除归属地列，归属地改由大标题展示
        expect(html).toContain('<th>时间</th><th>平台</th><th>类型</th><th>请求 ID</th>')
        expect(html).toContain('api-log-detail-geo-title')
    })

    it('展开详情与归属地轮询逻辑存在', () => {
        expect(html).toContain('toggleApiLogGroup')
        expect(html).toContain('fetchApiLogDetail')
        expect(html).toContain('data-more-ip')
        expect(html).toContain('ipExact')
        expect(html).toContain('geoPending')
    })

    it('设置页有可排序、可独立启用的多通道列表', () => {
        expect(html).toContain('id="geoProviderList"')
        expect(html).toContain('renderGeoProviderList')
        expect(html).toContain('moveGeoProvider')
        expect(html).toContain('collectGeoProviders')
        expect(html).toContain('testGeoProvider')
        expect(html).toContain("p.supportsIPv4 !== false ? 'IPv4' : ''")
        expect(html).toContain("join(' / ')")
        expect(html).toContain('data-geo-action="edit-key"')
        expect(html).toContain('geo-provider-buttons')
        expect(html).toContain('geo-provider-doc')
        expect(html).toContain('border-radius: 999px')
    })

    it('API 日志每一项都有独立圆角卡片样式', () => {
        expect(html).toContain('border-spacing: 0 8px')
        expect(html).toContain('.table-api-logs > tbody > tr > td:first-child')
        expect(html).toContain('border-radius: var(--radius) 0 0 var(--radius)')
        expect(html).toContain('border-radius: 0 var(--radius) var(--radius) 0')
        expect(html).toContain('.table-api-logs > tbody > tr.api-log-detail-row > td')
    })
})

describe('仪表盘图表与来源详情', () => {
    it('仪表盘有折线图、饼图与 24h / 7d / 30d 范围选择', () => {
        expect(html).toContain('id="dashboardRange"')
        expect(html).toContain('<option value="168">近 7 天</option>')
        expect(html).toContain('<option value="720">近 30 天</option>')
        expect(html).toContain('id="boardLineChart"')
        expect(html).toContain('id="boardLineNote"')
        expect(html).toContain('id="boardDonut"')
        expect(html).toContain('renderBoardLineChart')
        expect(html).toContain('renderBoardDonut')
        expect(html).toContain('legend-total')
        expect(html).toContain('donut-legend')
        expect(html).toContain('@keyframes chartDraw')
        expect(html).toContain("class=\"chart-line")
        expect(html).toContain('donut-seg')
    })

    it('来源分析用模态框展示详情并按来源筛选调用', () => {
        expect(html).toContain('id="refererLimit"')
        expect(html).toContain('id="refererSummary"')
        expect(html).toContain('id="refererModal"')
        expect(html).toContain('openRefererModal')
        expect(html).not.toContain('referer-detail-row')
        expect(html).not.toContain('toggleRefererRow')
        expect(html).toContain('data-referer-view')
        expect(html).toContain('id="apiLogReferer"')
        expect(html).toContain('renderRefererDetailHtml')
        expect(html).toContain('border-spacing: 0 7px')
        expect(html).toContain('.table-referers > tbody > tr > td:first-child')
    })

    it('缓存页有命中率与分类型 TTL 图表', () => {
        expect(html).toContain('id="cacheHitDonut"')
        expect(html).toContain('id="cacheTtlBars"')
        expect(html).toContain('renderCacheCharts')
        expect(html).toContain('cache-donut-seg')
        expect(html).toContain('cache-ttl-fill')
    })

    it('通知使用卡片式浅底而不是纯色背景', () => {
        expect(html).toContain('class="toast-icon"')
        expect(html).toContain('border-left-color: var(--success)')
        expect(html).toContain('border-left-color: var(--danger)')
        expect(html).not.toContain('background: #14664a')
        expect(html).not.toContain('.toast-success { background: var(--success); }')
    })
})

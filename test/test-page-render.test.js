/**
 * /test 试听页渲染契约（不联网）
 *
 * 盯住这次「首屏自动加载 + 连播」改动容易改坏的几件事：
 *   1. 顶部常驻冷却状态条 #request-status 必须彻底消失（含内联脚本里的引用）；
 *   2. 首屏文案从「尚未请求接口」变成「正在加载默认数据源」，默认源仍是网易云歌单；
 *   3. 工作台根元素要带上平台 / 类型的展示名，供 client.js 重置界面时回填；
 *   4. 歌词区的细滚动条必须显式 display:block，否则被全局 reset 盖住不显示。
 */
import { describe, it, expect } from 'vitest'
import { renderTestPage } from '../src/pages/test/layout.js'
import { renderSections } from '../src/pages/test/markup.js'
import { testPageStyles } from '../src/pages/test/styles.js'
import { createTestCore } from '../src/test-page/core.js'
import { mountTestPage } from '../src/pages/test/client.js'

const html = renderTestPage({
  sections: renderSections(),
  styles: testPageStyles,
  mount: mountTestPage,
  create: createTestCore,
})

describe('test page render contract', () => {
  it('移除了顶部常驻冷却状态条（DOM 与内联脚本都不引用）', () => {
    expect(html).not.toContain('#request-status')
    expect(html).not.toContain('id="request-status"')
  })

  it('首屏文案宣告自动加载默认数据源', () => {
    expect(html).toContain('正在加载默认数据源…')
    expect(html).not.toContain('尚未请求接口')
  })

  it('默认源仍是网易云歌单 2877205781', () => {
    expect(html).toContain('data-server="netease"')
    expect(html).toContain('data-type="playlist"')
    expect(html).toContain('data-id="2877205781"')
  })

  it('工作台根元素带平台 / 类型展示名，便于重置界面回填', () => {
    expect(html).toContain('data-server-label="网易云音乐"')
    expect(html).toContain('data-type-label="歌单"')
  })

  it('歌词区细滚动条显式 display:block，不被全局 reset 盖住', () => {
    expect(testPageStyles).toMatch(/\.lyr-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*block/)
  })

  it('工作台仍只有一个 data-ui 根，控件钩子完整', () => {
    const roots = html.match(/<article class="player"[^>]*data-server="[^"]*"/g) || []
    expect(roots).toHaveLength(1)
    const ui = [...new Set([...html.matchAll(/data-ui="([^"]+)"/g)].map(m => m[1]))]
    expect(ui.sort()).toEqual(['artist', 'cover', 'coverNote', 'list', 'load', 'lyrics', 'next', 'prev', 'play', 'seek', 'status', 'time', 'title'].sort())
  })
})

import example from './example.js'
import { icon } from './icons.js'
import css from './test-page/styles.js'
import { createTestCore } from './test-page/core.js'
import { mountTestPage } from './test-page/client.js'

const platformImages = {}
if (globalThis.process?.versions?.node) {
    const fs = await import('fs/promises')
    const path = await import('path')
    const { fileURLToPath } = await import('url')
    const iconDir = path.dirname(fileURLToPath(import.meta.url)).replace(/[\\/]src$/, '')
    for (const [provider, file] of Object.entries({ netease: 'netease-music.png', tencent: 'qq-music.png' })) {
        try {
            const buffer = await fs.readFile(path.join(iconDir, 'icon', file))
            platformImages[provider] = `data:image/png;base64,${buffer.toString('base64')}`
        } catch { platformImages[provider] = '' }
    }
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const platformNames = { netease: '网易云音乐', tencent: 'QQ 音乐' }
const typeNames = { playlist: '歌单', song: '单曲', artist: '歌手', search: '搜索' }
const sections = Object.entries(example).map(([provider, examples]) => {
    const items = Object.entries(examples).filter(([, item]) => item.show)
    const cards = items.map(([type, item]) => `<article class="player-card" data-server="${escape(provider)}" data-type="${escape(type)}" data-id="${escape(item.value)}">
        <div class="card-head"><div><h3>${escape(typeNames[type] || type)}试听</h3><div class="descriptor">/api · server=${escape(provider)} · type=${escape(type)} · id=${escape(item.value)}</div></div><button type="button" data-ui="load">加载示例</button></div>
        <div class="card-body">
            <div class="record-wrap"><div class="record" aria-hidden="true"><div class="record-label"><span>METING</span><img data-ui="cover" alt="" hidden></div></div><div class="cover-note" data-ui="coverNote">封面来自当前曲目的 API 响应</div></div>
            <div class="track-info"><div class="eyebrow">ON THE RECORD</div><h4 class="track-title" data-ui="title">等待载入音乐</h4><p class="artist" data-ui="artist">${escape(platformNames[provider] || provider)} · ${escape(typeNames[type] || type)}</p>
                <div class="transport"><button type="button" data-ui="prev" aria-label="上一首" disabled>上一首</button><button type="button" class="play" data-ui="play" aria-label="播放或暂停" disabled>播放</button><button type="button" data-ui="next" aria-label="下一首" disabled>下一首</button></div>
                <input class="seek" data-ui="seek" type="range" min="0" max="1" step="0.1" value="0" aria-label="播放进度，秒" disabled><output class="time" data-ui="time">0:00 / 0:00</output>
                <select class="song-list" data-ui="list" aria-label="选择曲目" disabled><option>加载后显示接口曲目</option></select>
            </div>
            <div class="lyrics-pane"><div class="lyrics-caption">LYRICS / 点击歌词定位</div><div class="lyrics" data-ui="lyrics" tabindex="0" role="region" aria-label="滚动歌词">音乐尚未加载。\n\n选择一张唱片，让歌词随音乐展开。</div></div>
        </div><div class="card-status" data-ui="status" role="status">尚未请求接口 · 点击“加载示例”获取真实曲目</div>
    </article>`).join('')
    return `<section><div class="platform-header">${platformImages[provider] ? `<img src="${platformImages[provider]}" alt="${escape(platformNames[provider])}">` : icon('music')}<h2>${escape(platformNames[provider] || provider)}</h2><span>${items.length} 个示例</span></div><div class="players-grid">${cards}</div></section>`
}).join('')

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>音乐试听实验室 · Meting API</title><style>${css}</style></head><body>
<header class="topbar"><div class="topbar-inner"><div class="brand">Meting API <small>音乐试听实验室</small></div><a href="/">返回首页 ↗</a></div></header>
<main><div class="intro"><div><div class="eyebrow">LISTENING ROOM / API TEST</div><h1>把接口，放上唱机。</h1><p>从真实响应中读取曲目、封面与歌词。按下播放，让唱片转起来，也让每一句歌词找到它的时间。</p></div><p class="policy">首次打开不请求音乐接口。每个示例独立加载，全页共享一个播放器。切歌不自动播放，播放结束不自动续播。</p></div>
<div id="request-status" role="status">按需加载 · 请求串行间隔 ≥ 1.5 秒 · 不自动重试</div>${sections}</main>
<footer>Powered by <a href="https://github.com/mikus-loli/Meting-API" target="_blank" rel="noopener noreferrer">Meting-API</a> · 媒体错误无法判断 HTTP 429，失败后停止且不重试。</footer>
<script>(${mountTestPage.toString()})((${createTestCore.toString()})());</script></body></html>`
export const handler = c => c.html(html)

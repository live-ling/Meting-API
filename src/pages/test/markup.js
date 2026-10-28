import example from '../../example.js'
import { escapeHtml } from '../shared/html.js'
import { platformIcon, platformShortNames, platformNames, typeNames } from './platforms.js'
import { readCapabilities } from '../home/capabilities.js'

/**
 * /test 页面结构：印刷感三栏播放器（控制台 / 封套 / 歌词），队列与换源收进抽屉。
 *
 * 结构契约（与 client.js 严格对齐，改样式不改钩子）：
 * - 全页只有一个 `[data-server][data-type][data-id]` 根元素；
 * - 13 个 `data-ui` 控件：load / status / title / artist / cover / coverNote /
 *   play / prev / next / seek / time / list / lyrics；
 * - 换源控件用 `data-source-ui`：server / type / id / url / descriptor / preset /
 *   trackCount / drawer / drawerOpen / drawerSource / drawerClose / drawerBackdrop；
 * - 抽屉内用 `data-drawer-tab-btn` 切换「队列 / 换源」；
 * - 首屏没有任何已加载数据，也不发起请求。
 */

const LIST_TYPES = ['song', 'playlist', 'album', 'artist', 'search']

/** 默认数据源：优先网易云歌单（只预填，不请求） */
function defaultSource(data) {
    const preferred = data?.netease?.playlist
    if (preferred?.show) {
        return { server: 'netease', type: 'playlist', id: String(preferred.value) }
    }
    for (const [provider, items] of Object.entries(data)) {
        for (const [type, item] of Object.entries(items)) {
            if (item?.show && LIST_TYPES.includes(type)) {
                return { server: provider, type, id: String(item.value) }
            }
        }
    }
    return { server: 'tencent', type: 'playlist', id: '' }
}

function presetItems(data) {
    return Object.entries(data).flatMap(([provider, items]) =>
        Object.entries(items)
            .filter(([type, item]) => item?.show && LIST_TYPES.includes(type))
            .map(([type, item]) => ({ provider, type, id: String(item.value) })))
}

/** 换源面板 */
function renderSourcePanel({ source, capabilities, data }) {
    const columns = capabilities.columns.filter(column => platformNames[column.id])
    const servers = columns.map(column => {
        const down = column.status === 'down'
        const checked = column.id === source.server ? ' checked' : ''
        const disabled = down ? ' disabled' : ''
        const label = escapeHtml(platformNames[column.id] || column.id)
        return `<label class="chip${down ? ' is-off' : ''}">
                    <input type="radio" name="src-server" value="${escapeHtml(column.id)}"
                        data-source-ui="server" data-support="${escapeHtml(column.types.join(','))}"${checked}${disabled}>
                    <span class="chip-text">${platformIcon(column.id, 16)}${label}</span>
                </label>`
    }).join('\n                ')

    const types = LIST_TYPES.map(type => {
        const column = columns.find(item => item.id === source.server)
        const usable = column ? column.types.includes(type) : true
        const checked = type === source.type ? ' checked' : ''
        const disabled = usable ? '' : ' disabled'
        return `<label class="chip${usable ? '' : ' is-off'}">
                    <input type="radio" name="src-type" value="${escapeHtml(type)}"
                        data-source-ui="type"${checked}${disabled}>
                    <span class="chip-text">${escapeHtml(typeNames[type] || type)}</span>
                </label>`
    }).join('\n                ')

    const down = columns
        .filter(column => column.status === 'down')
        .map(column => platformNames[column.id] || column.id)
        .join('、')

    const presets = presetItems(data).map(item => {
        const platform = platformShortNames[item.provider] || item.provider
        const label = escapeHtml(typeNames[item.type] || item.type)
        return `<li>
                    <button type="button" class="preset" data-source-ui="preset"
                        data-preset-server="${escapeHtml(item.provider)}"
                        data-preset-type="${escapeHtml(item.type)}"
                        data-preset-id="${escapeHtml(item.id)}"
                        aria-label="载入 ${platformNames[item.provider] || item.provider} ${label} 示例 ${escapeHtml(item.id)}">
                        <span class="preset-name">${platformIcon(item.provider, 14)}<span>${escapeHtml(platform)} · ${label}</span></span>
                        <span class="preset-id">${escapeHtml(item.id)}</span>
                    </button>
                </li>`
    }).join('\n                ')

    return `<div class="source-panel">
            <fieldset class="source-group">
                <legend class="field-label">平台</legend>
                <div class="chip-row">
                ${servers}
                </div>
                ${down ? `<p class="fineprint">${escapeHtml(down)} 的上游已经不可用，先停用了。</p>` : ''}
            </fieldset>
            <fieldset class="source-group">
                <legend class="field-label">类型</legend>
                <div class="chip-row">
                ${types}
                </div>
                <p class="fineprint">选了 search 就在下面填关键词；url / lrc / pic 不返回曲目，去首页试。</p>
            </fieldset>
            <div class="source-group">
                <label class="field-label" for="src-id">ID / 关键词</label>
                <div class="id-row">
                    <input class="id-input" id="src-id" data-source-ui="id" type="text"
                        value="${escapeHtml(source.id)}" maxlength="256" spellcheck="false">
                    <button class="button button-primary" type="button" data-ui="load">载入</button>
                </div>
                <p class="fineprint">歌曲号、歌单号，或者搜一个词，中文也行。</p>
            </div>
            <p class="request-preview">
                <span class="field-label">请求</span>
                <code data-source-ui="url">GET /api?server=${escapeHtml(source.server)}&amp;type=${escapeHtml(source.type)}&amp;id=${escapeHtml(source.id)}</code>
            </p>
            <div class="preset-block">
                <p class="field-label">预设</p>
                <ul class="preset-list">
                ${presets}
                </ul>
            </div>
        </div>`
}

/**
 * 三栏播放器（全页唯一）。
 * data-ui 固定为：load / status / title / artist / cover / coverNote /
 * play / prev / next / seek / time / list / lyrics。
 */
export function renderPlayerCard({ source, capabilities, data }) {
    const platform = escapeHtml(platformNames[source.server] || source.server)
    const label = escapeHtml(typeNames[source.type] || source.type)
    return `<article class="player" data-drawer-tab="queue"
    data-server="${escapeHtml(source.server)}" data-type="${escapeHtml(source.type)}" data-id="${escapeHtml(source.id)}">

  <section class="deck" aria-label="播放控制">
    <div class="kicker">
      <span class="bar" aria-hidden="true"></span>
      <span class="kicker-text" data-ui="status">尚未请求接口 · 点右上角「换源」挑一个数据源</span>
      <span class="dot" aria-hidden="true"></span>
    </div>

    <h1 class="track-title">
      <span class="num" data-source-ui="descriptor">/api · server=${escapeHtml(source.server)} · type=${escapeHtml(source.type)} · id=${escapeHtml(source.id)}</span>
      <span class="title-text" data-ui="title">还没载入曲目</span>
    </h1>
    <p class="track-artist" data-ui="artist">${platform} · ${label}</p>
    <p class="track-meta"><span data-source-ui="trackCount"></span></p>

    <div class="progress-wrap">
      <input class="scrub" data-ui="seek" type="range" min="0" max="1" step="0.1" value="0"
        aria-label="播放进度，秒" disabled>
      <div class="times">
        <span class="time-note">进度</span>
        <output class="time-value" data-ui="time">0:00 / 0:00</output>
      </div>
    </div>

    <div class="transport" aria-label="播放控制">
      <button type="button" class="tbtn" data-ui="prev" aria-label="上一首" title="上一首" disabled></button>
      <button type="button" class="playbtn" data-ui="play" aria-label="播放或暂停"
        aria-pressed="false" title="播放" disabled>播放</button>
      <button type="button" class="tbtn" data-ui="next" aria-label="下一首" title="下一首" disabled></button>
    </div>

    <div class="deckrow">
      <div class="vol">
        <button type="button" class="vol-btn" id="mute" aria-label="静音" title="静音"></button>
        <input id="volume" type="range" min="0" max="1" step="0.01" value="1" aria-label="音量">
        <output id="volume-value" for="volume" class="vol-num">100%</output>
      </div>
    </div>
  </section>

  <section class="art" aria-label="封面">
    <div class="art-stage">
      <div class="art-vtext" aria-hidden="true">Side A · 33⅓ · Meting API</div>
      <div class="groove" aria-hidden="true"></div>
      <div class="plate" aria-hidden="true"></div>
      <figure class="sleeve">
        <img data-ui="cover" alt="" hidden>
        <span class="sleeve-empty" aria-hidden="true">METING<br>API</span>
        <figcaption class="sleeve-tag">METING · ARCHIVE</figcaption>
      </figure>
      <p class="cover-note" data-ui="coverNote">封面也是接口返回的</p>
    </div>
  </section>

  <section class="lyrics" aria-label="歌词">
    <header class="lyr-head">
      <h2>歌词</h2>
      <span>Lyrics</span>
    </header>
    <div class="lyr-scroll" data-ui="lyrics" tabindex="0" role="region" aria-label="滚动歌词">还没有歌词。

先载入一个数据源，再点播放。</div>
  </section>

  <div class="drawer-backdrop" data-source-ui="drawerBackdrop" hidden></div>
  <aside class="drawer" data-source-ui="drawer" role="dialog" tabindex="-1" aria-labelledby="drawer-title">
    <div class="drawer-head">
      <div>
        <h2 id="drawer-title">曲目</h2>
        <p><span data-source-ui="trackCount"></span></p>
      </div>
      <button class="icon-btn" type="button" data-source-ui="drawerClose" hidden aria-label="收起">×</button>
    </div>
    <div class="drawer-tabs" role="tablist" aria-label="抽屉面板">
      <button type="button" class="drawer-tab" role="tab" data-drawer-tab-btn="queue" aria-selected="true">队列</button>
      <button type="button" class="drawer-tab" role="tab" data-drawer-tab-btn="source" aria-selected="false">换源</button>
    </div>
    <div class="drawer-panel" data-drawer-panel="queue">
      <div class="plist" data-ui="list" role="group" aria-label="曲目单">
        <p class="plist-empty">载入后，这里的歌会列出来。</p>
      </div>
    </div>
    <div class="drawer-panel" data-drawer-panel="source">
      ${renderSourcePanel({ source, capabilities, data })}
    </div>
  </aside>
</article>`
}

export function renderSections(data = example) {
    const capabilities = readCapabilities()
    return renderPlayerCard({ source: defaultSource(data), capabilities, data })
}

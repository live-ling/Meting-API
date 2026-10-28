/**
 * 首页区块（小米官网式产品介绍页）
 *
 * 叙事顺序：一句话定位 → 真实接口形状 → 运行数据 → 为什么用它 → 能力参数
 * → 快速上手 → 响应约定 → AI 提示词。
 *
 * 与浏览器端脚本的契约（id 不变）：
 *   #base-url / #copy-base / #copy-base-status
 *   #stat-total / #stat-day / #stat-ips / #stat-success
 *   #ai-prompt / #copy-prompt / #copy-status / #prompt-modal / #open-prompt / #close-prompt
 */

import { escapeHtml } from '../shared/html.js'
import { platformIcon, platformShortNames } from '../test/platforms.js'
import example from '../../example.js'

const QUICK_START = [
    { server: 'netease', type: 'song', fallback: '473403185', title: '单曲', result: '一首歌的全部字段' },
    { server: 'netease', type: 'playlist', fallback: '6907557348', title: '歌单', result: '一个歌单里的所有歌' },
    { server: 'netease', type: 'url', fallback: '473403185', title: '播放地址', result: '302 跳到音频文件 · 可选音质' },
    { server: 'netease', type: 'lrc', fallback: '2015217630', title: '歌词', result: '纯文本 LRC' },
    { server: 'tencent', type: 'song', fallback: '002Rnpvi058Qdm', title: '单曲 · QQ 音乐', result: '换平台，参数不变' },
]

const FEATURES = [
    {
        title: '五个平台，一套参数',
        text: '网易云、QQ 音乐、酷狗、百度、酷我，用 server 参数切换，其余参数完全不变。',
    },
    {
        title: '三种返回形态，音质可选',
        text: '歌单返回 JSON 列表；url / pic 直接 302 到文件，url 还能按 128k / 320k / 无损取流；lrc 返回纯文本。',
    },
    {
        title: '缓存与限流已内置',
        text: '按类型分 TTL 缓存，命中打 X-Cache；被限流时返回 429 和 Retry-After，不静默失败。',
    },
    {
        title: '随处可部署',
        text: 'Node、Cloudflare Workers、Deno 同一份代码，接口地址跟着你访问的域名走。',
    },
]

const STAT_ITEMS = [
    { id: 'stat-total', label: '累计请求' },
    { id: 'stat-day', label: '近 24 小时' },
    { id: 'stat-ips', label: '近 24 小时 IP' },
    { id: 'stat-success', label: '近 24 小时成功' },
]

/** 响应预览：用真实字段名拼一个「产品图」，不伪造数据 */
const RESPONSE_PREVIEW = `[
  {
    "title": "海阔天空",
    "author": "Beyond",
    "url": "…/api?server=netease&amp;type=url&amp;id=347230",
    "pic": "…/api?server=netease&amp;type=pic&amp;id=347230",
    "lrc": "…/api?server=netease&amp;type=lrc&amp;id=347230"
  }
]`

/** 章节头：标题 + 右侧说明（小米式左标题、右注解） */
const sectionHead = ({ id, title, note }) => `<header class="section-head">
            <h2 id="${escapeHtml(id)}">${escapeHtml(title)}</h2>
            ${note ? `<p class="section-note">${note}</p>` : ''}
        </header>`

/** 首屏：定位 + 入口 + 接口地址 + 响应预览 */
export function heroSection({ base }) {
    return `<section class="hero" aria-labelledby="hero-title">
            <div class="hero-inner">
                <p class="hero-eyebrow">Meting API <span class="eyebrow-dot" aria-hidden="true"></span> 开放音乐数据接口</p>
                <h1 id="hero-title">一个请求，<br>把音乐接进你的产品。</h1>
                <p class="hero-lede">歌曲、歌单、歌词、封面与播放地址。五个平台，一套参数；
                    同一条链接还能按 128k / 320k / 无损选择音质，会员 Cookie 解锁更高规格。
                    返回的数据可以直接放进播放器，也可以直接给你自己的界面用。</p>
                <div class="hero-cta">
                    <a class="button button-primary" href="#quickstart">开始接入</a>
                    <a class="button button-ghost" href="/test">试听</a>
                </div>
                <div class="hero-endpoint">
                    <span class="endpoint-label">你的接口地址</span>
                    <code class="endpoint-value" id="base-url">${escapeHtml(base || '/')}</code>
                    <button class="button button-ghost button-sm" id="copy-base" type="button">复制</button>
                </div>
                <div class="status-line" id="copy-base-status" role="status" aria-live="polite"></div>
                <div class="hero-visual">
                    <div class="response-card">
                        <div class="response-head">
                            <span class="method">GET</span>
                            <code>/api?server=netease&amp;type=playlist&amp;id=…</code>
                            <span class="badge badge-ok">200</span>
                        </div>
                        <pre class="response-body">${RESPONSE_PREVIEW}</pre>
                        <div class="response-foot">
                            <span class="mini-chip">JSON 列表</span>
                            <span class="mini-chip">302 直链</span>
                            <span class="mini-chip">无损可选</span>
                            <span class="mini-chip">LRC 文本</span>
                            <span class="mini-chip">X-Cache: HIT</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>`
}

/** 运行数据：数字来自 /api/stats，取不到就显示「—」 */
export function statsSection() {
    const cells = STAT_ITEMS.map(item => `<div class="stat">
                    <strong id="${escapeHtml(item.id)}">—</strong>
                    <span>${escapeHtml(item.label)}</span>
                </div>`).join('\n                ')

    return `<section class="stats" id="stats" aria-labelledby="stats-title">
            <div class="stats-inner">
                <div class="stats-head">
                    <h2 id="stats-title">服务运行数据</h2>
                </div>
                <div class="stats-grid">
                    ${cells}
                </div>
            </div>
        </section>`
}

/** 产品卖点：四张纯文字卡片（不加图标） */
export function featureSection() {
    const items = FEATURES.map(item => `<li class="feature">
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${escapeHtml(item.text)}</p>
                </li>`).join('\n                ')

    return `<section class="section" id="features" aria-labelledby="features-title">
            ${sectionHead({
        id: 'features-title', title: '为什么用它',
    })}
            <ul class="feature-grid">
                ${items}
            </ul>
        </section>`
}

/** 快速上手：每条示例都是可直接打开的真实请求 */
export function quickStartSection({ base, capabilities }) {
    const items = QUICK_START
        .filter(item => capabilities.supports(item.server, item.type))
        .map((item, index) => {
            const id = example?.[item.server]?.[item.type]?.value || item.fallback
            const query = `server=${item.server}&type=${item.type}&id=${encodeURIComponent(id)}`
            const url = `${base}/api?${query}`
            const no = String(index + 1).padStart(2, '0')
            return `<li class="quick-item">
                    <div class="quick-top">
                        <span class="quick-no" aria-hidden="true">${no}</span>
                        <p class="quick-label">${escapeHtml(item.title)}
                            <span class="quick-result">${escapeHtml(item.result)}</span></p>
                    </div>
                    <div class="quick-row">
                        <code class="quick-url">GET ${escapeHtml(url)}</code>
                        <a class="button button-ghost button-sm" href="${escapeHtml(url)}"
                            target="_blank" rel="noopener noreferrer">打开</a>
                    </div>
                </li>`
        }).join('\n                ')

    return `<section class="section" id="quickstart" aria-labelledby="quickstart-title">
            ${sectionHead({
        id: 'quickstart-title', title: '快速上手',
        note: '把 id 换成你自己的就能用。标了 302 的链接会直接跳转到音频或图片文件；音频链接可追加 quality=lossless 等参数。',
    })}
            <ol class="quick-list">
                ${items}
            </ol>
        </section>`
}

/** 能力参数：小米参数表式的 server × type 矩阵 */
export function capabilitySection(capabilities) {
    const head = capabilities.columns.map(column => {
        const down = column.status === 'down' ? ' is-down' : ''
        const short = platformShortNames[column.id] || column.label
        return `<th scope="col" class="${down}">
                            <span class="platform-name">${platformIcon(column.id, 16)}<span class="name-full">${escapeHtml(column.label)}</span><span class="name-short">${escapeHtml(short)}</span></span>
                            <span class="platform-id">${escapeHtml(column.id)}</span>
                        </th>`
    }).join('')

    const body = capabilities.rows.map(row => {
        const cells = row.cells.map(cell => {
            const text = cell.supported ? '支持' : '不支持'
            const mark = cell.supported
                ? '<span class="mark-yes" aria-hidden="true">✓</span>'
                : '<span class="mark-no" aria-hidden="true">×</span>'
            return `<td data-provider="${escapeHtml(cell.label)}">${mark}<span class="visually-hidden">${text}</span></td>`
        }).join('')
        return `<tr>
                        <th scope="row"><code>${escapeHtml(row.type)}</code></th>
                        ${cells}
                    </tr>`
    }).join('\n                    ')

    const degraded = (capabilities.degraded || []).map(item => {
        const danger = item.status === 'down'
        return `<li><span class="tag ${danger ? 'tag-danger' : 'tag-warn'}">${danger ? '不可用' : '注意'}</span>` +
            `<code>${escapeHtml(item.id)}</code>（${escapeHtml(item.label)}）：${escapeHtml(item.note)}</li>`
    }).join('')

    return `<section class="section section-gray" id="capabilities" aria-labelledby="capabilities-title">
            ${sectionHead({
        id: 'capabilities-title', title: '能力参数',
    })}
            <p class="scroll-hint">← 左右滑动查看全部平台 →</p>
            <div class="table-wrap" tabindex="0" role="region" aria-label="server 与 type 支持矩阵，可横向滚动">
                <table class="spec-table">
                    <thead>
                        <tr>
                            <th scope="col" class="type-col">类型</th>
                            ${head}
                        </tr>
                    </thead>
                    <tbody>
                    ${body}
                    </tbody>
                </table>
            </div>
            <ul class="spec-notes">
                ${degraded}
                <li><code>type=url</code> 302 跳到音频地址；可选 <code>quality=standard|higher|exhigh|lossless|hires|jymaster</code>，实际可用音质取决于平台、会员权限与曲库。</li>
                <li>若返回以 <code>@</code> 开头的文本，那是特殊值，不能当音频用。</li>
                <li><code>type=pic</code> 302 跳到封面图片。</li>
                <li><code>type=lrc</code> 返回歌词原文，用 <code>response.text()</code> 读。</li>
                <li>其余类型返回一组歌曲数据，每条都带 title / author / url / pic / lrc。</li>
                <li>表里是「平台支持什么」，不代表「现在一定取得到」：上游异常会返回 502 和原因。</li>
            </ul>
        </section>`
}

/** 响应约定：字段表 + 返回形态 */
export function contractSection() {
    return `<section class="section" id="contract" aria-labelledby="contract-title">
            ${sectionHead({
        id: 'contract-title', title: '响应约定',
    })}
            <div class="contract-grid">
                <article class="contract-card">
                    <h3>歌曲字段</h3>
                    <dl class="spec-list">
                        <div><dt>title</dt><dd>歌名。</dd></div>
                        <div><dt>author</dt><dd>歌手，多个歌手用 “ / ” 隔开。</dd></div>
                        <div><dt>url</dt><dd>播放地址；也可能是指向本 API 的 <code>type=url</code> 链接，
                            可追加 <code>quality=standard|higher|exhigh|lossless|hires|jymaster</code>，
                            或以 <code>@</code> 开头的特殊值。</dd></div>
                        <div><dt>pic</dt><dd>封面地址；也可能是指向本 API 的 <code>type=pic</code> 链接。</dd></div>
                        <div><dt>lrc</dt><dd>歌词；可能是 <code>type=lrc</code> 链接，也可能是以 <code>@</code> 开头的歌词原文。</dd></div>
                    </dl>
                </article>
                <article class="contract-card">
                    <h3>返回形态</h3>
                    <ol class="note-list">
                        <li>song / playlist / album / artist / search：返回一组数据，顺序与请求的 id 一致。</li>
                        <li>lrc：返回歌词原文，用 <code>response.text()</code> 读。</li>
                        <li>url / pic：302 跳转，跟着跳就能拿到音频或图片。</li>
                        <li>参数不对、没有可用地址、服务出错：分别返回 400 / 403 / 500 的 JSON。</li>
                        <li>字段值有时是字符串、有时是数组，拿到什么处理什么，别写死。</li>
                    </ol>
                </article>
            </div>
        </section>`
}

/** AI 提示词：横幅 + 弹窗（无脚本时弹窗内容内联可见） */
export function promptSection({ prompt }) {
    return `<section class="section" id="prompt" aria-labelledby="prompt-title">
            <div class="prompt-banner">
                <div class="prompt-copy">
                    <h2 id="prompt-title">让 AI 直接写好接入代码</h2>
                    <p>提示词里已经填好当前地址和真实支持范围，复制给 AI，
                        它就知道该怎么请求、怎么处理三种返回形态。</p>
                </div>
                <button class="button button-primary" id="open-prompt" type="button" hidden>查看并复制</button>
            </div>
            <div class="modal" id="prompt-modal" role="dialog" aria-modal="true" tabindex="-1"
                aria-labelledby="prompt-modal-title">
                <div class="modal-card">
                    <div class="modal-head">
                        <div class="modal-title">
                            <h3 id="prompt-modal-title">集成提示词</h3>
                            <p class="modal-sub">接口事实、运行规则、验收清单都在里面，整段复制给 AI 助手即可。</p>
                        </div>
                        <button class="button button-ghost button-sm" id="close-prompt" type="button" hidden>关闭</button>
                    </div>
                    <label class="visually-hidden" for="ai-prompt">供 AI 使用的完整提示词</label>
                    <textarea id="ai-prompt" readonly spellcheck="false">${escapeHtml(prompt)}</textarea>
                    <div class="modal-foot">
                        <div class="status-line" id="copy-status" role="status" aria-live="polite"></div>
                        <button class="button button-primary" id="copy-prompt" type="button">复制提示词</button>
                    </div>
                </div>
            </div>
        </section>`
}

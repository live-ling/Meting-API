/**
 * 首页骨架（小米官网式）
 *
 * 只负责 <head> / 顶栏 / <main> / 页脚 / 内联脚本的拼装：
 * 设计令牌与样式一起内联，页面仍然是「一次请求、一份 HTML」，没有静态资源。
 */

import { escapeHtml } from '../shared/html.js'
import { designTokens } from '../shared/tokens.js'
import { logoDataUri } from '../shared/logo.js'
import styles from './styles.js'

const TITLE = 'Meting API · 开放音乐数据接口'
const DESCRIPTION = '一个 GET 请求拿到歌曲、歌单、歌词、封面与播放地址，支持 128k / 320k / 无损 / Hi-Res / 母带共八档音质。五个平台、一套参数、内置缓存与限流。'

const HEADER_LINKS = [
    { href: '/', label: '首页' },
    { href: '/test', label: '试听' },
]

const FOOTER_LINKS = [
    { href: '/test', label: '试听' },
    { href: 'https://github.com/live-ling/Meting-API', label: 'GitHub', external: true },
]

const navLink = (item) => {
    const external = item.external ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${escapeHtml(item.href)}"${external}>${escapeHtml(item.label)}</a>`
}

/**
 * @param {{ main: string, script: string, base?: string }} input
 *   main 为 <main> 内部 HTML，script 为内联脚本源码，base 为站点根地址（用于 canonical / og:url）
 */
export function renderLayout({ main, script, base = '' }) {
    const headerLinks = HEADER_LINKS.map(item => navLink(item)).join('\n                    ')
    const footerLinks = FOOTER_LINKS.map(item => `<li>${navLink(item)}</li>`).join('\n                    ')
    const canonical = base ? `${base}/` : '/'
    const structuredData = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebAPI',
        name: 'Meting API',
        description: DESCRIPTION,
        url: canonical,
        documentation: canonical,
        provider: { '@type': 'Organization', name: 'Meting API' },
    })

    return `<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(TITLE)}</title>
    <meta name="description" content="${escapeHtml(DESCRIPTION)}">
    <meta name="robots" content="index,follow">
    <meta name="color-scheme" content="light">
    <meta name="theme-color" content="#f4f1ea">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Meting API">
    <meta property="og:title" content="${escapeHtml(TITLE)}">
    <meta property="og:description" content="${escapeHtml(DESCRIPTION)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:locale" content="zh_CN">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(TITLE)}">
    <meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}">
    <link rel="icon" type="image/png" href="${logoDataUri}">
    <script type="application/ld+json">${structuredData}</script>
    <style>
${designTokens}
${styles}
    </style>
</head>
<body>
    <a class="skip-link" href="#main">跳到主要内容</a>
    <header class="topbar">
        <div class="topbar-inner">
            <a class="brand" href="/">
                <img class="brand-logo" src="${logoDataUri}" alt="" width="24" height="24">
                Meting API <small>开放音乐数据接口</small>
            </a>
            <nav class="topnav" aria-label="站点导航">
                    ${headerLinks}
            </nav>
        </div>
    </header>
    <main class="page" id="main">
${main}
    </main>
    <footer class="page-footer">
        <div class="footer-inner">
            <p>© 2026 Meting API</p>
            <nav aria-label="页脚导航">
                <ul class="footer-links">
                    ${footerLinks}
                </ul>
            </nav>
        </div>
    </footer>
    <script>
${script}
    </script>
</body>
</html>`
}

export default renderLayout

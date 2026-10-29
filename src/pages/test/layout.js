/**
 * /test 页面骨架：顶栏 + 三栏播放器。
 *
 * 没有侧边导航，只保留品牌与「返回首页」；队列 / 换源入口在播放器控制台里。
 * 脚本不引用任何静态资源：两个纯函数在这里被 toString() 序列化后塞进 <script>。
 */
import { logoDataUri } from '../shared/logo.js'

export function renderTestPage({ sections, styles, mount, create }) {
    const script = `(${mount.toString()})((${create.toString()})())`
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex,follow">
<meta name="theme-color" content="#efe9dd">
<meta name="description" content="Meting API 试听：换一个数据源，用原生音频播放、滚动歌词与封面演示真实接口响应。">
<link rel="icon" type="image/png" href="${logoDataUri}">
<title>试听 · Meting API</title>
<style>${styles}</style>
</head>
<body>
<header class="topbar">
  <a class="brand" href="/">
    <img class="brand-logo" src="${logoDataUri}" alt="" width="22" height="22">
    <span>Meting API</span>
    <em>试听</em>
  </a>
  <nav class="topbar-actions" aria-label="站点导航">
    <button class="ghost" type="button" data-source-ui="drawerOpen" hidden>队列</button>
    <button class="ghost" type="button" data-source-ui="drawerSource" hidden>换源</button>
    <a class="ghost" href="/">返回首页</a>
  </nav>
</header>
<main id="main" class="stage">
  ${sections}
</main>
<noscript><p class="noscript-note">这页要靠 JavaScript 才能加载数据和放歌。</p></noscript>
<script>${script}</script>
</body>
</html>`
}

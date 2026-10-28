/**
 * 前端产物托管（web/dist）
 *
 * React 版页面（/test）由 Vite 构建成 web/dist，这里负责：
 *   1. 提供 /assets/* 静态文件（带指纹，可以长缓存）；
 *   2. /test 返回构建产物的 index.html（单页应用，路由在前端跑）。
 *
 * 兼容三种运行环境：
 *   - Node：有文件系统，直接读 web/dist；
 *   - Workers / Deno：打包后拿不到文件系统时自动回退到旧的内联页面，
 *     也就是「迁移期间旧页继续可用」，不会因为没构建前端而 404。
 *
 * 文件系统用动态 import 读取，且模块名不写死成字面量，
 * 这样 esbuild 打包时不会把它静态解析进去，Workers 里运行时失败会被 catch 掉。
 */
import store from '../admin/store.js'

const DIST_ROOT = process.env.METING_WEB_DIST || './web/dist'

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json; charset=utf-8',
}

/** 允许从构建产物根目录直接访问的 public 文件（白名单，避免暴露整个 dist） */
const PUBLIC_FILES = new Set(['logo.png'])

/** 读取文件系统模块；不可用（Workers / Deno）时返回 null */
const loadFs = async () => {
    try {
        const specifier = ['node', 'fs/promises'].join(':')
        return await import(/* @vite-ignore */ specifier)
    } catch {
        return null
    }
}

/** 读一个文件；不存在或读不到时返回 null */
const readFile = async (fs, path) => {
    try {
        return await fs.readFile(path)
    } catch {
        return null
    }
}

/** 拼路径：只做字符串拼接，不引入 node:path（Workers 打包时不友好） */
const distPath = (name) => `${DIST_ROOT.replace(/\/+$/, '')}/${name}`

/** 取扩展名（小写，含点） */
const extOf = (name) => {
    const index = name.lastIndexOf('.')
    return index < 0 ? '' : name.slice(index).toLowerCase()
}

/**
 * 是否存在构建产物。
 * 路由每次都试一次文件读取有点浪费，这里缓存探测结果。
 */
let available = null
export const isAvailable = async () => {
    if (available !== null) return available
    const fs = await loadFs()
    if (!fs) { available = false; return false }
    const html = await readFile(fs, distPath('index.html'))
    available = Boolean(html)
    return available
}

/**
 * 静态资源处理器：GET /assets/*
 * 只有构建产物存在时才返回内容，否则交给上层 404。
 */
export const assetsHandler = async (c) => {
    const fs = await loadFs()
    if (!fs) return c.notFound()
    const name = c.req.path.replace(/^\/+/, '')
    // 目录穿越防护：路径里不允许出现 .. 或空字节
    if (!name || name.includes('..') || name.includes('\0')) return c.notFound()
    const body = await readFile(fs, distPath(name))
    if (!body) return c.notFound()
    const type = CONTENT_TYPES[extOf(name)] || 'application/octet-stream'
    // 带内容指纹的产物可以长期缓存
    c.header('Cache-Control', name.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
    return c.body(body, 200, { 'Content-Type': type })
}

/**
 * public/ 目录里的其它静态文件（当前是 logo.png）。
 * 与 /assets/* 分开注册：只有明确列出的这几个路径才会被命中，
 * 避免把 dist 目录整体暴露出去。
 */
export const publicFileHandler = async (c) => {
    const fs = await loadFs()
    if (!fs) return c.notFound()
    const name = c.req.path.replace(/^\/+/, '')
    if (!PUBLIC_FILES.has(name)) return c.notFound()
    const body = await readFile(fs, distPath(name))
    if (!body) return c.notFound()
    const type = CONTENT_TYPES[extOf(name)] || 'application/octet-stream'
    c.header('Cache-Control', 'public, max-age=604800')
    return c.body(body, 200, { 'Content-Type': type })
}

/**
 * 把后台路径注入页面：后台路径可配置（ADMIN_PATH），前端不能写死 /admin。
 * 注入到 </head> 之前，因此页面自带的兜底脚本不会覆盖它。
 */
const injectBoot = (html) => {
    let adminPath = '/admin'
    try { adminPath = store.getAdminPath() || '/admin' } catch { /* 存储不可用时用默认值 */ }
    const boot = `<script>window.__BOOT__=${JSON.stringify({ adminPath })}</script>`
    return html.includes('</head>') ? html.replace('</head>', `${boot}</head>`) : boot + html
}

/* ------------------------------------------------------------------ *
 * 开发模式：把前端请求转发到 Vite 开发服务器
 *
 * 目的：开发时始终用 http://127.0.0.1:3000/test 访问，
 * 而不是另开一个 5173 端口 —— 避免「接口在后端、页面在别处」的割裂感，
 * 也让开发地址与生产地址保持一致。
 *
 * 触发条件：
 *   - Vite 开发服务器在跑（探测 / 是否可连接）；
 *   - 且环境变量 METING_WEB_DEV 不是 '0'。
 *
 * 只转发「前端资源」类路径，/api 与 /admin 仍由后端自己处理，
 * 避免出现「后端 → Vite → 后端」的环路。
 *
 * HMR 的 WebSocket 不走这里：Vite 客户端会连到页面所在源，
 * 需要的是 upgrade 握手转发，Hono 的 fetch 拿不到原始 socket。
 * 所以开发时由 Vite 配置把 HMR 端口直接指给浏览器（见 web/vite.config.ts）。
 * ------------------------------------------------------------------ */
// 用 localhost 而不是 127.0.0.1：Vite 默认绑在 IPv6 的 ::1 上，
// 写成 localhost 才能命中（Node 的 fetch 会自动回落到 IPv4）。
const DEV_TARGET = process.env.METING_WEB_DEV_URL || 'http://localhost:5173'

/** 前端资源路径：这些才转发给 Vite */
const DEV_PROXY_PATHS = [
    '/test',
    '/assets/',
    '/src/',
    '/public/',
    '/node_modules/',
    '/@vite/',
    '/@id/',
    '/@fs/',
    '/@react-refresh',
    '/logo.png',
]

/** 明确不转发的路径前缀（后端自己处理） */
const DEV_PROXY_EXCLUDE = ['/api', '/admin', '/robots.txt', '/sitemap.xml', '/favicon.ico']

const shouldProxy = (path) => {
    if (DEV_PROXY_EXCLUDE.some((prefix) => path === prefix || path.startsWith(prefix + '/'))) return false
    return DEV_PROXY_PATHS.some((prefix) => path === prefix || path.startsWith(prefix))
}

/**
 * 探测 Vite 开发服务器是否在跑。
 *
 * 结果只缓存几秒：Vite 可能在你启动/停止之后才起来，
 * 永久缓存会让代理在启停后失灵（页面回落到构建产物，开发时看不到热更新）。
 */
let devUp = null
let devUpAt = 0
const DEV_PROBE_TTL = 3000

const isDevServerUp = async () => {
    const now = Date.now()
    if (devUp !== null && now - devUpAt < DEV_PROBE_TTL) return devUp
    try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 800)
        const res = await fetch(DEV_TARGET + '/', { signal: controller.signal })
        clearTimeout(timer)
        devUp = res.ok
    } catch {
        devUp = false
    }
    devUpAt = now
    return devUp
}

/**
 * 开发代理处理器：把请求转发到 Vite。
 * Vite 没在跑时返回 false，调用方回退到静态产物 / 旧页面。
 */
export const devProxyHandler = async (c) => {
    if (process.env.METING_WEB_DEV === '0') return false
    if (!shouldProxy(c.req.path)) return false
    if (!await isDevServerUp()) return false

    const url = new URL(c.req.url)
    const target = new URL(url.pathname + url.search, DEV_TARGET)
    const headers = new Headers()
    for (const [key, value] of c.req.raw.headers.entries()) {
        // 逐跳头不转发
        if (['host', 'connection', 'content-length', 'keep-alive'].includes(key)) continue
        headers.set(key, value)
    }

    const body = c.req.method === 'GET' || c.req.method === 'HEAD'
        ? undefined
        : await c.req.arrayBuffer()

    try {
        const res = await fetch(target, {
            method: c.req.method,
            headers,
            body,
            redirect: 'manual',
        })
        const resHeaders = new Headers()
        res.headers.forEach((value, key) => {
            if (['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) return
            resHeaders.set(key, value)
        })
        return new Response(res.body, {
            status: res.status,
            headers: resHeaders,
        })
    } catch {
        return false
    }
}

/**
 * 单页应用入口：返回 web/dist/index.html。
 * 找不到产物时返回 false，调用方回退到旧页面。
 */
export const spaHandler = async (c) => {
    if (!await isAvailable()) return false
    const fs = await loadFs()
    const html = await readFile(fs, distPath('index.html'))
    if (!html) return false
    // 页面结构随构建变化，禁止缓存旧 HTML
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate')
    c.header('Pragma', 'no-cache')
    return c.html(injectBoot(html.toString('utf8')))
}

export default { assetsHandler, publicFileHandler, spaHandler, devProxyHandler, isAvailable }

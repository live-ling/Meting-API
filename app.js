import api from './src/service/api.js'
import { handler } from './src/template.js'
import { adminPageHandler } from './src/admin/page.js'
import adminRoutes from './src/admin/api.js'
import { loginBgHandler } from './src/admin/login-bg.js'
import store from './src/admin/store.js'
import cookieMonitor from './src/admin/cookie-monitor.js'
import neteaseRefresher from './src/admin/netease-refresh.js'
import abuseDetectorMiddleware from './src/middleware/abuse-detector.js'
import apiLogger from './src/service/api-logger.js'
import apiCache from './src/service/api-cache.js'
import { robotsHandler, sitemapHandler } from './src/routes/meta.js'
import { capabilitiesHandler } from './src/routes/capabilities.js'
import { assetsHandler, devProxyHandler, publicFileHandler, spaHandler } from './src/routes/spa.js'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import config from './src/config.js'
import { homePage } from './src/home-page.js'

const app = new Hono()

const allowedOrigins = (config.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
const corsOptions = {
    // 浏览器跨域 fetch 时也能读到缓存与音质信息
    exposeHeaders: ['X-Cache', 'X-Audio-Quality', 'X-Audio-Quality-Actual', 'X-Audio-Bitrate'],
    ...(allowedOrigins.length > 0 ? {
        origin: (origin) => {
            // 不存在origin时，不设置CORS头，依赖浏览器同源策略
            if (!origin) return null
            return allowedOrigins.includes(origin) ? origin : null
        }
    } : {}),
}
app.use('*', cors(corsOptions))
app.use('*', logger())

// 开发期前端资源代理：必须在滥用检测之前挂载。
// Vite 的模块图会产生大量并发请求，走后端会被频控当成攻击。
// Vite 没在跑时这里直接放行，行为与之前一致。
app.use('*', async (c, next) => {
    const dev = await devProxyHandler(c)
    if (dev) return dev
    await next()
})

app.use('*', abuseDetectorMiddleware)

adminRoutes(app)

// 登录页背景图：同源代理 + 服务端缓存，必须在后台页面兜底路由之前注册
app.get('/admin/login-bg', loginBgHandler)

const getAdminPath = () => {
    const storedPath = store.getAdminPath()
    return storedPath || config.ADMIN_PATH
}

app.use('*', async (c, next) => {
    const adminPath = getAdminPath()
    const path = c.req.path
    
    if (path === '/' + adminPath || path.startsWith('/' + adminPath + '/')) {
        return adminPageHandler(c)
    }
    
    await next()
})

app.get('/favicon.ico', (c) => {
    return c.redirect('https://www.liveling.top/upload/ChatGPT%20Image%202026%E5%B9%B46%E6%9C%8823%E6%97%A5%2016_02_32.png', 302)
})

// /api 与 /api/ 都接受：日志里 `/api/` 尾斜杠会 404，属于纯噪声
app.get('/api', api)
app.get('/api/', api)
app.get('/api/stats', (c) => c.json({ success: true, data: { ...apiLogger.getStats(), cache: apiCache.stats() } }))
// 能力矩阵：前端（React 试听页 / 首页）运行时读取，避免在前端维护第二份硬编码清单
app.get('/api/capabilities', capabilitiesHandler)
app.get('/robots.txt', robotsHandler)
app.get('/sitemap.xml', sitemapHandler)

// 前端构建产物（web/dist）：静态资源 + 单页应用入口。
// 没构建前端时（Workers / Deno）自动回退到旧的内联试听页。
app.get('/assets/*', assetsHandler)
app.get('/logo.png', publicFileHandler)
app.get('/test', async (c) => {
    const spa = await spaHandler(c)
    if (spa) return spa
    return handler(c)
})
// 原始 Meting-API 的演示页叫 /demo，保留一个跳转，避免旧链接直接 404
app.get('/demo', (c) => c.redirect('/test', 301))
app.get('/', homePage)

cookieMonitor.start()
neteaseRefresher.start()

export default app

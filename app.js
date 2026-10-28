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
app.get('/robots.txt', robotsHandler)
app.get('/sitemap.xml', sitemapHandler)
app.get('/test', handler)
// 原始 Meting-API 的演示页叫 /demo，保留一个跳转，避免旧链接直接 404
app.get('/demo', (c) => c.redirect('/test', 301))
app.get('/', homePage)

cookieMonitor.start()
neteaseRefresher.start()

export default app

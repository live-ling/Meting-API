import api from './src/service/api.js'
import { handler } from './src/template.js'
import { adminPageHandler } from './src/admin/page.js'
import adminRoutes from './src/admin/api.js'
import store from './src/admin/store.js'
import cookieMonitor from './src/admin/cookie-monitor.js'
import abuseDetectorMiddleware from './src/middleware/abuse-detector.js'
import apiLogger from './src/service/api-logger.js'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import config from './src/config.js'
import { homePage } from './src/home-page.js'

const app = new Hono()

const allowedOrigins = (config.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
const corsOptions = allowedOrigins.length > 0 ? {
    origin: (origin) => {
        // 不存在origin时，不设置CORS头，依赖浏览器同源策略
        if (!origin) return null
        return allowedOrigins.includes(origin) ? origin : null
    }
} : {}
app.use('*', cors(corsOptions))
app.use('*', logger())
app.use('*', abuseDetectorMiddleware)

adminRoutes(app)

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

app.get('/api', api)
app.get('/api/stats', (c) => c.json({ success: true, data: apiLogger.getStats() }))
app.get('/test', handler)
app.get('/', homePage)

cookieMonitor.start()

export default app

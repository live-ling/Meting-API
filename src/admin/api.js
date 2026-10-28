import store from '../admin/store.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { validateCookie } from './cookie-validator.js'
import cookieMonitor from './cookie-monitor.js'
import neteaseQr from './netease-qr.js'
import { banIP, unbanIP, resetIPRecord, getAbuseStats, getEffectiveAbuseConfig, getClientIP } from '../middleware/abuse-detector.js'
import apiLogger from '../service/api-logger.js'
import apiCache from '../service/api-cache.js'
import {
    CACHE_TYPES,
    CACHE_TYPE_LABELS,
    resolveCacheConfig,
    secondsToMinutes,
    minutesToSeconds,
} from '../service/cache-config.js'
import { queryShowAPI, getGeoCacheStats, clearGeoCache, isPublicIP } from '../service/geo.js'
import { getLoginBgStatus, refreshLoginBg, clearLoginBgCache } from './login-bg.js'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || './data'
const PUBLIC_TOKEN_FILE = path.join(DATA_DIR, 'public_token.json')

const getPublicToken = () => {
    try {
        if (fs.existsSync(PUBLIC_TOKEN_FILE)) {
            const data = JSON.parse(fs.readFileSync(PUBLIC_TOKEN_FILE, 'utf-8'))
            return data.token || ''
        }
    } catch (_) {}
    return ''
}

const savePublicToken = (token) => {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
        fs.writeFileSync(PUBLIC_TOKEN_FILE, JSON.stringify({ token, updatedAt: new Date().toISOString() }))
        return true
    } catch (_) {}
    return false
}

const formatCookieForDisplay = (cookie) => {
    const { id, platform, note, createdAt, updatedAt, createdBy, isActive, isValid, validatedAt, userInfo, validationError } = cookie
    let cookiePreview = cookie.cookie
    if (cookiePreview.length > 50) {
        cookiePreview = cookiePreview.substring(0, 50) + '...'
    }
    return { id, platform, cookiePreview, note, createdAt, updatedAt, createdBy, isActive, isValid, validatedAt, userInfo, validationError }
}

export const adminRoutes = (app) => {
    app.post('/admin/login', async (c) => {
        const body = await c.req.json()
        const { username, password, code } = body
        
        if (!username || !password) {
            return c.json({ success: false, error: '用户名和密码不能为空' }, 400)
        }
        
        const result = await store.authenticateUser(username, password)
        
        if (result.success && result.require2FA) {
            if (!code) {
                return c.json({ 
                    success: true, 
                    require2FA: true, 
                    data: { username: result.data.username, role: result.data.role }
                })
            }
            const twoFAResult = await store.verify2FALogin(username, code)
        if (twoFAResult.success) {
            return c.json(twoFAResult)
        } else {
            return c.json(twoFAResult, 400)
        }
        }
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 401)
        }
    })

    app.post('/admin/logout', async (c) => {
        const username = c.req.header('X-Auth-Username')
        if (username) {
            await store.logoutUser(username)
        }
        return c.json({ success: true })
    })

    app.get('/admin/check', authMiddleware, async (c) => {
        const username = c.get('username')
        const user = store.users.get(username)
        return c.json({ 
            success: true, 
            data: { 
                username: user.username, 
                role: user.role 
            } 
        })
    })

    app.get('/admin/cookies', authMiddleware, async (c) => {
        const platform = c.req.query('platform')
        const cookies = store.getCookies(platform).map(formatCookieForDisplay)
        return c.json({ success: true, data: cookies })
    })

    app.get('/admin/cookies/:id', authMiddleware, async (c) => {
        const id = c.req.param('id')
        const cookie = store.getCookie(id)
        
        if (!cookie) {
            return c.json({ success: false, error: 'Cookie不存在' }, 404)
        }
        
        return c.json({ success: true, data: formatCookieForDisplay(cookie) })
    })

    // 网易云扫码登录：三个接口都只返回操作结果，unikey 始终留在服务端内存。
    // 统一 no-store，避免二维码图片（等价于登录令牌）被任何中间层缓存。
    app.post('/admin/cookies/qr/netease/create', authMiddleware, adminMiddleware, async (c) => {
        c.header('Cache-Control', 'no-store')
        c.header('Pragma', 'no-cache')
        try {
            const data = await neteaseQr.create(c.get('username'))
            return c.json({ success: true, data })
        } catch (error) {
            return c.json({ success: false, error: error.message || '生成二维码失败' }, error.status || 502)
        }
    })

    app.post('/admin/cookies/qr/netease/check', authMiddleware, adminMiddleware, async (c) => {
        c.header('Cache-Control', 'no-store')
        c.header('Pragma', 'no-cache')
        const body = await c.req.json().catch(() => ({}))
        if (!body?.sessionId) {
            return c.json({ success: false, error: '缺少 sessionId' }, 400)
        }
        try {
            const data = await neteaseQr.check(body.sessionId, c.get('username'))
            return c.json({ success: true, data })
        } catch (error) {
            return c.json({ success: false, error: error.message || '查询扫码状态失败' }, error.status || 502)
        }
    })

    app.post('/admin/cookies/qr/netease/cancel', authMiddleware, adminMiddleware, async (c) => {
        c.header('Cache-Control', 'no-store')
        const body = await c.req.json().catch(() => ({}))
        return c.json({ success: true, data: neteaseQr.cancel(body?.sessionId, c.get('username')) })
    })

    app.post('/admin/cookies', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { platform, cookie, note, skipValidation } = body
        const username = c.get('username')
        
        const result = await store.addCookie(platform, cookie, note, username, skipValidation)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.put('/admin/cookies/:id', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const body = await c.req.json()
        const username = c.get('username')
        const { skipValidation, ...updates } = body
        
        const result = await store.updateCookie(id, updates, username, skipValidation)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.delete('/admin/cookies/:id', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const username = c.get('username')
        
        const result = await store.deleteCookie(id, username)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 404)
        }
    })

    app.post('/admin/cookies/:id/verify', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const username = c.get('username')
        
        const result = await store.verifyCookie(id, username)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 404)
        }
    })

    app.post('/admin/cookies/validate', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { platform, cookie } = body
        
        if (!platform || !cookie) {
            return c.json({ success: false, error: '平台和Cookie数据不能为空' }, 400)
        }
        
        const result = await validateCookie(platform, cookie)
        return c.json({ success: true, data: result })
    })

    app.get('/admin/users', authMiddleware, adminMiddleware, async (c) => {
        const users = store.getUsers()
        return c.json({ success: true, data: users })
    })

    app.post('/admin/users', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { username: newUsername, password, role } = body
        const operator = c.get('username')
        
        if (!newUsername || !password) {
            return c.json({ success: false, error: '用户名和密码不能为空' }, 400)
        }
        
        const result = await store.addUser({ username: newUsername, password, role }, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.put('/admin/users/:username', authMiddleware, adminMiddleware, async (c) => {
        const targetUsername = c.req.param('username')
        const body = await c.req.json()
        const operator = c.get('username')
        
        const result = await store.updateUser(targetUsername, body, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.put('/admin/profile', authMiddleware, async (c) => {
        const currentUsername = c.get('username')
        const body = await c.req.json()

        if (body.role !== undefined || body.password !== undefined) {
            return c.json({ success: false, error: '禁止通过此接口修改角色或密码' }, 400)
        }

        const { newUsername } = body
        if (!newUsername || newUsername === currentUsername) {
            return c.json({ success: false, error: '新用户名无效' }, 400)
        }

        const result = await store.updateUser(currentUsername, { newUsername }, currentUsername)

        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.delete('/admin/users/:username', authMiddleware, adminMiddleware, async (c) => {
        const targetUsername = c.req.param('username')
        const operator = c.get('username')
        
        const result = await store.deleteUser(targetUsername, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/logs', authMiddleware, async (c) => {
        const limit = parseInt(c.req.query('limit') || '100')
        const offset = parseInt(c.req.query('offset') || '0')
        const logs = store.getLogs(limit, offset)
        return c.json({ success: true, data: logs })
    })

    app.delete('/admin/logs', authMiddleware, adminMiddleware, async (c) => {
        const result = await store.clearLogs()
        return c.json(result)
    })

    app.put('/admin/password', authMiddleware, async (c) => {
        const body = await c.req.json()
        const { oldPassword, newPassword } = body
        const username = c.get('username')
        
        if (!oldPassword || !newPassword) {
            return c.json({ success: false, error: '旧密码和新密码不能为空' }, 400)
        }
        
        const user = store.users.get(username)
        if (!store.verifyPassword(oldPassword, user.password)) {
            return c.json({ success: false, error: '旧密码错误' }, 400)
        }
        
        const result = await store.updateUser(username, { password: newPassword }, username)
        if (result.success) {
            store.migratePasswordHash(username, newPassword)
        }
        return c.json(result)
    })

    app.get('/admin/config', authMiddleware, adminMiddleware, async (c) => {
        const config = store.getConfig()
        return c.json({ success: true, data: config })
    })

    app.put('/admin/config/admin-path', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { adminPath } = body
        const operator = c.get('username')
        
        const result = await store.setAdminPath(adminPath, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/webhook', authMiddleware, adminMiddleware, async (c) => {
        const config = store.getWebhookConfig()
        return c.json({ success: true, data: config })
    })

    app.put('/admin/webhook', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const operator = c.get('username')
        
        const result = await store.setWebhookConfig(body, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.post('/admin/webhook/test', authMiddleware, adminMiddleware, async (c) => {
        const result = await cookieMonitor.testWebhook()
        
        if (result.sent) {
            return c.json({ success: true, message: 'Webhook测试消息已发送' })
        } else {
            return c.json({ success: false, error: result.error || '发送失败' }, 400)
        }
    })

    // ============ SMTP 邮件通知 ============

    app.get('/admin/smtp', authMiddleware, adminMiddleware, async (c) => {
        const config = store.getSmtpConfig()
        return c.json({ success: true, data: config })
    })

    app.put('/admin/smtp', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const operator = c.get('username')

        const result = await store.setSmtpConfig(body, operator)

        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.post('/admin/smtp/test', authMiddleware, adminMiddleware, async (c) => {
        const { testEmail } = await import('./email-notifier.js')
        const result = await testEmail()

        if (result.sent) {
            return c.json({ success: true, message: '测试邮件已发送' })
        } else {
            return c.json({ success: false, error: result.error || '发送失败' }, 400)
        }
    })

    app.get('/admin/monitor', authMiddleware, adminMiddleware, async (c) => {
        const config = store.getMonitorConfig()
        return c.json({ success: true, data: config })
    })

    app.put('/admin/monitor', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const operator = c.get('username')
        
        const result = await store.setMonitorConfig(body, operator)
        
        if (result.success) {
            if (body.enabled !== undefined || body.interval !== undefined) {
                cookieMonitor.restart()
            }
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/monitor/status', authMiddleware, adminMiddleware, async (c) => {
        const status = cookieMonitor.getStatus()
        return c.json({ success: true, data: status })
    })

    app.post('/admin/monitor/check', authMiddleware, adminMiddleware, async (c) => {
        const result = await cookieMonitor.checkNow()
        
        if (result.success) {
            return c.json({ success: true, message: '检查已完成' })
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/monitor/logs', authMiddleware, adminMiddleware, async (c) => {
        const limit = parseInt(c.req.query('limit') || '100')
        const offset = parseInt(c.req.query('offset') || '0')
        const logs = store.getMonitorLogs(limit, offset)
        return c.json({ success: true, data: logs })
    })

    // ============ IP 归属地接口（ShowAPI） ============

    const maskGeoKey = (key) => (key ? '****' + String(key).slice(-4) : '')

    // 后台「获取我的 IP」：优先用反代传入的公网地址；本地/内网访问时
    // 退回 uapis 的 myip 接口（服务端出口 IP，本地开发时就是本机公网 IP）。
    const PUBLIC_IP_URL = 'https://uapis.cn/api/v1/network/myip'
    const PUBLIC_IP_TTL = 10 * 60 * 1000
    let publicIpCache = { ip: '', at: 0 }
    const resolveClientIP = async (c) => {
        const forwarded = getClientIP(c)
        if (isPublicIP(forwarded)) return { ip: forwarded, source: 'forwarded' }
        const realIp = c.req.header('X-Real-IP')
        if (isPublicIP(realIp)) return { ip: realIp, source: 'real-ip' }
        if (publicIpCache.ip && Date.now() - publicIpCache.at < PUBLIC_IP_TTL) {
            return { ip: publicIpCache.ip, source: 'cache' }
        }
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        try {
            const res = await fetch(PUBLIC_IP_URL, { signal: controller.signal })
            const body = await res.json()
            if (body?.ip && isPublicIP(body.ip)) {
                publicIpCache = { ip: body.ip, at: Date.now() }
                return { ip: body.ip, source: 'external' }
            }
        } catch (_) {
            // 外部接口不可用时，退回请求头里的值，让前端至少能显示出来
        } finally {
            clearTimeout(timer)
        }
        return { ip: forwarded, source: forwarded === 'unknown' ? 'unknown' : 'private' }
    }

    app.get('/admin/geo', authMiddleware, adminMiddleware, async (c) => {
        const config = store.getGeoConfig()
        const cache = getGeoCacheStats()
        return c.json({
            success: true,
            data: {
                enabled: config.enabled,
                hasKey: !!config.key,
                keyPreview: maskGeoKey(config.key),
                cacheSize: cache.size,
                cacheTtlDays: cache.ttlDays,
            },
        })
    })

    app.put('/admin/geo', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json().catch(() => ({}))
        const result = await store.setGeoConfig(body, c.get('username'))
        if (!result.success) return c.json(result, 400)
        const config = store.getGeoConfig()
        return c.json({
            ...result,
            data: {
                enabled: config.enabled,
                hasKey: !!config.key,
                keyPreview: maskGeoKey(config.key),
                cacheSize: getGeoCacheStats().size,
            },
        })
    })

    app.get('/admin/geo/client-ip', authMiddleware, adminMiddleware, async (c) => {
        return c.json({ success: true, data: await resolveClientIP(c) })
    })

    app.post('/admin/geo/test', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json().catch(() => ({}))
        const config = store.getGeoConfig()
        const key = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : config.key
        // 不填 IP 时直接用当前访问后台的公网 IP，省去手动复制
        let ip = typeof body.ip === 'string' ? body.ip.trim() : ''
        if (!ip) {
            const fallback = await resolveClientIP(c)
            ip = fallback.ip
        }
        const result = await queryShowAPI(ip, key)
        return c.json(result, result.success ? 200 : 400)
    })

    app.post('/admin/geo/cache/clear', authMiddleware, adminMiddleware, async (c) => {
        clearGeoCache()
        await store.addLog('geo_cache_clear', '清空 IP 归属地缓存', c.get('username'))
        return c.json({ success: true, data: getGeoCacheStats() })
    })

    // ============ /api 响应缓存 ============

    const getCacheData = () => {
        const config = resolveCacheConfig(store.getCacheConfig())
        const stats = apiCache.stats()
        return {
            enabled: config.enabled,
            maxEntries: config.maxEntries,
            ttlByType: Object.fromEntries(CACHE_TYPES.map((type) => [type, secondsToMinutes(config.ttlByType[type])])),
            types: CACHE_TYPES.map((type) => ({ key: type, label: CACHE_TYPE_LABELS[type] })),
            envLocked: globalThis?.process?.env?.CACHE_ENABLED === '0',
            envGlobalTtlSeconds: Number(globalThis?.process?.env?.CACHE_TTL_SECONDS || 0) || null,
            stats,
        }
    }

    app.get('/admin/cache', authMiddleware, adminMiddleware, async (c) => {
        c.header('Cache-Control', 'no-store')
        return c.json({ success: true, data: getCacheData() })
    })

    app.put('/admin/cache', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json().catch(() => ({}))
        const before = resolveCacheConfig(store.getCacheConfig())
        const ttlByType = {}
        if (body.ttlByType && typeof body.ttlByType === 'object') {
            for (const [type, minutes] of Object.entries(body.ttlByType)) {
                ttlByType[type] = minutesToSeconds(minutes)
            }
        }
        const result = await store.setCacheConfig(
            { enabled: body.enabled, maxEntries: body.maxEntries, ttlByType },
            c.get('username')
        )
        if (!result.success) return c.json(result, 400)

        const after = resolveCacheConfig(store.getCacheConfig())
        // TTL 改变后旧条目的过期时间不会跟着变，直接清空让新配置立即生效
        if (JSON.stringify(before.ttlByType) !== JSON.stringify(after.ttlByType)) {
            apiCache.clear()
        }
        return c.json({ success: true, data: getCacheData() })
    })

    app.post('/admin/cache/clear', authMiddleware, adminMiddleware, async (c) => {
        apiCache.clear()
        await store.addLog('cache_clear', '清空 /api 响应缓存', c.get('username'))
        return c.json({ success: true, data: getCacheData() })
    })

    // ============ 登录页背景图 ============

    app.get('/admin/login-bg/settings', authMiddleware, adminMiddleware, async (c) => {
        c.header('Cache-Control', 'no-store')
        return c.json({ success: true, data: getLoginBgStatus() })
    })

    app.put('/admin/login-bg/settings', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json().catch(() => ({}))
        const before = store.getLoginBgConfig()
        const result = await store.setLoginBgConfig(
            { enabled: body.enabled, apiUrl: body.apiUrl, ttlHours: body.ttlHours },
            c.get('username')
        )
        if (!result.success) return c.json(result, 400)
        const after = store.getLoginBgConfig()
        // 接口地址换了，旧图不再代表新分类，直接清掉，下次访问按新地址抓取
        if (before.apiUrl !== after.apiUrl) clearLoginBgCache()
        return c.json({ success: true, data: getLoginBgStatus() })
    })

    app.post('/admin/login-bg/refresh', authMiddleware, adminMiddleware, async (c) => {
        try {
            const result = await refreshLoginBg()
            await store.addLog('login_bg_refresh', '更换登录页背景图', c.get('username'))
            return c.json({
                success: true,
                data: getLoginBgStatus(),
                ...(result.error ? { warning: result.error } : {}),
            })
        } catch (error) {
            return c.json({ success: false, error: error.message || '更换背景图失败' }, 502)
        }
    })

    app.post('/admin/login-bg/cache/clear', authMiddleware, adminMiddleware, async (c) => {
        clearLoginBgCache()
        await store.addLog('login_bg_cache_clear', '清除登录页背景图缓存', c.get('username'))
        return c.json({ success: true, data: getLoginBgStatus() })
    })

    app.get('/admin/2fa/status', authMiddleware, async (c) => {
        const username = c.get('username')
        const status = store.get2FAStatus(username)
        return c.json({ success: true, data: status })
    })

    app.post('/admin/2fa/setup', authMiddleware, async (c) => {
        const username = c.get('username')
        const result = store.setup2FA(username)
        if (result.success) {
            try {
                const QRCode = (await import('qrcode')).default
                const qrDataUrl = await QRCode.toDataURL(result.data.otpAuthUrl, { width: 200, margin: 1 })
                result.data.qrDataUrl = qrDataUrl
            } catch (e) {
                return c.json({ success: false, error: 'QR码生成失败: ' + e.message }, 500)
            }
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.post('/admin/2fa/enable', authMiddleware, async (c) => {
        const body = await c.req.json()
        const { code } = body
        const username = c.get('username')

        if (!code) {
            return c.json({ success: false, error: '验证码不能为空' }, 400)
        }

        const result = await store.enable2FA(username, code)
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.post('/admin/2fa/disable', authMiddleware, async (c) => {
        const body = await c.req.json()
        const { password } = body
        const username = c.get('username')

        if (!password) {
            return c.json({ success: false, error: '密码不能为空' }, 400)
        }

        const result = await store.disable2FA(username, password)
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/tokens', authMiddleware, adminMiddleware, async (c) => {
        const tokens = store.getApiTokens()
        return c.json({ success: true, data: tokens })
    })

    app.post('/admin/tokens', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { name, permissions } = body
        const operator = c.get('username')

        if (!name) {
            return c.json({ success: false, error: 'Token名称不能为空' }, 400)
        }

        const result = await store.createApiToken(name, permissions || [], operator)
        return c.json(result)
    })

    app.get('/admin/tokens/:id', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const token = store.getApiToken(id)
        if (!token) {
            return c.json({ success: false, error: 'Token不存在' }, 404)
        }
        const { token: _, ...safeToken } = token
        return c.json({ success: true, data: safeToken })
    })

    app.put('/admin/tokens/:id', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const body = await c.req.json()
        const operator = c.get('username')

        const result = await store.updateApiToken(id, body, operator)
        if (result.success) {
            const { token: _, ...safeToken } = result.data
            return c.json({ success: true, data: safeToken })
        } else {
            return c.json(result, 400)
        }
    })

    app.delete('/admin/tokens/:id', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const operator = c.get('username')

        const result = await store.deleteApiToken(id, operator)
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 404)
        }
    })

    // ============ 滥用检测与防护 ============

    app.get('/admin/abuse/stats', authMiddleware, adminMiddleware, async (c) => {
        const runtimeStats = getAbuseStats()
        const persistStats = store.getAbuseStats()
        return c.json({
            success: true,
            data: { ...runtimeStats, ...persistStats },
        })
    })

    app.get('/admin/abuse/logs', authMiddleware, adminMiddleware, async (c) => {
        const pageSize = parseInt(c.req.query('pageSize') || '50')
        const page = Math.max(1, parseInt(c.req.query('page') || '1'))
        const offset = (page - 1) * pageSize
        const ip = c.req.query('ip')
        const level = c.req.query('level')
        const blocked = c.req.query('blocked')
        const keyword = c.req.query('keyword')

        const filters = {}
        if (ip) filters.ip = ip
        if (level) filters.level = level
        if (blocked !== undefined) filters.blocked = blocked === 'true'
        if (keyword) filters.keyword = keyword

        const total = store.getAbuseLogTotalCount(filters)
        const items = store.getAbuseLogs(pageSize, offset, filters)
        return c.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } })
    })

    app.delete('/admin/abuse/logs', authMiddleware, adminMiddleware, async (c) => {
        const operator = c.get('username')
        await store.clearAbuseLogs(operator)
        return c.json({ success: true })
    })

    app.get('/admin/abuse/config', authMiddleware, adminMiddleware, async (c) => {
        // 返回与默认值深合并后的有效配置，保证 whitelist 等未持久化字段可被前端正确回填
        return c.json({ success: true, data: getEffectiveAbuseConfig() })
    })

    app.put('/admin/abuse/config', authMiddleware, adminMiddleware, async (c) => {
        const operator = c.get('username')
        const body = await c.req.json()
        const result = await store.setAbuseConfig(body, operator)
        return c.json(result, result.success ? 200 : 400)
    })

    app.get('/admin/abuse/bans', authMiddleware, adminMiddleware, async (c) => {
        return c.json({ success: true, data: store.getIpBans() })
    })

    app.post('/admin/abuse/bans', authMiddleware, adminMiddleware, async (c) => {
        const { ip, reason, duration, permanent } = await c.req.json()
        if (!ip) return c.json({ success: false, error: 'IP不能为空' }, 400)

        banIP(ip, reason, duration, !!permanent)
        await store.addLog('ip_ban', `手动${permanent ? '永久' : ''}封禁IP: ${ip}`, c.get('username'))
        return c.json({ success: true })
    })

    app.delete('/admin/abuse/bans/:ip', authMiddleware, adminMiddleware, async (c) => {
        const ip = c.req.param('ip')
        const operator = c.get('username')
        unbanIP(ip)
        await store.removeIpBan(ip, operator)
        return c.json({ success: true })
    })

    app.post('/admin/abuse/reset/:ip', authMiddleware, adminMiddleware, async (c) => {
        const ip = c.req.param('ip')
        resetIPRecord(ip)
        return c.json({ success: true })
    })

    // === API 调用日志 ===

    app.get('/admin/api-logs/stats', authMiddleware, async (c) => {
        return c.json({ success: true, data: apiLogger.getStats() })
    })

    // 来源统计：按 Referer 站点聚合请求数与独立 IP
    app.get('/admin/api-logs/referers', authMiddleware, async (c) => {
        const hours = Math.min(24 * 30, Math.max(1, parseInt(c.req.query('hours')) || 24))
        const limit = Math.min(100, Math.max(5, parseInt(c.req.query('limit')) || 30))
        const host = c.req.query('host') || ''
        return c.json({ success: true, data: apiLogger.getRefererStats({ hours, limit, host }) })
    })

    // 看板：按小时分桶的请求趋势
    app.get('/admin/api-logs/timeseries', authMiddleware, async (c) => {
        const hours = Math.min(72, Math.max(6, parseInt(c.req.query('hours')) || 24))
        return c.json({ success: true, data: apiLogger.getTimeseries({ hours }) })
    })

    app.get('/admin/api-logs', authMiddleware, async (c) => {
        const { startTime, endTime, ip, server, type, status, keyword, page, pageSize } = c.req.query()
        const result = apiLogger.getLogs({
            startTime: startTime ? Number(startTime) : undefined,
            endTime: endTime ? Number(endTime) : undefined,
            ip: ip || undefined,
            server: server || undefined,
            type: type || undefined,
            status: status || undefined,
            keyword: keyword || undefined,
            page: page ? Math.max(1, parseInt(page) || 1) : 1,
            pageSize: pageSize ? Math.min(200, Math.max(10, parseInt(pageSize) || 50)) : 50,
        })
        return c.json({ success: true, ...result })
    })

    app.delete('/admin/api-logs', authMiddleware, adminMiddleware, async (c) => {
        apiLogger.clearLogs()
        await store.addLog('api_logs_clear', '清空API调用日志', c.get('username'))
        return c.json({ success: true })
    })

    app.get('/admin/api-logs/export', authMiddleware, async (c) => {
        const { startTime, endTime, ip, server, type, status, keyword } = c.req.query()
        const csv = apiLogger.exportCSV({
            startTime: startTime ? Number(startTime) : undefined,
            endTime: endTime ? Number(endTime) : undefined,
            ip: ip || undefined,
            server: server || undefined,
            type: type || undefined,
            status: status || undefined,
            keyword: keyword || undefined,
        })
        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="api-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
            }
        })
    })

    // === 公开统计 Token 管理 ===
    app.get('/admin/public-token', authMiddleware, async (c) => {
        return c.json({ success: true, data: { token: getPublicToken() } })
    })

    app.post('/admin/public-token', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { token } = body
        if (!token || typeof token !== 'string') {
            return c.json({ success: false, error: 'Token 不能为空' }, 400)
        }
        const ok = savePublicToken(token.trim())
        if (ok) {
            await store.addLog('public_token_update', '更新公开统计Token', c.get('username'))
            return c.json({ success: true, message: 'Token 已保存' })
        }
        return c.json({ success: false, error: '存储失败' }, 500)
    })
}

export default adminRoutes

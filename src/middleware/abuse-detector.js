import store from '../admin/store.js'
import appConfig from '../config.js'
import { isValidAuth } from './auth.js'

// 默认配置
const DEFAULT_CONFIG = {
    enabled: true,
    rateLimit: {
        windowMs: 60000,
        maxRequests: 120,
        maxApiRequests: 60,
    },
    ban: {
        threshold: 3,
        duration: 3600000,
        // 封禁期内再次命中时滑动续期
        extendOnHit: true,
        extendMs: 600000,
    },
    rules: {
        rapidRequests: true,
        invalidParams: true,
        pathEnumeration: true,
        suspiciousPatterns: true,
    },
    whitelist: {
        paths: ['/health', '/favicon.ico', '/', '/test'],
        ips: [],
    },
}

const SUSPICIOUS_PATTERNS = [
    /\.\.[\\/]/,
    /\0/,
    /<script/i,
    /javascript:/i,
    /union\s+select/i,
    /insert\s+into/i,
    /drop\s+table/i,
    /\${.*}/,
]

// 内存计数器: ip -> { count, apiCount, firstTime, lastTime, violations, paths: Set }
const requestRecords = new Map()
// 内存封禁列表: ip -> { reason, bannedAt, expiresAt }
const bannedIPs = new Map()

// 启动时从持久化存储恢复封禁列表（延迟到首次请求时执行，确保store已完成初始化）
let bansLoaded = false
const loadBannedIPs = () => {
    if (bansLoaded) return
    bansLoaded = true
    try {
        const bans = store.getIpBans()
        const now = Date.now()
        for (const ban of bans) {
            // permanent: expiresAt === 0, always restore
            if (!ban.expiresAt || now < ban.expiresAt) {
                bannedIPs.set(ban.ip, {
                    reason: ban.reason,
                    bannedAt: ban.bannedAt,
                    expiresAt: ban.expiresAt || 0,
                })
            }
        }
        if (bannedIPs.size > 0) {
            console.log(`[AbuseDetector] 已恢复 ${bannedIPs.size} 个封禁IP`)
        }
    } catch (e) {
        console.log('[AbuseDetector] 恢复封禁列表失败:', e.message)
    }
}

let lastCleanup = 0
const CLEANUP_INTERVAL = 5 * 60 * 1000

const getClientIP = (c) => {
    const forwarded = c.req.header('X-Forwarded-For')
    if (forwarded) {
        const ips = forwarded.split(',').map(s => s.trim())
        return ips[0] || 'unknown'
    }
    return c.req.header('X-Real-IP') || 'unknown'
}

const isWhitelisted = (path, ip, config) => {
    if (config.whitelist?.paths?.some(p => path === p || path.startsWith(p + '/'))) return true
    if (config.whitelist?.ips?.includes(ip)) return true
    return false
}

// 持久化配置可能只保存了部分字段（历史版本的表单不含 whitelist 等），
// 与默认配置深合并保证缺失字段回落到默认值
const mergeConfig = (base, override) => {
    const merged = { ...base }
    for (const key of Object.keys(override || {})) {
        const val = override[key]
        const baseVal = base[key]
        const bothPlainObject = val && baseVal &&
            typeof val === 'object' && typeof baseVal === 'object' &&
            !Array.isArray(val) && !Array.isArray(baseVal)
        merged[key] = bothPlainObject ? mergeConfig(baseVal, val) : val
    }
    return merged
}

export const getEffectiveAbuseConfig = () => mergeConfig(DEFAULT_CONFIG, store.getAbuseConfig())

// 管理后台路径前缀：该前缀下的请求不做封禁拦截，保证被封禁的管理员
// 仍能打开登录页自助解封；未认证请求由 401 与登录失败锁定兜底
const getAdminPrefix = () => {
    try {
        return '/' + (store.getAdminPath() || appConfig.ADMIN_PATH || 'admin')
    } catch {
        return '/admin'
    }
}

const isAdminPath = (path) => {
    const prefix = getAdminPrefix()
    return path === prefix || path.startsWith(prefix + '/')
}

// 被拦截命中的聚合统计: ip -> { hits, lastLogAt }
// 每个已封禁 IP 每分钟至多写一条聚合日志，避免机器人刷屏淹没日志
const BLOCKED_LOG_INTERVAL = 60 * 1000
const blockedHitStats = new Map()

const logBlockedHit = (c, ip, path, result) => {
    const now = Date.now()
    let stats = blockedHitStats.get(ip)
    if (!stats) {
        stats = { hits: 0, lastLogAt: 0 }
        blockedHitStats.set(ip, stats)
    }
    stats.hits++

    if (now - stats.lastLogAt < BLOCKED_LOG_INTERVAL) return Promise.resolve()

    const hits = stats.hits
    stats.hits = 0
    stats.lastLogAt = now

    const persist = async () => {
        await store.addAbuseLog({
            ip,
            path,
            method: c.req.method,
            level: 'ban',
            reason: result.reason,
            violations: [],
            userAgent: c.req.header('User-Agent') || '',
            blocked: true,
            hitCount: hits,
        })
        // 顺带持久化滑动续期后的封禁到期时间，频率与日志节流一致
        const banInfo = bannedIPs.get(ip)
        if (banInfo && banInfo.expiresAt > 0) {
            await store.extendIpBan(ip, banInfo.expiresAt)
        }
    }
    return persist().catch(() => {})
}

const cleanupExpired = (config) => {
    const now = Date.now()
    if (now - lastCleanup < CLEANUP_INTERVAL) return
    lastCleanup = now

    const windowMs = (config?.rateLimit?.windowMs || DEFAULT_CONFIG.rateLimit.windowMs) * 2
    for (const [ip, record] of requestRecords) {
        if (now - record.lastTime > windowMs) {
            requestRecords.delete(ip)
        }
    }
    for (const [ip, ban] of bannedIPs) {
        if (ban.expiresAt && now > ban.expiresAt) {
            bannedIPs.delete(ip)
        }
    }
    for (const [ip, stats] of blockedHitStats) {
        if (now - stats.lastLogAt > CLEANUP_INTERVAL) {
            blockedHitStats.delete(ip)
        }
    }
}

const detectAbuse = (c, ip, path, config) => {
    const now = Date.now()
    const violations = []

    let record = requestRecords.get(ip)
    if (!record) {
        record = {
            count: 0,
            apiCount: 0,
            firstTime: now,
            lastTime: now,
            violations: 0,
            paths: new Set(),
        }
        requestRecords.set(ip, record)
    }

    record.count++
    record.lastTime = now
    if (path.startsWith('/api')) {
        record.apiCount++
    }
    record.paths.add(path)

    // 检查封禁
    const banInfo = bannedIPs.get(ip)
    if (banInfo) {
        let expiresAt = banInfo.expiresAt
        // 滑动续期：封禁期内再次命中则刷新剩余时间，攻击不停就一直拦截
        if (expiresAt > 0 && config.ban?.extendOnHit !== false) {
            expiresAt = now + (config.ban?.extendMs || DEFAULT_CONFIG.ban.extendMs)
            banInfo.expiresAt = expiresAt
        }
        return {
            blocked: true,
            level: 'ban',
            reason: banInfo.reason,
            retryAfter: expiresAt > 0 ? Math.ceil((expiresAt - now) / 1000) : 86400,
        }
    }

    const windowMs = config.rateLimit?.windowMs || DEFAULT_CONFIG.rateLimit.windowMs
    const maxRequests = config.rateLimit?.maxRequests || DEFAULT_CONFIG.rateLimit.maxRequests
    const maxApiRequests = config.rateLimit?.maxApiRequests || DEFAULT_CONFIG.rateLimit.maxApiRequests

    // 重置时间窗口（违规计数一并清零，避免跨窗口累积导致意外封禁）
    if (now - record.firstTime > windowMs) {
        record.count = 1
        record.apiCount = path.startsWith('/api') ? 1 : 0
        record.firstTime = now
        record.violations = 0
        record.paths.clear()
        record.paths.add(path)
    }

    // 规则1: 请求速率
    if (config.rules?.rapidRequests && record.count > maxRequests) {
        violations.push({
            type: 'rapid_requests',
            severity: 'medium',
            detail: `${record.count} requests in ${windowMs / 1000}s`,
        })
    }

    // 规则2: API 请求过多
    if (config.rules?.rapidRequests && record.apiCount > maxApiRequests) {
        violations.push({
            type: 'api_abuse',
            severity: 'high',
            detail: `${record.apiCount} API requests in ${windowMs / 1000}s`,
        })
    }

    // 规则3: 路径枚举
    if (config.rules?.pathEnumeration && record.paths.size > 30) {
        violations.push({
            type: 'path_enumeration',
            severity: 'medium',
            detail: `${record.paths.size} unique paths in window`,
        })
    }

    // 规则4: 可疑参数模式
    if (config.rules?.invalidParams) {
        const queryString = c.req.url
        for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(queryString) || pattern.test(path)) {
                violations.push({
                    type: 'suspicious_pattern',
                    severity: 'high',
                    detail: `Matched pattern: ${pattern.source}`,
                })
                break
            }
        }
    }

    if (violations.length === 0) {
        return { blocked: false, level: 'none', violations: [] }
    }

    record.violations++

    const maxSeverity = violations.some(v => v.severity === 'high')
        ? 'high'
        : violations.some(v => v.severity === 'medium')
            ? 'medium'
            : 'low'

    // 高危违规 + 累计违规次数达到阈值 -> 封禁
    const banThreshold = config.ban?.threshold || DEFAULT_CONFIG.ban.threshold
    const banDuration = config.ban?.duration || DEFAULT_CONFIG.ban.duration

    if (record.violations >= banThreshold && (maxSeverity === 'high' || record.violations >= banThreshold * 2)) {
        const reason = violations.map(v => v.type).join(',')
        bannedIPs.set(ip, {
            reason,
            bannedAt: now,
            expiresAt: now + banDuration,
        })
        store.addIpBan(ip, reason, banDuration, violations).catch(() => {})
        return {
            blocked: true,
            level: 'ban',
            reason,
            violations,
            retryAfter: Math.ceil(banDuration / 1000),
        }
    }

    return { blocked: false, level: maxSeverity, violations }
}

export const abuseDetectorMiddleware = async (c, next) => {
    const config = getEffectiveAbuseConfig()

    if (!config.enabled) {
        return await next()
    }

    cleanupExpired(config)
    loadBannedIPs()

    const ip = getClientIP(c)
    const path = c.req.path

    // 白名单路径/IP 与携带有效凭据的请求（管理后台会话等）完全跳过频控与封禁
    if (isWhitelisted(path, ip, config) || isValidAuth(c)) {
        c.set('clientIP', ip)
        return await next()
    }

    const result = detectAbuse(c, ip, path, config)

    if (result.blocked) {
        // 管理后台路径不做封禁拦截，保证被封禁的管理员仍可打开登录页自救
        if (isAdminPath(path)) {
            c.set('clientIP', ip)
            return await next()
        }

        await logBlockedHit(c, ip, path, result)

        c.status(429)
        return c.json({
            error: 'Too Many Requests',
            message: '请求过于频繁，请稍后再试',
            retryAfter: result.retryAfter,
        }, 429, {
            'Retry-After': String(Math.max(result.retryAfter || 0, 0)),
        })
    }

    if (result.level !== 'none' && result.violations.length > 0) {
        await store.addAbuseLog({
            ip,
            path,
            method: c.req.method,
            level: result.level,
            reason: result.violations.map(v => v.type).join(','),
            violations: result.violations,
            userAgent: c.req.header('User-Agent') || '',
            blocked: false,
        }).catch(() => {})
    }

    c.set('clientIP', ip)
    await next()
}

export const getAbuseStats = () => {
    return {
        activeRecords: requestRecords.size,
        bannedIPs: bannedIPs.size,
        topRequesters: Array.from(requestRecords.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([ip, r]) => ({
                ip,
                count: r.count,
                apiCount: r.apiCount,
                violations: r.violations,
                lastTime: r.lastTime,
            })),
        bannedList: Array.from(bannedIPs.entries()).map(([ip, b]) => ({
            ip,
            reason: b.reason,
            bannedAt: b.bannedAt,
            expiresAt: b.expiresAt,
        })),
    }
}

export const banIP = (ip, reason, duration, permanent = false) => {
    const now = Date.now()
    bannedIPs.set(ip, {
        reason: reason || 'manual_ban',
        bannedAt: now,
        expiresAt: permanent ? 0 : (now + (duration || DEFAULT_CONFIG.ban.duration)),
    })
    store.addIpBan(ip, reason || 'manual_ban', permanent ? 0 : (duration || DEFAULT_CONFIG.ban.duration), [], permanent).catch(() => {})
}

export const unbanIP = (ip) => {
    bannedIPs.delete(ip)
    store.removeIpBan(ip).catch(() => {})
}

export const isIPBanned = (ip) => bannedIPs.has(ip)

export const resetIPRecord = (ip) => {
    requestRecords.delete(ip)
}

export default abuseDetectorMiddleware

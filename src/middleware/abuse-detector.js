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
        // 敏感路径（.env / .git / wp-…）探测 → 直接封禁
        sensitivePaths: true,
        // 抓取型 UA 直接拦 /api（对 SEO 无价值，日志里占 17%~22%）
        uaBlock: true,
    },
    // 敏感路径封禁时长（默认 24 小时，期间再次命中会滑动续期）
    sensitivePathBan: {
        duration: 86400000,
    },
    // 按日配额：现有 QPS 规则挡不住「每分钟 1~2 次、持续数天」的慢速刷接口
    quota: {
        enabled: true,
        searchDailyLimit: 300,
    },
    blockedUserAgents: ['YisouSpider'],
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

/**
 * 敏感路径探测：正常访客永远不会访问这些地址，
 * 命中即封禁（日志里 .env / .git / wp- 变体长期占扫描流量的大头）。
 */
const SENSITIVE_PATH_PATTERNS = [
    /(?:^|\/)\.(?:env|git|svn|aws|ds_store)(?:$|[\/.])/i,
    /(?:^|\/)(?:wp-admin|wp-includes|wp-content|wp-json|xmlrpc\.php|phpmyadmin|pma|adminer)(?:\/|$|\.)/i,
    /(?:^|\/)(?:credentials|secrets?|aws-bedrock\.json|server-status|actuator|\.dockerenv)(?:\/|$)/i,
    /(?:^|\/)(?:config|database|backup|dump)\.(?:json|ya?ml|php|sql|bak|old|env)$/i,
]

// 内存计数器: ip -> { count, apiCount, firstTime, lastTime, violations, paths: Set }
const requestRecords = new Map()
// 内存封禁列表: ip -> { reason, bannedAt, expiresAt }
const bannedIPs = new Map()
// 按日配额: ip -> { day: YYYYMMDD, count }
const searchQuota = new Map()

/** 本地日期键，用于「每日」配额的翻页判断 */
const dayKey = (time = Date.now()) => {
    const d = new Date(time)
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

/** 距下一个本地零点还有多少秒（用作 Retry-After） */
const secondsUntilNextDay = (time = Date.now()) => {
    const next = new Date(time)
    next.setHours(24, 0, 0, 0)
    return Math.max(1, Math.ceil((next.getTime() - time) / 1000))
}

const matchBlockedUserAgent = (userAgent, config) => {
    if (!userAgent || config.rules?.uaBlock === false) return ''
    const list = Array.isArray(config.blockedUserAgents) ? config.blockedUserAgents : DEFAULT_CONFIG.blockedUserAgents
    const lower = userAgent.toLowerCase()
    return list.find(pattern => {
        if (!pattern) return false
        // 支持直接写子串（默认），也允许填 /regex/ 形式
        const asRegex = String(pattern).match(/^\/(.+)\/([a-z]*)$/)
        if (asRegex) {
            try {
                return new RegExp(asRegex[1], asRegex[2]).test(userAgent)
            } catch {
                return false
            }
        }
        return lower.includes(String(pattern).toLowerCase())
    }) || ''
}

/** 消耗一次 search 日配额；返回 null 表示放行，否则返回需要等待的秒数 */
const consumeSearchQuota = (ip, config, now) => {
    if (config.quota?.enabled === false) return null
    const limit = Number(config.quota?.searchDailyLimit ?? DEFAULT_CONFIG.quota.searchDailyLimit)
    if (!Number.isFinite(limit) || limit <= 0) return null

    const today = dayKey(now)
    let record = searchQuota.get(ip)
    if (!record || record.day !== today) {
        record = { day: today, count: 0 }
        searchQuota.set(ip, record)
    }
    record.count++
    if (record.count > limit) return secondsUntilNextDay(now)
    return null
}

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

export const getClientIP = (c) => {
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

const logBlockedHit = (c, ip, path, result, level = 'ban') => {
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

    return store.addAbuseLog({
        ip,
        path,
        method: c.req.method,
        level,
        reason: result.reason,
        violations: [],
        userAgent: c.req.header('User-Agent') || '',
        blocked: true,
        hitCount: hits,
    }).then(() => {
        // 顺带持久化滑动续期后的封禁到期时间，频率与日志节流一致
        if (level !== 'ban') return
        const banInfo = bannedIPs.get(ip)
        if (banInfo && banInfo.expiresAt > 0) {
            return store.extendIpBan(ip, banInfo.expiresAt)
        }
    }).catch(() => {})
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
    // 跨天的 search 配额记录直接丢弃，避免长期运行后内存无限增长
    const today = dayKey(now)
    for (const [ip, record] of searchQuota) {
        if (record.day !== today) searchQuota.delete(ip)
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

    /*
     * 拿不到真实 IP（本地开发、某些反代没透传 X-Forwarded-For）时，
     * 所有访问都会记到同一个 'unknown' 桶上——本机随便点几下就能把
     * 整个本地环境封掉，而封禁理由却记在一个无法归因的名字上。
     * 这里对 'unknown' 只放行、不计数、不封禁：宁可漏掉一个来源不明的
     * 攻击，也不能因为识别不出来源就误伤所有人。
     */
    if (!ip || ip === 'unknown') {
        c.set('clientIP', ip || 'unknown')
        return await next()
    }

    // 高置信封禁（敏感路径探测）对所有路径生效，包括白名单里的页面：
    // 扫描器被记录后不该还能继续访问站点。
    const earlyBan = bannedIPs.get(ip)
    if (earlyBan && earlyBan.reason === 'sensitive_path' &&
        (earlyBan.expiresAt === 0 || earlyBan.expiresAt > Date.now())) {
        return c.text('Forbidden', 403)
    }

    // 白名单路径/IP 与携带有效凭据的请求（管理后台会话等）完全跳过频控与封禁
    if (isWhitelisted(path, ip, config) || isValidAuth(c)) {
        c.set('clientIP', ip)
        return await next()
    }

    const isApiPath = path === '/api' || path.startsWith('/api/')

    // 敏感路径探测：命中即封禁，并返回 404（不给扫描器任何「这里存在」的信号）
    if (config.rules?.sensitivePaths !== false && !isAdminPath(path)) {
        const hit = SENSITIVE_PATH_PATTERNS.find(pattern => pattern.test(path))
        if (hit) {
            const now = Date.now()
            const duration = Number(config.sensitivePathBan?.duration ?? DEFAULT_CONFIG.sensitivePathBan.duration)
            const reason = 'sensitive_path'
            bannedIPs.set(ip, { reason, bannedAt: now, expiresAt: now + duration })
            const violation = { type: 'sensitive_path', severity: 'critical', detail: path }
            await store.addIpBan(ip, reason, duration, [violation]).catch(() => {})
            await store.addAbuseLog({
                ip,
                path,
                method: c.req.method,
                level: 'high',
                reason,
                violations: [violation],
                userAgent: c.req.header('User-Agent') || '',
                blocked: true,
            }).catch(() => {})
            return c.body('Not Found', 404)
        }
    }

    // 抓取型 UA：只作用于 /api。页面、robots、后台一律放行，
    // 否则被误判的客户端会连管理后台登录页都打不开。
    if (isApiPath && !isAdminPath(path)) {
        const blockedUA = matchBlockedUserAgent(c.req.header('User-Agent') || '', config)
        if (blockedUA) {
            await logBlockedHit(c, ip, path, { reason: `blocked_user_agent:${blockedUA}` }, 'medium')
            return c.json({
                error: 'Forbidden',
                message: '该客户端不允许访问 /api',
            }, 403)
        }

        // search 日配额：QPS 限流对「每分钟 1~2 次、持续数天」的慢速刷接口无效
        if (new URL(c.req.url).searchParams.get('type') === 'search') {
            const retryAfter = consumeSearchQuota(ip, config, Date.now())
            if (retryAfter !== null) {
                await store.addAbuseLog({
                    ip,
                    path,
                    method: c.req.method,
                    level: 'medium',
                    reason: 'search_daily_quota',
                    violations: [],
                    userAgent: c.req.header('User-Agent') || '',
                    blocked: true,
                }).catch(() => {})
                const limit = Number(config.quota?.searchDailyLimit ?? DEFAULT_CONFIG.quota.searchDailyLimit)
                return c.json({
                    error: 'Too Many Requests',
                    message: `search 每日配额已用尽（${limit} 次），请在次日 00:00 后重试`,
                    retryAfter,
                }, 429, { 'Retry-After': String(retryAfter) })
            }
        }
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
    const today = dayKey()
    const quotaRecords = Array.from(searchQuota.entries()).filter(([, r]) => r.day === today)
    return {
        activeRecords: requestRecords.size,
        bannedIPs: bannedIPs.size,
        searchQuota: {
            trackedIPs: quotaRecords.length,
            topUsed: quotaRecords
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 5)
                .map(([ip, r]) => ({ ip, count: r.count })),
        },
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
    searchQuota.delete(ip)
}

export default abuseDetectorMiddleware

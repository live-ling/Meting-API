/**
 * API 调用日志模块
 * 记录每次 /api 调用的详细信息，支持查询、过滤、分页和 CSV 导出
 */

import fs from 'fs'
import path from 'path'
import store from '../admin/store.js'
import {
    geoCountry,
    getCachedGeo,
    geoLabel,
    geoDetail,
    lookupGeo,
    isPublicIP,
    hasGeoProvider,
} from './geo.js'

const DATA_DIR = globalThis?.process?.env?.DATA_DIR || './data'
const LOGS_FILE = 'api_logs.json'
const MAX_LOGS = 5000

/** @type {Array<{id:string, timestamp:number, ip:string, server:string, type:string, requestId:string, status:string, statusCode:number, durationMs:number, songName:string, songArtist:string, error:string, userAgent:string}>} */
let logs = []

let saveTimer = null
const SAVE_INTERVAL = 2000 // 防抖保存间隔
let changed = false

// === 持久化 ===

const ensureDir = () => {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true })
        }
    } catch (_) {}
}

const loadFromFile = () => {
    ensureDir()
    const filePath = path.join(DATA_DIR, LOGS_FILE)
    try {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            if (Array.isArray(data)) {
                logs = data.slice(-MAX_LOGS)
            }
        }
    } catch (e) {
        console.log('[ApiLogger] 加载日志失败:', e.message)
    }
}

const saveToFile = () => {
    if (!changed) return
    changed = false
    ensureDir()
    try {
        const toSave = logs.slice(-MAX_LOGS)
        fs.writeFileSync(path.join(DATA_DIR, LOGS_FILE), JSON.stringify(toSave, null, 2))
    } catch (e) {
        console.log('[ApiLogger] 保存日志失败:', e.message)
    }
}

const scheduleSave = () => {
    changed = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveToFile, SAVE_INTERVAL)
}

// === 初始化 ===

loadFromFile()

/** 用本地 IP 缓存补齐磁盘上还没有归属地的旧日志，避免打开页面时一片「待解析」。 */
const hydrateCachedGeo = () => {
    let touched = false
    for (const log of logs) {
        if (log.geo) continue
        const cached = getCachedGeo(log.ip)
        if (!cached) continue
        log.geo = cached
        log.country = cached.countryCode || log.country
        touched = true
    }
    if (touched) scheduleSave()
}

hydrateCachedGeo()

// === IP 获取 ===
// 与 middleware/abuse-detector.js 共用同一套解析（受信代理 + 内网地址过滤），
// 保证日志统计和风控看到的是同一个身份。
import { getClientIP } from '../middleware/abuse-detector.js'

// === 歌曲信息提取 ===

const extractSongInfo = (data, type) => {
    if (!data) return { name: '', artist: '' }
    try {
        if (Array.isArray(data) && data.length > 0) {
            const song = data[0]
            return {
                name: song.name || song.title || '',
                artist: song.artist || song.author || (Array.isArray(song.artist) ? song.artist.join('/') : ''),
            }
        }
    } catch (_) {}
    return { name: '', artist: '' }
}

// === id 生成 ===

let idCounter = 0
const generateId = () => `${Date.now()}_${++idCounter}_${Math.random().toString(36).slice(2, 7)}`

// === 写入日志 ===

/** 在线归属地返回后，回填同一 IP 的历史日志，避免新旧数据口径不一致 */
const applyGeo = (ip, geo) => {
    let touched = false
    for (const log of logs) {
        if (log.ip !== ip) continue
        if (log.geo && log.geo.updatedAt >= geo.updatedAt) continue
        log.geo = geo
        log.country = geo.countryCode || log.country
        touched = true
    }
    if (touched) scheduleSave()
}

const addLog = (entry) => {
    const ip = entry.ip || 'unknown'
    const cachedGeo = getCachedGeo(ip)
    const log = {
        id: generateId(),
        timestamp: Date.now(),
        ip,
        server: entry.server || '',
        type: entry.type || '',
        requestId: entry.requestId || '',
        status: entry.status || 'unknown',
        statusCode: entry.statusCode || 0,
        durationMs: entry.durationMs || 0,
        songName: entry.songName || '',
        songArtist: entry.songArtist || '',
        error: entry.error || '',
        userAgent: (entry.userAgent || '').slice(0, 256),
        // 来源追踪：从哪个站点跳过来、访问的是哪个域名
        referer: (entry.referer || '').slice(0, 512),
        host: (entry.host || '').slice(0, 128),
        // 归属地：离线国家码先兜底；在线查询是异步的，返回后通过 applyGeo 回填
        country: cachedGeo?.countryCode || geoCountry(ip),
        geo: cachedGeo || null,
    }
    logs.push(log)
    if (logs.length > MAX_LOGS * 1.5) {
        logs = logs.slice(-MAX_LOGS)
    }
    scheduleSave()

    // 不在 /api 响应链路里等待网络：命中缓存则上面已填好，未命中才后台查
    if (!cachedGeo && ip !== 'unknown') {
        try {
            const geoConfig = store.getGeoConfig()
            lookupGeo(ip, geoConfig)
                .then((geo) => { if (geo) applyGeo(ip, geo) })
                .catch(() => {})
        } catch (_) {}
    }
}

// === 查询 ===

/** 统一筛选逻辑，平铺与按 IP 聚合共用。 */
const filterLogs = ({ startTime, endTime, ip, ipExact, server, type, status, keyword, refererSite } = {}) => {
    let filtered = [...logs]

    if (startTime) {
        const st = Number(startTime)
        if (!isNaN(st)) filtered = filtered.filter(l => l.timestamp >= st)
    }
    if (endTime) {
        const et = Number(endTime)
        if (!isNaN(et)) filtered = filtered.filter(l => l.timestamp <= et)
    }
    if (ipExact) {
        filtered = filtered.filter(l => l.ip === ipExact)
    } else if (ip) {
        filtered = filtered.filter(l => l.ip.includes(ip))
    }
    if (server) {
        filtered = filtered.filter(l => l.server === server)
    }
    if (type) {
        filtered = filtered.filter(l => l.type === type)
    }
    if (status) {
        filtered = filtered.filter(l => l.status === status)
    }
    if (keyword) {
        const kw = keyword.toLowerCase()
        filtered = filtered.filter(l =>
            String(l.requestId || '').toLowerCase().includes(kw) ||
            String(l.songName || '').toLowerCase().includes(kw) ||
            String(l.songArtist || '').toLowerCase().includes(kw) ||
            String(l.error || '').toLowerCase().includes(kw)
        )
    }
    if (refererSite) {
        const target = String(refererSite).toLowerCase()
        filtered = filtered.filter(l => refererHost(l.referer) === target)
    }

    // 最新在前
    filtered.sort((a, b) => b.timestamp - a.timestamp)
    return filtered
}

/**
 * 日志里的 IP 可能早于归属地查询上线；打开日志页时后台补一次。
 * 只补当前页缺失、且确实有通道可用的 IP，返回仍待解析的数量给前端轮询。
 */
const ensureGeo = (items) => {
    const config = store.getGeoConfig()
    const seen = new Set()
    let pending = 0
    for (const item of items || []) {
        const ip = item?.ip
        if (!ip || item.geo || seen.has(ip)) continue
        seen.add(ip)
        if (!isPublicIP(ip)) continue
        const cached = getCachedGeo(ip)
        if (cached) {
            applyGeo(ip, cached)
            continue
        }
        if (!hasGeoProvider(ip, config)) continue
        pending++
        lookupGeo(ip, config)
            .then((geo) => { if (geo) applyGeo(ip, geo) })
            .catch(() => {})
    }
    return pending
}

const topEntry = (counts) => Object.entries(counts || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || ''

const getLogs = ({ startTime, endTime, ip, ipExact, server, type, status, keyword, refererSite, page = 1, pageSize = 50 } = {}) => {
    const filtered = filterLogs({ startTime, endTime, ip, ipExact, server, type, status, keyword, refererSite })

    const total = filtered.length
    const totalPages = Math.ceil(total / pageSize) || 1
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return { items, total, totalPages, page, pageSize, grouped: false, geoPending: ensureGeo(items) }
}

/**
 * 按 IP 聚合：同一个来源 IP 的多次调用折叠成一行，详情由前端展开时再取。
 * 分页单位是「IP 组」，不是调用条数。
 */
const getGroupedLogs = ({
    startTime,
    endTime,
    ip,
    server,
    type,
    status,
    keyword,
    refererSite,
    page = 1,
    pageSize = 25,
} = {}) => {
    const filtered = filterLogs({ startTime, endTime, ip, ipExact: '', server, type, status, keyword, refererSite })
    const map = new Map()

    for (const log of filtered) {
        const key = log.ip || 'unknown'
        let group = map.get(key)
        if (!group) {
            group = {
                ip: key,
                count: 0,
                successCount: 0,
                errorCount: 0,
                durationTotal: 0,
                firstSeen: log.timestamp,
                lastSeen: log.timestamp,
                statusCodes: {},
                servers: {},
                types: {},
                referers: {},
                hosts: {},
                geo: null,
                country: '',
                latest: null,
            }
            map.set(key, group)
        }
        group.count++
        if (log.status === 'success') group.successCount++
        else group.errorCount++
        group.durationTotal += Number(log.durationMs) || 0
        if (log.timestamp < group.firstSeen) group.firstSeen = log.timestamp
        if (log.timestamp > group.lastSeen) group.lastSeen = log.timestamp
        const statusCode = String(log.statusCode ?? 0)
        group.statusCodes[statusCode] = (group.statusCodes[statusCode] || 0) + 1
        group.servers[log.server] = (group.servers[log.server] || 0) + 1
        const typeKey = normalizeType(log.type)
        group.types[typeKey] = (group.types[typeKey] || 0) + 1
        const referer = refererHost(log.referer)
        group.referers[referer] = (group.referers[referer] || 0) + 1
        if (log.host) group.hosts[log.host] = (group.hosts[log.host] || 0) + 1
        if (log.geo && (!group.geo || Number(log.geo.updatedAt) > Number(group.geo.updatedAt))) {
            group.geo = log.geo
        }
        if (!group.country && log.country) group.country = log.country
        if (!group.latest) group.latest = log
    }

    const groups = Array.from(map.values()).map((group) => {
        const statusCodes = Object.entries(group.statusCodes)
            .sort((a, b) => b[1] - a[1])
            .map(([code, count]) => ({ code, count }))
        const referer = topEntry(group.referers)
        return {
            ip: group.ip,
            count: group.count,
            successCount: group.successCount,
            errorCount: group.errorCount,
            successRate: group.count ? group.successCount / group.count : 0,
            avgDurationMs: group.count ? Math.round(group.durationTotal / group.count) : 0,
            firstSeen: group.firstSeen,
            lastSeen: group.lastSeen,
            statusCodes,
            servers: group.servers,
            types: group.types,
            topServer: topEntry(group.servers),
            topType: topEntry(group.types),
            topReferer: referer,
            topHost: topEntry(group.hosts),
            country: group.country || group.geo?.countryCode || '',
            geo: group.geo || null,
            geoLabel: group.geo ? geoDetail(group.geo) : '',
            latest: group.latest,
        }
    }).sort((a, b) => b.lastSeen - a.lastSeen)

    const total = groups.length
    const totalCalls = filtered.length
    const totalPages = Math.ceil(total / pageSize) || 1
    const start = (page - 1) * pageSize
    const items = groups.slice(start, start + pageSize)

    return {
        items,
        total,
        totalCalls,
        totalPages,
        page,
        pageSize,
        grouped: true,
        geoPending: ensureGeo(items),
    }
}

// === 统计 ===

const VALID_TYPES = new Set(['song', 'url', 'lrc', 'pic', 'search', 'playlist', 'album', 'artist'])
/** 扫描器会把 SQL 片段塞进 type 参数；统计时统一归到 invalid，避免污染类型分布 */
const normalizeType = (type) => VALID_TYPES.has(type) ? type : 'invalid'

const getStats = ({ hours = 24 } = {}) => {
    const now = Date.now()
    const span = Math.max(1, Math.min(24 * 30, Number(hours) || 24))
    const since = now - span * 60 * 60 * 1000
    const last24hSince = now - 24 * 60 * 60 * 1000
    const recent = logs.filter(l => l.timestamp >= since)
    const last24hLogs = span === 24 ? recent : logs.filter(l => l.timestamp >= last24hSince)

    const byServer = {}
    const byType = {}
    const byStatus = {}

    for (const l of recent) {
        const typeKey = normalizeType(l.type)
        byServer[l.server] = (byServer[l.server] || 0) + 1
        byType[typeKey] = (byType[typeKey] || 0) + 1
        byStatus[l.status] = (byStatus[l.status] || 0) + 1
    }

    const uniqueIPs = new Set(recent.map(l => l.ip)).size
    const uniqueIPs24h = span === 24 ? uniqueIPs : new Set(last24hLogs.map(l => l.ip)).size

    return {
        total: logs.length,
        hours: span,
        rangeCount: recent.length,
        uniqueIPs,
        // 兼容旧调用方：始终返回真实的近 24 小时数据
        last24h: last24hLogs.length,
        uniqueIPs24h,
        byServer,
        byType,
        byStatus,
    }
}

/** 把 Referer 归一成来源站点：直接访问、无效来源、外部域名分开统计 */
const refererHost = (referer) => {
    if (!referer) return 'direct'
    try {
        const host = new URL(referer).hostname.toLowerCase().replace(/^www\./, '')
        return host || 'direct'
    } catch {
        return 'invalid'
    }
}

/** 把 { key: count } 摊平成前端好渲染的数组。 */
const distribution = (counts, total, limit = 6, exclude = []) => Object.entries(counts || {})
    .filter(([name]) => name && !exclude.includes(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, share: total ? count / total : 0 }))

/**
 * 来源统计：按 Referer 的站点聚合。
 * 每个来源还会带上平台/类型/地区/Host 分布和 Top IP，供前端展开详情。
 * @param {{ hours?: number, limit?: number, host?: string }} options
 */
const getRefererStats = ({ hours = 24, limit = 30, host = '' } = {}) => {
    const since = Date.now() - Math.max(1, hours) * 60 * 60 * 1000
    const scoped = logs.filter(l => l.timestamp >= since && (!host || l.host === host))

    const map = new Map()
    const countryCounts = {}
    const regionCounts = {}
    for (const log of scoped) {
        const key = refererHost(log.referer)
        let item = map.get(key)
        if (!item) {
            item = {
                host: key,
                count: 0,
                successCount: 0,
                errorCount: 0,
                ips: new Set(),
                ipStats: new Map(),
                servers: {},
                types: {},
                countries: {},
                regions: {},
                hostHeaders: {},
                firstSeen: Infinity,
                lastSeen: 0,
            }
            map.set(key, item)
        }
        item.count++
        if (log.status === 'success') item.successCount++
        else item.errorCount++
        item.ips.add(log.ip)
        item.servers[log.server] = (item.servers[log.server] || 0) + 1
        const typeKey = normalizeType(log.type)
        item.types[typeKey] = (item.types[typeKey] || 0) + 1
        const country = log.country || '??'
        item.countries[country] = (item.countries[country] || 0) + 1
        countryCounts[country] = (countryCounts[country] || 0) + 1
        const region = geoLabel(log.geo)
        if (region) {
            item.regions[region] = (item.regions[region] || 0) + 1
            regionCounts[region] = (regionCounts[region] || 0) + 1
        }
        if (log.host) item.hostHeaders[log.host] = (item.hostHeaders[log.host] || 0) + 1
        if (log.timestamp < item.firstSeen) item.firstSeen = log.timestamp
        if (log.timestamp > item.lastSeen) item.lastSeen = log.timestamp

        const ipKey = log.ip || 'unknown'
        let ipInfo = item.ipStats.get(ipKey)
        if (!ipInfo) {
            ipInfo = { ip: ipKey, count: 0, success: 0, error: 0, country: '', geo: null, lastSeen: 0 }
            item.ipStats.set(ipKey, ipInfo)
        }
        ipInfo.count++
        if (log.status === 'success') ipInfo.success++
        else ipInfo.error++
        if (log.timestamp > ipInfo.lastSeen) ipInfo.lastSeen = log.timestamp
        if (log.country && !ipInfo.country) ipInfo.country = log.country
        if (log.geo && (!ipInfo.geo || Number(log.geo.updatedAt) > Number(ipInfo.geo.updatedAt))) {
            ipInfo.geo = log.geo
        }
    }

    const total = scoped.length
    const items = Array.from(map.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(item => {
            const topIPs = Array.from(item.ipStats.values())
                .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
                .slice(0, 12)
                .map(ipInfo => ({
                    ip: ipInfo.ip,
                    count: ipInfo.count,
                    success: ipInfo.success,
                    error: ipInfo.error,
                    share: item.count ? ipInfo.count / item.count : 0,
                    country: ipInfo.country,
                    geoLabel: ipInfo.geo ? geoDetail(ipInfo.geo) : (ipInfo.country || ''),
                    source: ipInfo.geo?.providerLabel || ipInfo.geo?.source || '',
                    lastSeen: ipInfo.lastSeen,
                }))
            return {
                host: item.host,
                count: item.count,
                successCount: item.successCount,
                errorCount: item.errorCount,
                uniqueIPs: item.ips.size,
                share: total ? item.count / total : 0,
                firstSeen: Number.isFinite(item.firstSeen) ? item.firstSeen : item.lastSeen,
                lastSeen: item.lastSeen,
                topServer: Object.entries(item.servers).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
                topType: Object.entries(item.types).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
                topCountry: Object.entries(item.countries).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
                topRegion: Object.entries(item.regions).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
                topIP: topIPs[0]?.ip || '',
                servers: distribution(item.servers, item.count),
                types: distribution(item.types, item.count),
                countries: distribution(item.countries, item.count, 6, ['??']),
                regions: distribution(item.regions, item.count),
                hostHeaders: distribution(item.hostHeaders, item.count, 6),
                topIPs,
            }
        })

    const countries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([code, count]) => ({ code, count, share: total ? count / total : 0 }))
    const regions = Object.entries(regionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([label, count]) => ({ label, count, share: total ? count / total : 0 }))

    return {
        hours,
        total,
        direct: Array.from(map.values()).filter(i => i.host === 'direct').reduce((sum, i) => sum + i.count, 0),
        uniqueHosts: map.size,
        items,
        countries,
        regions,
        hosts: Array.from(map.keys()).sort(),
    }
}

/**
 * 按小时分桶的请求趋势，供看板画柱状图。
 * @param {{ hours?: number }} options
 */
const getTimeseries = ({ hours = 24 } = {}) => {
    const span = Math.max(1, Math.min(24 * 30, Number(hours) || 24))
    // 24h 用小时桶，7d 用 6 小时桶，30d 用天桶；点数保持在 24~30 个左右
    const bucketMs = span <= 48
        ? 60 * 60 * 1000
        : span <= 168
            ? 6 * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000
    const bucketCount = Math.max(1, Math.ceil((span * 60 * 60 * 1000) / bucketMs))
    const now = Date.now()
    const start = now - bucketCount * bucketMs
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
        t: start + i * bucketMs,
        total: 0,
        success: 0,
        error: 0,
        ips: new Set(),
    }))

    for (const log of logs) {
        if (log.timestamp < start) continue
        const index = Math.min(bucketCount - 1, Math.floor((log.timestamp - start) / bucketMs))
        const bucket = buckets[index]
        bucket.total++
        if (log.status === 'success') bucket.success++
        else bucket.error++
        bucket.ips.add(log.ip)
    }

    return buckets.map(bucket => ({
        t: bucket.t,
        bucketMs,
        total: bucket.total,
        success: bucket.success,
        error: bucket.error,
        uniqueIPs: bucket.ips.size,
    }))
}

// === 清理 ===

const clearLogs = () => {
    logs = []
    changed = true
    saveToFile()
    return true
}

// === CSV 导出 ===

const BOM = '\uFEFF'

const escapeCSV = (val) => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
}

const exportCSV = ({ startTime, endTime, ip, server, type, status, keyword, refererSite } = {}) => {
    const { items } = getLogs({ startTime, endTime, ip, server, type, status, keyword, refererSite, page: 1, pageSize: 10000 })

    const headers = ['时间', 'IP地址', '归属地', '归属地来源', '来源站点', 'Referer', 'Host', '平台', '类型', '请求ID', '状态码', '状态', '耗时(ms)', '歌曲名称', '歌手', '错误信息', 'User-Agent']
    const rows = items.map(l => [
        new Date(l.timestamp).toLocaleString('zh-CN'),
        l.ip,
        geoDetail(l.geo) || l.country || '',
        l.geo?.providerLabel || l.geo?.source || '',
        (() => {
            if (!l.referer) return 'direct'
            try {
                return new URL(l.referer).hostname || 'invalid'
            } catch {
                return 'invalid'
            }
        })(),
        l.referer || '',
        l.host || '',
        l.server,
        l.type,
        l.requestId,
        String(l.statusCode),
        l.status,
        String(l.durationMs),
        l.songName,
        l.songArtist,
        l.error,
        l.userAgent,
    ].map(escapeCSV).join(','))

    return BOM + [headers.join(','), ...rows].join('\n')
}

export default {
    addLog,
    getLogs,
    getGroupedLogs,
    getStats,
    getRefererStats,
    getTimeseries,
    clearLogs,
    exportCSV,
    getClientIP,
    extractSongInfo,
}

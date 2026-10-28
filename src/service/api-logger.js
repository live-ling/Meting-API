/**
 * API 调用日志模块
 * 记录每次 /api 调用的详细信息，支持查询、过滤、分页和 CSV 导出
 */

import fs from 'fs'
import path from 'path'
import store from '../admin/store.js'
import { geoCountry, getCachedGeo, geoLabel, lookupGeo } from './geo.js'

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

// === IP 获取 ===

const getClientIP = (c) => {
    const forwarded = c?.req?.header('X-Forwarded-For')
    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }
    return c?.req?.header('X-Real-IP') || 'unknown'
}

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

const getLogs = ({ startTime, endTime, ip, server, type, status, keyword, page = 1, pageSize = 50 } = {}) => {
    let filtered = [...logs]

    if (startTime) {
        const st = Number(startTime)
        if (!isNaN(st)) filtered = filtered.filter(l => l.timestamp >= st)
    }
    if (endTime) {
        const et = Number(endTime)
        if (!isNaN(et)) filtered = filtered.filter(l => l.timestamp <= et)
    }
    if (ip) {
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
            l.requestId.includes(kw) ||
            l.songName.toLowerCase().includes(kw) ||
            l.songArtist.toLowerCase().includes(kw) ||
            (l.error && l.error.toLowerCase().includes(kw))
        )
    }

    // 最新在前
    filtered.sort((a, b) => b.timestamp - a.timestamp)

    const total = filtered.length
    const totalPages = Math.ceil(total / pageSize) || 1
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return { items, total, totalPages, page, pageSize }
}

// === 统计 ===

const getStats = () => {
    const now = Date.now()
    const last24h = now - 24 * 60 * 60 * 1000
    const recent = logs.filter(l => l.timestamp > last24h)
    
    const byServer = {}
    const byType = {}
    const byStatus = {}
    
    for (const l of recent) {
        byServer[l.server] = (byServer[l.server] || 0) + 1
        byType[l.type] = (byType[l.type] || 0) + 1
        byStatus[l.status] = (byStatus[l.status] || 0) + 1
    }

    const uniqueIPs = new Set(recent.map(l => l.ip)).size

    return {
        total: logs.length,
        last24h: recent.length,
        uniqueIPs24h: uniqueIPs,
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

/**
 * 来源统计：按 Referer 的站点聚合。
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
            item = { host: key, count: 0, ips: new Set(), servers: {}, types: {}, countries: {}, regions: {}, lastSeen: 0 }
            map.set(key, item)
        }
        item.count++
        item.ips.add(log.ip)
        item.servers[log.server] = (item.servers[log.server] || 0) + 1
        item.types[log.type] = (item.types[log.type] || 0) + 1
        const country = log.country || '??'
        item.countries[country] = (item.countries[country] || 0) + 1
        countryCounts[country] = (countryCounts[country] || 0) + 1
        const region = geoLabel(log.geo)
        if (region) {
            item.regions[region] = (item.regions[region] || 0) + 1
            regionCounts[region] = (regionCounts[region] || 0) + 1
        }
        if (log.timestamp > item.lastSeen) item.lastSeen = log.timestamp
    }

    const total = scoped.length
    const items = Array.from(map.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(item => ({
            host: item.host,
            count: item.count,
            uniqueIPs: item.ips.size,
            share: total ? item.count / total : 0,
            lastSeen: item.lastSeen,
            topServer: Object.entries(item.servers).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
            topType: Object.entries(item.types).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
            topCountry: Object.entries(item.countries).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
            topRegion: Object.entries(item.regions).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
        }))

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
        direct: items.filter(i => i.host === 'direct').reduce((sum, i) => sum + i.count, 0),
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
    const bucketMs = 60 * 60 * 1000
    const span = Math.max(1, Math.min(72, hours))
    const now = Date.now()
    const start = now - span * bucketMs
    const buckets = Array.from({ length: span }, (_, i) => ({
        t: start + i * bucketMs,
        total: 0,
        success: 0,
        error: 0,
        ips: new Set(),
    }))

    for (const log of logs) {
        if (log.timestamp < start) continue
        const index = Math.min(span - 1, Math.floor((log.timestamp - start) / bucketMs))
        const bucket = buckets[index]
        bucket.total++
        if (log.status === 'success') bucket.success++
        else bucket.error++
        bucket.ips.add(log.ip)
    }

    return buckets.map(bucket => ({
        t: bucket.t,
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

const exportCSV = ({ startTime, endTime, ip, server, type, status, keyword } = {}) => {
    const { items } = getLogs({ startTime, endTime, ip, server, type, status, keyword, page: 1, pageSize: 10000 })

    const headers = ['时间', 'IP地址', '来源站点', 'Referer', 'Host', '平台', '类型', '请求ID', '状态码', '状态', '耗时(ms)', '歌曲名称', '歌手', '错误信息', 'User-Agent']
    const rows = items.map(l => [
        new Date(l.timestamp).toLocaleString('zh-CN'),
        l.ip,
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
    getStats,
    getRefererStats,
    getTimeseries,
    clearLogs,
    exportCSV,
    getClientIP,
    extractSongInfo,
}

/**
 * IP 归属地。
 *
 * 两级策略：
 * 1. 离线国家库（ip3country）：同步、零成本，日志写入时先用它兜底；
 * 2. 在线通道：按后台配置的顺序依次尝试（ShowAPI / ipwho.is / ipapi.co / ip.sb），
 *    某个通道失败或不支持当前 IP（例如 ShowAPI 不支持 IPv6）时自动切到下一个。
 *
 * 在线查询按 IP 缓存到 data/ip_geo_cache.json，重复 IP 只查一次；
 * 查询永远不阻塞 /api 响应：api-logger 先写日志，再在后台补全并回填。
 */
import fs from 'fs'
import path from 'path'
import ip3country from 'ip3country'
import {
    GEO_PROVIDER_MAP,
    defaultGeoProviderConfig,
    normalizeGeoProviderConfig,
    requestGeoProvider,
    resolveGeoProviders,
    isGeoProviderUsable,
} from './geo-providers.js'

const DATA_DIR = globalThis?.process?.env?.DATA_DIR || './data'
const CACHE_FILE = 'ip_geo_cache.json'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000
const NEGATIVE_TTL = 10 * 60 * 1000
const MAX_CACHE = 5000
const MAX_PENDING = 200
const MAX_CONCURRENT = 2
/** 后台“测试通道”用更短超时，避免一个不可达通道把整次测试拖到 6 秒 */
const TEST_TIMEOUT = 4000

let ready = false
try {
    ip3country.init()
    ready = true
} catch {
    ready = false
}

/** @type {Map<string, {country:string,countryCode:string,region:string,city:string,isp:string,source:string,updatedAt:number}>} */
const cache = new Map()
/** @type {Map<string, {message:string,at:number}>} */
const negativeCache = new Map()
/** @type {Map<string, Promise<any>>} */
const inFlight = new Map()
const queue = []
let active = 0
let saveTimer = null

const ensureDir = () => {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    } catch (_) {}
}

const saveNow = () => {
    ensureDir()
    try {
        const data = Object.fromEntries(cache)
        fs.writeFileSync(path.join(DATA_DIR, CACHE_FILE), JSON.stringify(data, null, 2))
    } catch (e) {
        console.log('[Geo] 保存 IP 缓存失败:', e.message)
    }
}

const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 2000)
}

const normalizeEntry = (entry) => ({
    ip: String(entry?.ip || ''),
    country: String(entry?.country || ''),
    countryCode: String(entry?.countryCode || '').toUpperCase(),
    region: String(entry?.region || ''),
    city: String(entry?.city || ''),
    county: String(entry?.county || ''),
    isp: String(entry?.isp || ''),
    continents: String(entry?.continents || ''),
    cityCode: String(entry?.cityCode || ''),
    lat: String(entry?.lat || ''),
    lng: String(entry?.lng || ''),
    enName: String(entry?.enName || ''),
    enNameShort: String(entry?.enNameShort || ''),
    remark: String(entry?.remark || ''),
    source: String(entry?.source || ''),
    providerLabel: String(entry?.providerLabel || GEO_PROVIDER_MAP.get(entry?.source)?.label || entry?.source || ''),
    attempts: Array.isArray(entry?.attempts) ? entry.attempts : [],
    updatedAt: Number(entry?.updatedAt) || 0,
})

const loadCache = () => {
    ensureDir()
    const filePath = path.join(DATA_DIR, CACHE_FILE)
    try {
        if (!fs.existsSync(filePath)) return
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const now = Date.now()
        for (const [ip, entry] of Object.entries(raw || {})) {
            if (!entry || typeof entry !== 'object') continue
            const normalized = normalizeEntry(entry)
            if (!normalized.updatedAt || now - normalized.updatedAt > CACHE_TTL) continue
            cache.set(ip, normalized)
        }
    } catch (e) {
        console.log('[Geo] 加载 IP 缓存失败:', e.message)
    }
}

const pruneCache = () => {
    if (cache.size <= MAX_CACHE) return
    const sorted = [...cache.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)
    const removeCount = cache.size - MAX_CACHE
    for (let i = 0; i < removeCount; i++) cache.delete(sorted[i][0])
}

/** @param {string} ip @returns {string} 两位国家代码，如 CN / US；未知返回 '' */
export const geoCountry = (ip) => {
    if (!ready || !ip || ip === 'unknown') return ''
    try {
        return ip3country.lookupStr(ip) || ''
    } catch {
        return ''
    }
}

export const geoAvailable = () => ready

const normalizeIP = (ip) => {
    if (!ip || typeof ip !== 'string') return ''
    let value = ip.trim()
    if (value.startsWith('::ffff:') && value.includes('.')) value = value.slice(7)
    if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
    return value
}

const isIPv4 = (ip) => {
    const parts = ip.split('.')
    return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

const isPrivateIPv4 = (ip) => {
    const [a, b, c] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true
    if (a === 198 && (b === 18 || b === 19)) return true
    if (a === 198 && b === 51 && c === 100) return true
    if (a === 203 && b === 0 && c === 113) return true
    if (a >= 224) return true
    return false
}

export const isPublicIP = (ip) => {
    if (!ip) return false
    if (isIPv4(ip)) return !isPrivateIPv4(ip)
    if (!ip.includes(':')) return false
    const lower = ip.toLowerCase()
    if (lower === '::' || lower === '::1') return false
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return false
    if (lower.startsWith('2001:db8')) return false
    return /^[0-9a-f:]+$/.test(lower)
}

/**
 * 统一旧配置（{enabled,key}）与新配置（{enabled,providers}）。
 * 旧调用方只传 key 时，ShowAPI 作为主通道，ipwho.is 仍保留为备用。
 */
const normalizeLookupConfig = (config = {}) => {
    if (config?.providers && typeof config.providers === 'object') {
        return {
            enabled: config.enabled !== false,
            providers: normalizeGeoProviderConfig(config.providers),
        }
    }
    const providers = defaultGeoProviderConfig()
    if (typeof config?.key === 'string') providers.showapi.key = config.key.trim()
    return {
        enabled: config?.enabled !== false,
        providers,
    }
}

/** 当前 IP 可用的通道列表（已启用 + 密钥齐全 + IPv6 兼容）。 */
export const getUsableGeoProviders = (ip, config = {}) => {
    const normalizedConfig = normalizeLookupConfig(config)
    if (normalizedConfig.enabled === false) return []
    return resolveGeoProviders(normalizedConfig).filter((provider) => isGeoProviderUsable(provider, ip))
}

/** 是否有任意通道可以查询这个 IP（用于判断要不要显示「待解析」）。 */
export const hasGeoProvider = (ip, config = {}) => getUsableGeoProviders(ip, config).length > 0

/** 所有通道都失败时抛出汇总错误。 */
const requestGeoWithProviders = async (ip, providers) => {
    const attempts = []
    for (let index = 0; index < providers.length; index++) {
        const provider = providers[index]
        try {
            const fields = await requestGeoProvider(provider.id, ip, provider)
            return normalizeEntry({
                ...fields,
                ip,
                source: provider.id,
                providerLabel: provider.label,
                attempts,
                updatedAt: Date.now(),
            })
        } catch (e) {
            attempts.push({ id: provider.id, label: provider.label, error: e?.message || '查询失败' })
            if (index < providers.length - 1) {
                console.log(`[Geo] ${provider.label} 失败，切换下一个通道: ${e?.message || e}`)
            }
        }
    }
    const error = new Error(
        attempts.map((item) => `${item.label}: ${item.error}`).join('；') || '没有可用的归属地通道'
    )
    error.attempts = attempts
    throw error
}

const pumpQueue = () => {
    while (active < MAX_CONCURRENT && queue.length > 0) {
        const job = queue.shift()
        active++
        Promise.resolve()
            .then(job.task)
            .then(job.resolve, job.reject)
            .finally(() => {
                active--
                pumpQueue()
            })
    }
}

const enqueue = (task) => new Promise((resolve, reject) => {
    if (queue.length >= MAX_PENDING) {
        reject(new Error('IP 查询队列已满'))
        return
    }
    queue.push({ task, resolve, reject })
    pumpQueue()
})

/** 读取仍在有效期内的缓存；过期条目会被顺手删除。 */
export const getCachedGeo = (ip) => {
    const normalized = normalizeIP(ip)
    if (!normalized) return null
    const entry = cache.get(normalized)
    if (!entry) return null
    if (Date.now() - entry.updatedAt > CACHE_TTL) {
        cache.delete(normalized)
        scheduleSave()
        return null
    }
    return entry
}

/** 把省/市拼成一行；没有省市时退回国家名。 */
export const geoLabel = (entry) => {
    if (!entry) return ''
    const parts = [entry.region, entry.city].filter(Boolean)
    if (parts.length) return parts.join(' · ')
    return entry.country || entry.countryCode || ''
}

/** 国家 / 省 / 市 / 区，去重后用「·」连接。 */
export const geoSummary = (entry) => {
    if (!entry) return ''
    const parts = []
    for (const value of [entry.country, entry.region, entry.city, entry.county]) {
        const text = String(value || '').trim()
        if (text && !parts.includes(text)) parts.push(text)
    }
    if (!parts.length && entry.countryCode) parts.push(String(entry.countryCode))
    return parts.join(' · ')
}

/** 完整一行：地区 + 运营商。 */
export const geoDetail = (entry) => {
    if (!entry) return ''
    const parts = [geoSummary(entry)]
    if (entry.isp) parts.push(String(entry.isp))
    return parts.filter(Boolean).join(' · ')
}

/**
 * 查询一个 IP（带本地缓存 + 并发队列）。没有可用通道或已关闭时直接返回 null。
 * @param {string} ip
 * @param {{enabled?:boolean,key?:string,providers?:object}} config
 */
export const lookupGeo = (ip, config = {}) => {
    const normalized = normalizeIP(ip)
    if (!normalized) return Promise.resolve(null)
    if (!isPublicIP(normalized)) return Promise.resolve(null)

    // 本地缓存不依赖在线通道：即使后台暂时关闭查询，已有归属地仍可回填旧日志
    const cached = getCachedGeo(normalized)
    if (cached) return Promise.resolve(cached)

    const providers = getUsableGeoProviders(normalized, config)
    if (!providers.length) return Promise.resolve(null)

    const negative = negativeCache.get(normalized)
    if (negative && Date.now() - negative.at < NEGATIVE_TTL) return Promise.resolve(null)
    if (inFlight.has(normalized)) return inFlight.get(normalized)

    const promise = enqueue(() => requestGeoWithProviders(normalized, providers))
        .then((entry) => {
            cache.set(normalized, entry)
            negativeCache.delete(normalized)
            pruneCache()
            scheduleSave()
            return entry
        })
        .catch((e) => {
            negativeCache.set(normalized, { message: e?.message || '查询失败', at: Date.now() })
            throw e
        })
        .finally(() => inFlight.delete(normalized))

    inFlight.set(normalized, promise)
    return promise
}

/** 后台设置页的“测试查询”：按配置顺序尝试，兼容旧签名 (ip, key)。 */
export const queryShowAPI = async (ip, key) => {
    const normalized = normalizeIP(ip)
    if (!normalized || !isPublicIP(normalized)) {
        return { success: false, error: '请输入公网 IPv4 / IPv6 地址' }
    }
    const providers = getUsableGeoProviders(normalized, { enabled: true, key: String(key || '').trim() })
    if (!providers.length) {
        return { success: false, error: '没有可用的归属地通道：请配置 ShowAPI appKey 或启用免密钥通道' }
    }
    try {
        const data = await requestGeoWithProviders(normalized, providers)
        return { success: true, data }
    } catch (e) {
        return { success: false, error: e?.message || '查询失败', attempts: e?.attempts || [] }
    }
}

/**
 * 后台逐个通道测试：providerId 为 'all' 时并行测试所有已启用通道，
 * 单个通道失败不会影响其他通道的结果。
 */
const providerSkipReason = (provider, ip) => {
    const ipv6 = String(ip || '').includes(':')
    if (ipv6 && !provider.supportsIPv6) return `${provider.label} 不支持 IPv6`
    if (!ipv6 && provider.supportsIPv4 === false) return `${provider.label} 不支持 IPv4`
    if (provider.needsKey && !provider.key) return `${provider.label} 未配置密钥`
    return ''
}

const runGeoProviderTest = async (provider, ip) => {
    const startedAt = Date.now()
    try {
        const fields = await requestGeoProvider(provider.id, ip, { ...provider, timeoutMs: TEST_TIMEOUT })
        const data = normalizeEntry({
            ...fields,
            ip,
            source: provider.id,
            providerLabel: provider.label,
            updatedAt: Date.now(),
        })
        return { id: provider.id, label: provider.label, success: true, data, durationMs: Date.now() - startedAt }
    } catch (e) {
        return { id: provider.id, label: provider.label, success: false, error: e?.message || '查询失败', durationMs: Date.now() - startedAt }
    }
}

/**
 * 后台通道测试。
 * - all：并行测试所有已启用通道，未启用/不可用的通道也会给出原因。
 * - 单通道：先测该通道；失败或缺密钥时按配置顺序自动尝试备用通道，
 *   结果里能同时看到主通道失败原因和最终可用的备用通道。
 */
export const testGeoProviders = async (ip, config = {}, providerId = 'all') => {
    const normalized = normalizeIP(ip)
    if (!normalized || !isPublicIP(normalized)) {
        return { success: false, error: '请输入公网 IPv4 / IPv6 地址', results: [] }
    }
    const normalizedConfig = normalizeLookupConfig(config)
    const enabledProviders = resolveGeoProviders(normalizedConfig)

    if (!providerId || providerId === 'all') {
        if (!enabledProviders.length) {
            return { success: false, error: '没有已启用的归属地通道', results: [] }
        }
        const results = await Promise.all(enabledProviders.map(async (provider) => {
            const reason = providerSkipReason(provider, normalized)
            return reason
                ? { id: provider.id, label: provider.label, success: false, error: reason, durationMs: 0 }
                : runGeoProviderTest(provider, normalized)
        }))
        const first = results.find((item) => item.success)
        return {
            success: !!first,
            data: first?.data,
            results,
            requestedProvider: '',
            fallbackUsed: false,
            error: first ? '' : results.map((item) => `${item.label}: ${item.error}`).join('；'),
        }
    }

    const def = GEO_PROVIDER_MAP.get(providerId)
    if (!def) return { success: false, error: `未知归属地通道: ${providerId}`, results: [] }
    const primary = {
        ...def,
        ...normalizedConfig.providers[def.id],
        enabled: true,
    }
    const primaryReason = providerSkipReason(primary, normalized)
    const results = []
    if (primaryReason) {
        results.push({ id: primary.id, label: primary.label, success: false, error: primaryReason, durationMs: 0 })
    } else {
        results.push(await runGeoProviderTest(primary, normalized))
    }

    // 主通道不可用时自动按配置顺序回退，最多走到第一个成功的备用通道
    if (!results.some((item) => item.success)) {
        const fallbackProviders = enabledProviders.filter((provider) =>
            provider.id !== primary.id && !providerSkipReason(provider, normalized)
        )
        for (const provider of fallbackProviders) {
            const result = await runGeoProviderTest(provider, normalized)
            results.push(result)
            if (result.success) break
        }
    }

    const first = results.find((item) => item.success)
    return {
        success: !!first,
        data: first?.data,
        results,
        requestedProvider: primary.id,
        fallbackUsed: !!first && first.id !== primary.id,
        error: first ? '' : results.map((item) => `${item.label}: ${item.error}`).join('；'),
    }
}

export const getGeoCacheStats = () => {
    const bySource = {}
    for (const entry of cache.values()) {
        const source = entry?.source || 'unknown'
        bySource[source] = (bySource[source] || 0) + 1
    }
    return {
        size: cache.size,
        ttlDays: Math.round(CACHE_TTL / (24 * 60 * 60 * 1000)),
        bySource,
    }
}

/** 配置变更后清掉失败缓存，让刚启用的通道立即生效。 */
export const clearGeoFailures = () => {
    negativeCache.clear()
}

export const clearGeoCache = () => {
    cache.clear()
    negativeCache.clear()
    if (saveTimer) clearTimeout(saveTimer)
    saveNow()
    return true
}

loadCache()

/**
 * /api 响应缓存
 *
 * 来自访问日志分析的结论（见仓库外 MEMORY.md 第 6 节）：
 * 业务画像不是「一次性」，而是「同一个 id 被反复拉取」——
 * 30 天内不同歌单只有 23 个，最热的歌单平均每 12.6 分钟被拉一次。
 * 因此 TTL 必须大于拉取间隔才有收益：30~60 分钟可砍掉 40%~50% 的上游请求。
 *
 * 设计要点：
 * - 只缓存成功结果（空结果也缓存，避免反复打不存在的 id）；错误一律不缓存；
 * - 缓存的是「provider 原始结果」而不是最终 JSON：url/pic/lrc 需要按当前请求的 Host 拼绝对地址；
 * - 键里带上 cookie 指纹与 OVERSEAS 开关：VIP cookie 会改变直链；
 * - 纯内存实现，Map 插入序 + TTL 惰性淘汰，避免引入依赖；
 * - 开关、分类型 TTL、最大条目数支持后台配置，环境变量作为默认值/运维总开关。
 */
import store from '../admin/store.js'
import {
    DEFAULT_TTL_SECONDS,
    MAX_VALUE_BYTES as DEFAULT_MAX_VALUE_BYTES,
    resolveCacheConfig,
} from './cache-config.js'

const MAX_VALUE_BYTES = Number(process.env.CACHE_MAX_VALUE_BYTES || 0) || DEFAULT_MAX_VALUE_BYTES
/** 按类型区分的默认 TTL：直链寿命短，列表/歌词/封面变化慢 */
const TTL_BY_TYPE = DEFAULT_TTL_SECONDS

/** CACHE_TTL_SECONDS 存在时统一下发，后台 per-type 配置会覆盖它 */
const globalTtl = Number(process.env.CACHE_TTL_SECONDS || 0) * 1000

let cachedRawConfig
let cachedConfig = null
const getConfig = () => {
    const raw = store.getCacheConfig()
    if (raw !== cachedRawConfig) {
        cachedRawConfig = raw
        cachedConfig = resolveCacheConfig(raw)
    }
    return cachedConfig
}

export const cacheEnabled = () => getConfig().enabled

export const ttlForType = (type) => (getConfig().ttlByType[type] || TTL_BY_TYPE.playlist) * 1000

/** 无依赖字符串指纹，仅用于区分「带 cookie / 不带 cookie / 不同 cookie」 */
const fingerprint = (value) => {
    if (!value) return ''
    let h1 = 0x811c9dc5
    let h2 = 0x01000193
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i)
        h1 = (h1 ^ code) * 0x01000193 >>> 0
        h2 = (h2 + code * 31) >>> 0
    }
    return h1.toString(36) + h2.toString(36)
}

const makeKey = ({ server, type, id, cookie, quality, overseas }) =>
    [server, type, id, quality || 'standard', overseas ? 'ov' : 'dom', fingerprint(cookie)].join('|')

/** @type {Map<string, {value: any, expiresAt: number, bytes: number}>} */
const store_ = new Map()
const stats = { hits: 0, misses: 0, sets: 0, evictions: 0, skipped: 0 }

const roughSize = (value) => {
    if (typeof value === 'string') return value.length
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + roughSize(item), 0)
    if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + roughSize(item), 32)
    return 16
}

const dropOldest = () => {
    const oldest = store_.keys().next()
    if (!oldest.done) {
        store_.delete(oldest.value)
        stats.evictions++
    }
}

const purgeExpired = () => {
    const now = Date.now()
    for (const [key, entry] of store_) {
        if (entry.expiresAt <= now) store_.delete(key)
    }
}

let lastPurge = 0

export const cache = {
    key: makeKey,

    get(key) {
        if (!cacheEnabled()) return undefined
        const entry = store_.get(key)
        if (!entry) {
            stats.misses++
            return undefined
        }
        if (entry.expiresAt <= Date.now()) {
            store_.delete(key)
            stats.misses++
            return undefined
        }
        stats.hits++
        return entry.value
    },

    set(key, value, type) {
        const config = getConfig()
        if (!config.enabled) return
        const bytes = roughSize(value)
        if (bytes > MAX_VALUE_BYTES) {
            stats.skipped++
            return
        }
        const now = Date.now()
        if (store_.has(key)) store_.delete(key)
        store_.set(key, { value, expiresAt: now + ttlForType(type), bytes })
        stats.sets++

        // 惰性清理：最多每 60 秒扫一次过期项，再兜底按条数淘汰
        if (now - lastPurge > 60 * 1000) {
            lastPurge = now
            purgeExpired()
        }
        while (store_.size > config.maxEntries) dropOldest()
    },

    stats() {
        const config = getConfig()
        const total = stats.hits + stats.misses
        return {
            enabled: config.enabled,
            size: store_.size,
            maxEntries: config.maxEntries,
            maxValueBytes: MAX_VALUE_BYTES,
            hits: stats.hits,
            misses: stats.misses,
            sets: stats.sets,
            evictions: stats.evictions,
            skipped: stats.skipped,
            hitRate: total ? Number((stats.hits / total).toFixed(3)) : 0,
            ttlByType: Object.fromEntries(Object.entries(config.ttlByType).map(([k, v]) => [k, Math.round(v)])),
            globalTtlSeconds: globalTtl ? Math.round(globalTtl / 1000) : null,
        }
    },

    clear() {
        store_.clear()
        lastPurge = 0
    },
}

export default cache

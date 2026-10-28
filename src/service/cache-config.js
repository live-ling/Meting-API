/**
 * /api 响应缓存的默认值与边界。
 *
 * 放在独立模块里，store（持久化）与 api-cache（运行时）共用，
 * 避免两边各写一份 TTL 导致「后台显示 60 分钟、实际跑 10 分钟」。
 *
 * 默认 TTL 来自访问日志分析（见 MEMORY.md 第 6 节）：
 * 歌单/歌词的拉取间隔在 12 分钟以上，30~60 分钟 TTL 才有收益；
 * url 直链本身有时效，保持 10 分钟。
 */
export const CACHE_TYPES = ['url', 'search', 'playlist', 'artist', 'lrc', 'song', 'album', 'pic']

export const DEFAULT_TTL_SECONDS = {
    url: 10 * 60,
    search: 10 * 60,
    playlist: 30 * 60,
    artist: 30 * 60,
    lrc: 60 * 60,
    song: 60 * 60,
    album: 60 * 60,
    pic: 60 * 60,
}

export const DEFAULT_MAX_ENTRIES = 500
export const MAX_VALUE_BYTES = 4 * 1024 * 1024

export const CACHE_TTL_MIN_SECONDS = 60
export const CACHE_TTL_MAX_SECONDS = 7 * 24 * 60 * 60
export const CACHE_MAX_ENTRIES_MIN = 50
export const CACHE_MAX_ENTRIES_MAX = 100000

export const CACHE_TYPE_LABELS = {
    url: '直链',
    search: '搜索',
    playlist: '歌单',
    artist: '歌手',
    lrc: '歌词',
    song: '歌曲',
    album: '专辑',
    pic: '图片',
}

/**
 * 把「后台保存的原始配置」解析成运行时配置。
 *
 * 优先级：后台 per-type > 环境变量 CACHE_TTL_SECONDS > 内置默认。
 * CACHE_ENABLED=0 是运维级总开关，优先于后台的启用开关。
 */
export const resolveCacheConfig = (raw = null, env = globalThis?.process?.env || {}) => {
    const ttlByType = {}
    const globalTtl = Number(env.CACHE_TTL_SECONDS || 0)
    for (const type of CACHE_TYPES) {
        ttlByType[type] = globalTtl > 0 ? globalTtl : DEFAULT_TTL_SECONDS[type]
    }

    const customTtl = raw && typeof raw === 'object' ? raw.ttlByType : null
    if (customTtl && typeof customTtl === 'object') {
        for (const type of CACHE_TYPES) {
            const value = Number(customTtl[type])
            if (Number.isFinite(value) && value > 0) ttlByType[type] = value
        }
    }

    const envMax = Number(env.CACHE_MAX_ENTRIES || 0)
    const maxEntries = Number.isFinite(Number(raw?.maxEntries)) && Number(raw?.maxEntries) > 0
        ? Number(raw.maxEntries)
        : (envMax > 0 ? envMax : DEFAULT_MAX_ENTRIES)

    return {
        enabled: env.CACHE_ENABLED === '0' ? false : raw?.enabled !== false,
        ttlByType,
        maxEntries,
        maxValueBytes: MAX_VALUE_BYTES,
    }
}

export const secondsToMinutes = (seconds) => Math.max(1, Math.round(Number(seconds || 0) / 60))
export const minutesToSeconds = (minutes) => Math.max(0, Math.round(Number(minutes || 0) * 60))

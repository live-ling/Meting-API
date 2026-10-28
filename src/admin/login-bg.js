/**
 * 登录页背景图：服务端抓取 + 落盘缓存。
 *
 * 为什么不让浏览器直接请求 uapis.cn：
 * 1. 那个接口每次请求都会 302 到一张随机图，刷新一次就换一张；
 * 2. 浏览器直连是跨域图片，既拿不到缓存控制，也容易被接口限流。
 *
 * 所以这里由服务端抓取一次，把图片字节与元信息缓存在内存 + `data/login-bg/`，
 * 登录页只请求同源的 `/admin/login-bg`。TTL 到期前刷新多少次都是同一张，
 * 进程重启后也能从磁盘恢复。
 *
 * 抓取失败时保留旧图（stale），并在 1 分钟内不再重试，避免接口挂掉时被反复打。
 */
import store from './store.js'
import { get_runtime } from '../util.js'
import {
    DEFAULT_LOGIN_BG_API,
    DEFAULT_LOGIN_BG_TTL_HOURS,
} from './login-bg-config.js'

const runtime = get_runtime()
const isNode = runtime === 'node'

let fs = null
let path = null
if (isNode) {
    fs = await import('fs')
    path = await import('path')
}

const DATA_DIR = globalThis?.process?.env?.DATA_DIR || './data'
const CACHE_DIR = isNode && path ? path.join(DATA_DIR, 'login-bg') : ''
const IMAGE_FILE = CACHE_DIR ? path.join(CACHE_DIR, 'image.bin') : ''
const META_FILE = CACHE_DIR ? path.join(CACHE_DIR, 'meta.json') : ''

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const FETCH_TIMEOUT = 15000
/** 抓取失败后的冷却时间：期间直接用旧图或快速失败，不再打接口 */
const RETRY_COOLDOWN = 60 * 1000

/** @type {Uint8Array|null} */
let image = null
/** @type {{fetchedAt:number, contentType:string, size:number, apiUrl:string, sourceUrl:string}|null} */
let meta = null
let loaded = false
let inflight = null
let lastError = ''
let lastAttemptAt = 0

const now = () => Date.now()

const makeEtag = (m) => `"${(m?.fetchedAt || 0).toString(36)}-${(m?.size || 0).toString(36)}"`

const loadFromDisk = () => {
    if (loaded) return
    loaded = true
    if (!isNode || !fs) return
    try {
        if (!fs.existsSync(IMAGE_FILE) || !fs.existsSync(META_FILE)) return
        const raw = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'))
        const bytes = fs.readFileSync(IMAGE_FILE)
        if (!bytes.length) return
        image = new Uint8Array(bytes)
        meta = {
            fetchedAt: Number(raw.fetchedAt) || 0,
            contentType: typeof raw.contentType === 'string' && raw.contentType.startsWith('image/')
                ? raw.contentType
                : 'image/jpeg',
            size: image.length,
            apiUrl: typeof raw.apiUrl === 'string' ? raw.apiUrl : '',
            sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : '',
        }
    } catch (e) {
        console.log('[LoginBg] 读取缓存失败:', e.message)
        image = null
        meta = null
    }
}

const saveToDisk = () => {
    if (!isNode || !fs || !image || !meta) return
    try {
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
        const tmp = IMAGE_FILE + '.tmp'
        fs.writeFileSync(tmp, Buffer.from(image))
        fs.renameSync(tmp, IMAGE_FILE)
        fs.writeFileSync(META_FILE, JSON.stringify({
            fetchedAt: meta.fetchedAt,
            contentType: meta.contentType,
            size: meta.size,
            apiUrl: meta.apiUrl,
            sourceUrl: meta.sourceUrl,
        }, null, 2))
    } catch (e) {
        console.log('[LoginBg] 保存缓存失败:', e.message)
    }
}

const isFresh = (cfg) => {
    if (!image || !meta) return false
    if (meta.apiUrl !== cfg.apiUrl) return false
    const ttl = Math.max(1, Number(cfg.ttlHours) || DEFAULT_LOGIN_BG_TTL_HOURS) * 60 * 60 * 1000
    return now() - meta.fetchedAt < ttl
}

const fetchImage = async (apiUrl) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    try {
        const res = await fetch(apiUrl, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
                'user-agent': 'Meting-API/login-bg (+https://github.com/live-ling/Meting-API)',
            },
        })
        if (!res.ok) throw new Error(`图片接口返回 HTTP ${res.status}`)
        const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
        if (!contentType.startsWith('image/')) {
            throw new Error(`图片接口返回的不是图片（${contentType || '未知类型'}）`)
        }
        const declared = Number(res.headers.get('content-length') || 0)
        if (declared > MAX_IMAGE_BYTES) {
            throw new Error('图片超过 15 MB，已拒绝缓存')
        }
        const buffer = await res.arrayBuffer()
        if (!buffer.byteLength) throw new Error('图片接口返回空内容')
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
            throw new Error('图片超过 15 MB，已拒绝缓存')
        }
        return {
            bytes: new Uint8Array(buffer),
            contentType,
            sourceUrl: res.url || apiUrl,
        }
    } catch (e) {
        if (e?.name === 'AbortError') throw new Error('图片接口请求超时（15 秒）')
        throw e
    } finally {
        clearTimeout(timer)
    }
}

const publicCacheInfo = (cfg) => {
    if (!meta) return null
    return {
        fetchedAt: meta.fetchedAt,
        size: meta.size,
        contentType: meta.contentType,
        sourceUrl: meta.sourceUrl || '',
        stale: !isFresh(cfg),
    }
}

/**
 * 取背景图。命中缓存直接返回；否则抓取一次。
 * 抓取失败但已有旧图时返回旧图（stale），保证登录页不会突然变成空白。
 */
const ensureImage = async (cfg, { force = false } = {}) => {
    loadFromDisk()

    if (!force && isFresh(cfg)) {
        return { bytes: image, meta, cached: true, stale: false, error: '' }
    }

    // 失败冷却：接口刚挂过就先别打，直接用旧图或快速失败
    if (!force && !isFresh(cfg) && !image && lastError && now() - lastAttemptAt < RETRY_COOLDOWN) {
        throw new Error(lastError)
    }
    if (!force && image && lastError && now() - lastAttemptAt < RETRY_COOLDOWN) {
        return { bytes: image, meta, cached: true, stale: true, error: lastError }
    }

    if (inflight) return inflight

    inflight = (async () => {
        lastAttemptAt = now()
        try {
            const result = await fetchImage(cfg.apiUrl || DEFAULT_LOGIN_BG_API)
            image = result.bytes
            meta = {
                fetchedAt: now(),
                contentType: result.contentType,
                size: result.bytes.length,
                apiUrl: cfg.apiUrl || DEFAULT_LOGIN_BG_API,
                sourceUrl: result.sourceUrl,
            }
            lastError = ''
            saveToDisk()
            return { bytes: image, meta, cached: false, stale: false, error: '' }
        } catch (e) {
            lastError = e.message || '抓取背景图失败'
            console.log('[LoginBg] 抓取失败:', lastError)
            if (image && meta) {
                return { bytes: image, meta, cached: true, stale: true, error: lastError }
            }
            throw e
        } finally {
            inflight = null
        }
    })()

    return inflight
}

/** 设置页用的状态：配置 + 当前缓存信息 */
export const getLoginBgStatus = () => {
    loadFromDisk()
    const cfg = store.getLoginBgConfig()
    return {
        enabled: cfg.enabled,
        apiUrl: cfg.apiUrl,
        ttlHours: cfg.ttlHours,
        cache: publicCacheInfo(cfg),
        error: lastError || '',
    }
}

/** 强制换一张。失败但保留旧图时返回 stale + error，不抛异常 */
export const refreshLoginBg = async () => {
    const cfg = store.getLoginBgConfig()
    if (!cfg.enabled) throw new Error('登录页背景图未启用')
    const result = await ensureImage(cfg, { force: true })
    return { stale: !!result.stale, error: result.error || '' }
}

/** 清空内存与磁盘缓存；下次访问重新抓取 */
export const clearLoginBgCache = () => {
    image = null
    meta = null
    lastError = ''
    lastAttemptAt = 0
    if (!isNode || !fs) return
    try {
        if (fs.existsSync(CACHE_DIR)) fs.rmSync(CACHE_DIR, { recursive: true, force: true })
    } catch (e) {
        console.log('[LoginBg] 清空缓存失败:', e.message)
    }
}

/**
 * 同源图片路由。登录页公开可见，所以不加鉴权，但必须躲开后台页面兜底路由。
 * 用 ETag + no-cache 让浏览器每次只做一次 304 协商，换图后立即可见。
 */
export const loginBgHandler = async (c) => {
    c.header('X-Robots-Tag', 'noindex, nofollow')
    const cfg = store.getLoginBgConfig()

    if (!cfg.enabled) {
        c.header('Cache-Control', 'no-store')
        return c.body(null, 404)
    }

    try {
        const result = await ensureImage(cfg)
        const etag = makeEtag(result.meta)
        c.header('Content-Type', result.meta.contentType)
        c.header('Cache-Control', 'no-cache, must-revalidate')
        c.header('ETag', etag)
        c.header('X-Login-Bg', result.stale ? 'STALE' : result.cached ? 'HIT' : 'MISS')

        const ifNoneMatch = c.req.header('If-None-Match') || ''
        if (ifNoneMatch === etag || ifNoneMatch.split(',').map((s) => s.trim()).includes(etag)) {
            return c.body(null, 304)
        }

        const { bytes } = result
        return c.body(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 200)
    } catch (e) {
        lastError = e.message || lastError
        c.header('Cache-Control', 'no-store')
        c.header('X-Login-Bg', 'ERROR')
        return c.body(null, 502)
    }
}

export default { getLoginBgStatus, refreshLoginBg, clearLoginBgCache, loginBgHandler }

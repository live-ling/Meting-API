/**
 * /api 核心服务
 *
 * 处理链：参数校验 → 缓存查询 → provider 调用 → 结果整形 → 响应 + 日志
 *
 * 相比旧版的改动（都有对应的回归依据）：
 * 1. 增加 TTL 缓存（`src/service/api-cache.js`），命中时打 `X-Cache: HIT`；
 *    日志分析显示 30 天里只有 23 个不同歌单，缓存能砍掉四成以上上游请求。
 * 2. `type=url` 上游拿不到直链时返回 404（对齐原始 Meting-API 的行为），
 *    不再 302 到 CDN 根路径或网易云的外链占位页。
 * 3. 缓存的是 provider 原始数据，绝对地址按当前请求临时拼装，
 *    多域名/反代场景不会串站点。
 */
import Providers from '../providers/index.js'
import { UpstreamError } from '../providers/errors.js'
import { format as lyricFormat, get_url } from '../util.js'
import store from '../admin/store.js'
import apiLogger from './api-logger.js'
import cache from './api-cache.js'
import config from '../config.js'
import { DEFAULT_QUALITY, QUALITY_ALIASES, QUALITY_VALUES } from './quality-values.js'

const providers = new Providers()

/** 非 search 场景下 id 只允许这些字符（形如 347230 或 347230,347231） */
const ID_PATTERN = /^[a-zA-Z0-9_,-]+$/
/** search 场景下 id 是关键词，放宽但拒绝控制字符与模板/脚本注入字符 */
const SEARCH_FORBIDDEN = /[\x00-\x1f\x7f<>{}\\]/
const MAX_ID_LENGTH = 256

/** 音质：取值表见 ./quality-values.js（首页与提示词共用同一份），默认 standard 兼容旧行为 */
const normalizeQuality = (raw) => {
    if (raw === undefined || raw === null || raw === '') return DEFAULT_QUALITY
    const key = String(raw).trim().toLowerCase()
    const quality = QUALITY_ALIASES[key]
    if (!quality) {
        throw new ParamError(
            `quality 参数不合法，可选值：${QUALITY_VALUES.join(' / ')}`,
            { quality: String(raw) }
        )
    }
    return quality
}

const DEFAULT_SERVER = 'tencent'
const DEFAULT_TYPE = 'playlist'
const DEFAULT_ID = '7326220405'

class ParamError extends Error {
    constructor(message, param) {
        super(message)
        this.status = 400
        this.param = param
    }
}

const resolveParams = (query) => {
    const server = query.server || DEFAULT_SERVER
    const type = query.type || DEFAULT_TYPE
    const id = query.id || DEFAULT_ID
    const quality = normalizeQuality(query.quality)
    const param = { server, type, id }
    if (query.quality !== undefined) param.quality = quality

    const provider = providers.get(server)
    if (!provider || !provider.support_type.includes(type)) {
        throw new ParamError('server 参数不合法', param)
    }

    if (type === 'search') {
        if (id.length > MAX_ID_LENGTH) throw new ParamError('id 参数过长')
        if (SEARCH_FORBIDDEN.test(id)) throw new ParamError('id 参数包含非法字符')
    } else {
        if (!ID_PATTERN.test(id)) throw new ParamError('id 参数包含非法字符', param)
        if (id.length > MAX_ID_LENGTH) throw new ParamError('id 参数过长')
    }

    return { server, type, id, quality, provider, param }
}

/** 把 provider 返回的相对线索（歌曲 id）拼成可请求的绝对地址 */
const absolutize = (list, server, ctx, quality = DEFAULT_QUALITY) => list.map(item => {
    const next = { ...item }
    for (const key of ['url', 'pic', 'lrc']) {
        const raw = next[key]
        if (raw === undefined || raw === null) continue
        const value = String(raw)
        if (!value || value.startsWith('@') || value.startsWith('http')) {
            next[key] = value
            continue
        }
        const qualityQuery = key === 'url' && quality !== DEFAULT_QUALITY
            ? `&quality=${encodeURIComponent(quality)}`
            : ''
        next[key] = `${get_url(ctx)}?server=${server}&type=${key}&id=${encodeURIComponent(value)}${qualityQuery}`
    }
    return next
})

const mediaUrl = (value) => {
    try {
        const parsed = new URL(String(value))
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : ''
    } catch {
        return ''
    }
}

export default async (ctx) => {
    const startTime = Date.now()
    const userAgent = ctx.req.header('User-Agent') || ''
    // /api 是数据接口，不需要被搜索引擎收录
    ctx.header('X-Robots-Tag', 'noindex')
    const referer = (ctx.req.header('Referer') || '').slice(0, 512)
    const host = (ctx.req.header('Host') || '').slice(0, 128)
    const ip = apiLogger.getClientIP(ctx)
    const query = ctx.req.query()

    let server = query.server || DEFAULT_SERVER
    let type = query.type || DEFAULT_TYPE
    let id = query.id || DEFAULT_ID
    let quality = DEFAULT_QUALITY
    let logStatus = 'success'
    let logStatusCode = 200
    let logError = ''
    let songName = ''
    let songArtist = ''
    let logged = false

    const log = ({ status = 'success', statusCode = 200, error = '' } = {}) => {
        apiLogger.addLog({
            ip, server, type, requestId: id, status, statusCode,
            durationMs: Date.now() - startTime, songName, songArtist, error, userAgent,
            referer, host,
        })
        logged = true
    }

    try {
        let resolved
        try {
            resolved = resolveParams(query)
        } catch (e) {
            ctx.status(e.status || 400)
            logStatus = 'error'
            logStatusCode = e.status || 400
            logError = e.message || 'invalid request'
            return ctx.json({ status: e.status || 400, message: e.message, ...(e.param ? { param: e.param } : {}) })
        }

        server = resolved.server
        type = resolved.type
        id = resolved.id
        quality = resolved.quality
        const { provider } = resolved

        const storedCookie = store.getActiveCookie(server)
        // 与原始项目一致的兜底来源：METING_COOKIE_<SERVER>。
        // 酷狗直链（type=url）必须带 Cookie，后台暂未提供该平台的录入入口。
        const envCookie = globalThis.process?.env?.[`METING_COOKIE_${server.toUpperCase()}`] || ''
        const cookie = storedCookie?.cookie || envCookie

        // 只有 url 的 provider 结果会随音质变化；列表类结果缓存可共享
        const cacheQuality = type === 'url' ? quality : DEFAULT_QUALITY
        const cacheKey = cache.key({ server, type, id, cookie, quality: cacheQuality, overseas: config.OVERSEAS })
        let data = cache.get(cacheKey)
        const cacheHit = data !== undefined
        ctx.header('X-Cache', cacheHit ? 'HIT' : 'MISS')

        if (!cacheHit) {
            data = await provider.handle(type, id, cookie, { quality })
            // 只缓存成功结果；空结果也缓存，避免对不存在的 id 反复打上游
            if (data !== undefined && data !== null && data !== -1) {
                cache.set(cacheKey, data, type)
            }
        }

        if (type === 'url') {
            ctx.header('X-Audio-Quality', quality)
            // netease 会返回 { url, level, bitrate, format }，用于回显实际命中的音质；
            // 其他 provider 仍返回字符串。
            const info = data && typeof data === 'object' && !Array.isArray(data) ? data : null
            const raw = String(info ? (info.url ?? '') : (data ?? ''))
            if (info?.level) ctx.header('X-Audio-Quality-Actual', info.level)
            if (info?.bitrate) ctx.header('X-Audio-Bitrate', String(info.bitrate))
            // @ 开头是 provider 约定的特殊值（如腾讯海外 JSONP 描述符），原样返回文本
            if (raw.startsWith('@')) {
                log({ statusCode: 200 })
                return ctx.text(raw)
            }
            const url = mediaUrl(raw)
            if (!url) {
                // 原始 Meting-API 在拿不到直链时返回 404；旧版这里会 302 到 CDN 根路径
                ctx.status(404)
                logStatus = 'error'
                logStatusCode = 404
                logError = 'no url'
                return ctx.json({ error: 'no url' })
            }
            log({ statusCode: 302 })
            return ctx.redirect(url)
        }

        if (type === 'pic') {
            const url = mediaUrl(data)
            if (!url) {
                ctx.status(404)
                logStatus = 'error'
                logStatusCode = 404
                logError = 'no pic'
                return ctx.json({ error: 'no pic' })
            }
            log({ statusCode: 302 })
            return ctx.redirect(url)
        }

        // 歌词：两个 provider 都返回 { lyric, tlyric } 对象（历史上还有包成数组的写法）
        if (type === 'lrc') {
            const lyricData = Array.isArray(data) ? (data[0] || {}) : (data || {})
            log({ statusCode: 200 })
            return ctx.text(lyricFormat(lyricData.lyric || '', lyricData.tlyric || ''))
        }

        if (!Array.isArray(data)) {
            // provider 返回 -1 / 非列表，说明该组合实际不支持（防御性兜底）
            ctx.status(400)
            logStatus = 'error'
            logStatusCode = 400
            logError = 'unsupported type'
            return ctx.json({ status: 400, message: '不支持的请求类型', param: { server, type, id } })
        }

        const info = apiLogger.extractSongInfo(data, type)
        songName = info.name
        songArtist = info.artist

        log({ statusCode: 200 })
        return ctx.json(absolutize(data, server, ctx, quality))
    } catch (e) {
        // 只有 provider 主动抛出的 UpstreamError 才把原因告诉调用方，
        // 其余异常一律收敛成通用 500，避免把内部细节透出去。
        const isUpstream = e instanceof UpstreamError
        const status = isUpstream ? (Number(e.status) || 502) : 500
        if (status >= 500) console.error('[api]', e?.message || e)

        logStatus = 'error'
        logStatusCode = status
        logError = e?.message || 'unknown error'
        ctx.status(status)

        const body = {
            error: status === 404 ? 'not found' : status === 400 ? 'bad request' : status === 500 ? 'internal server error' : 'upstream unavailable',
        }
        if (isUpstream) body.message = e.message
        return ctx.json(body)
    } finally {
        if (!logged) {
            apiLogger.addLog({
                ip, server, type, requestId: id, status: logStatus, statusCode: logStatusCode,
                durationMs: Date.now() - startTime, songName, songArtist, error: logError, userAgent,
            })
        }
    }
}

/**
 * 酷狗 / 百度 / 酷我 —— 基于 @meting/core 的通用 provider
 *
 * 原始项目（metowolf/Meting-API）就是用 @meting/core 调这三个平台的，
 * 这里保持同样的做法：同一个库、同一套上游接口，不自己另写一份协议。
 *
 * 与 netease / tencent 两个自研 provider 的差异：
 * - 库返回的是 JSON 字符串，字段名是 name / artist[] / url_id / pic_id / lyric_id，
 *   这里统一映射成 /api 对外的 title / author / url / pic / lrc；
 * - 库对百度/酷我有加密与 csrf 处理，直接复用，不在本仓库重写；
 * - 懒加载：只有真的请求这三个平台时才 import，netease/tencent 的启动开销不变。
 *
 * 平台现状（2026-10 实测，见 README「平台可用性」）：
 * - kugou：search / song / album / artist / playlist / lrc / pic 均可用；
 *   `url` 需要带 Cookie（t + KugooID），没有则返回 404。
 * - baidu：上游 musicapi.taihe.com 已无法解析（百度音乐 API 下线），请求返回 502。
 * - kuwo：上游要求有效 kw_token，官网已不再下发，接口返回 request is illegal，请求返回 502。
 */
import { UpstreamError } from '../errors.js'

/** /api 的 type → @meting/core 的方法名（歌词在库里叫 lyric） */
const METHOD = {
    song: 'song',
    album: 'album',
    artist: 'artist',
    playlist: 'playlist',
    search: 'search',
    url: 'url',
    lrc: 'lyric',
    pic: 'pic',
}

/** 这三个平台在库里都实现了全部方法 */
export const SUPPORT_TYPE = ['url', 'lrc', 'song', 'album', 'playlist', 'artist', 'search', 'pic']

let MetingCtor = null

const loadMeting = async () => {
    if (MetingCtor) return MetingCtor
    try {
        const mod = await import('@meting/core')
        MetingCtor = mod.default || mod.Meting
    } catch (e) {
        throw new UpstreamError(`当前运行时不支持该平台（@meting/core 加载失败：${e?.message || e}）`, 501)
    }
    if (typeof MetingCtor !== 'function') {
        throw new UpstreamError('@meting/core 加载异常：未找到 Meting 构造器', 501)
    }
    return MetingCtor
}

/** 库返回 JSON 字符串；解析失败时原样返回，交给下面按类型处理 */
const parse = (raw) => {
    if (typeof raw !== 'string') return raw
    const text = raw.trim()
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

/**
 * 库里的一首歌 → /api 对外的字段。
 * url/pic/lrc 给的是「线索」（hash 或 id），由 /api 拼成自己的链接。
 */
export const mapSong = (item) => {
    if (!item || typeof item !== 'object') return null
    const artist = Array.isArray(item.artist)
        ? item.artist.filter(Boolean).join(' / ')
        : (item.artist || '')
    const fallbackId = item.url_id ?? item.id ?? ''
    return {
        title: item.name || item.title || '',
        author: artist,
        url: item.url_id ?? fallbackId,
        pic: item.pic_id ?? fallbackId,
        lrc: item.lyric_id ?? fallbackId,
    }
}

/** 上游给了「空壳」条目（只有 source/album，没有名字也没有 id）时视为上游异常 */
const isShellItem = (item) =>
    item && typeof item === 'object' &&
    !item.name && !item.title && !item.url_id && !item.id

/**
 * 统一的执行入口。
 * @param {string} server kugou | baidu | kuwo
 * @param {string} type   /api 的 type
 * @param {string} id     平台内的 id（酷狗是 hash，酷我是数字 mid）
 * @param {string} cookie 可选 Cookie（酷狗直链需要）
 */
export const run = async (server, type, id, cookie = '') => {
    const Meting = await loadMeting()
    const method = METHOD[type]
    if (!method) throw new UpstreamError(`${server} 不支持 type=${type}`, 400)

    const meting = new Meting(server)
    // format(true)：让库直接返回 name/artist/url_id/... 这套结构
    meting.format(true)
    if (cookie) meting.cookie(cookie)

    let raw
    try {
        raw = await meting[method](id)
    } catch (e) {
        throw new UpstreamError(`${server} 上游请求失败：${e?.message || e}`, 502)
    }

    const data = parse(raw)

    if (type === 'url') {
        const url = data && typeof data === 'object' ? (data.url || '') : (typeof data === 'string' ? data : '')
        if (!url) {
            const hint = server === 'kugou'
                ? '酷狗直链需要 Cookie（t + KugooID），请通过 METING_COOKIE_KUGOU 或后台 Cookie 提供'
                : `${server} 未返回可播放地址（该曲目可能无版权或需要登录）`
            throw new UpstreamError(hint, 404)
        }
        return url
    }

    if (type === 'pic') {
        const url = data && typeof data === 'object' ? (data.url || '') : ''
        if (!url) throw new UpstreamError(`${server} 未返回封面地址`, 404)
        return url
    }

    if (type === 'lrc') {
        const lyric = data && typeof data === 'object' ? (data.lyric || '') : ''
        const tlyric = data && typeof data === 'object' ? (data.tlyric || '') : ''
        if (!lyric) throw new UpstreamError(`${server} 未返回歌词`, 404)
        return { lyric, tlyric }
    }

    if (!Array.isArray(data)) {
        throw new UpstreamError(`${server} 上游返回格式异常`, 502)
    }

    const list = data.map(mapSong).filter(Boolean)
    if (list.length > 0 && list.every(item => !item.title && !item.url)) {
        throw new UpstreamError(
            `${server} 上游没有返回有效曲目（该平台的公开接口可能已下线），详见 README「平台可用性」`,
            502
        )
    }
    return list
}

/**
 * 生成一个 provider 注册对象。
 * @param {string} server
 * @param {{ status?: 'ok'|'down', note?: string }} meta 平台状态，供首页能力矩阵展示
 */
export const createProvider = (server, meta = {}) => ({
    support_type: SUPPORT_TYPE,
    status: meta.status || 'ok',
    statusNote: meta.note || '',
    handle: (type, id, cookie) => run(server, type, id, cookie),
})

export default createProvider

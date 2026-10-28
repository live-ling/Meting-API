import { request } from "./util.js"
import { map_song_list } from "./util.js"

/**
 * 直链规范化（对齐原始 Meting-API 的处理）：
 * - m7c/m8c 回源节点改回 m7/m8，避免部分网络下 403
 * - 强制 https，混合内容页面里才不会被浏览器拦掉
 * - 去掉 vuutv 防盗链参数（已实测去掉后仍可正常取流）
 */
const normalize_url = (url) => {
    if (!url) return ''
    let result = String(url).replace('http://', 'https://')
    result = result.replace('://m7c.', '://m7.').replace('://m8c.', '://m8.')
    try {
        const parsed = new URL(result)
        if (parsed.searchParams.has('vuutv')) {
            parsed.searchParams.delete('vuutv')
            result = parsed.href
        }
    } catch (_) {
        // 非法 URL 原样返回，交给上层 404 兜底
    }
    return result
}

export const get_song_url = async (id, cookie = '', quality = 'standard') => {

    const data = {
        ids: '[' + id + ']',
        level: quality || 'standard',
        encodeType: 'flac',
    }

    let res = {}

    try {
        res = await request(
            'POST',
            `https://interface.music.163.com/eapi/song/enhance/player/url/v1`,
            data,
            {
                crypto: 'eapi',
                url: '/api/song/enhance/player/url/v1',
                cookie: cookie || {}
            },
        )
    } catch (e) {
        console.error(e)
    }

    // 拿不到直链（无版权 / VIP 且无 Cookie）时 url 为空，由 /api 回 404。
    // 同时返回上游实际命中的音质：请求 hires/jymaster 时可能回落到 lossless。
    const item = res.data && res.data[0]
    return {
        url: normalize_url(item?.url),
        level: item?.level || '',
        bitrate: Number(item?.br) || 0,
        format: item?.format || '',
        size: Number(item?.size) || 0,
    }

}

export const get_song_info = async (id, cookie = '') => {
    const ids = [id]
    const data = {
        c: '[' + ids.map((id) => '{"id":' + id + '}').join(',') + ']',
    }
    let res = await request('POST', `https://music.163.com/api/v3/song/detail`, data, {
        crypto: 'weapi',
        cookie: cookie || {}
    })

    if (!res.songs) {
        throw res
    }

    res = map_song_list(res)
    return res
}

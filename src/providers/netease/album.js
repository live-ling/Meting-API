import { map_song_list } from './util.js'

/**
 * 网易云专辑详情
 *
 * 原始 Meting-API 支持 `type=album`，这个 fork 重写时漏掉了，这里补回。
 * 该接口不需要 eapi/weapi 加密，GET 即可；带上 Cookie 可以让会员专辑的
 * 曲目信息更完整（不影响免费专辑）。
 */
export const get_album = async (id, cookie = '') => {
    const headers = {
        Referer: 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    }
    if (cookie) headers.Cookie = cookie

    const res = await fetch(`https://music.163.com/api/v1/album/${encodeURIComponent(id)}`, { headers })
    if (!res.ok) throw new Error(`album upstream ${res.status}`)

    const json = await res.json()
    if (!json || (!json.songs && json.code && json.code !== 200)) {
        throw new Error(`album upstream code ${json?.code}`)
    }

    // map_song_list 接受 { songs: [...] }，与 song/detail 共用同一套字段映射
    return map_song_list(json)
}

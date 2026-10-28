import { changeUrlQuery } from './util.js'

/**
 * QQ 音乐专辑歌曲列表
 *
 * 原始 Meting-API 支持 `type=album`，这个 fork 重写时漏掉了，这里补回。
 * `musicu.fcg` 的 GetAlbumSongList 返回歌曲，字段形状与单曲不同
 * （songInfo.singer / songInfo.album.mid），所以单独映射一次。
 */
export const get_album = async (id, cookie = '') => {
    const data = {
        comm: { ct: 24, cv: 0 },
        albumSonglist: {
            method: 'GetAlbumSongList',
            param: { albumMid: id, begin: 0, num: 100, order: 2 },
            module: 'music.musichallAlbum.AlbumSongList',
        },
    }

    const url = changeUrlQuery({ format: 'json', data: JSON.stringify(data) }, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
    const headers = { Referer: 'https://y.qq.com/' }
    if (cookie) headers.Cookie = cookie

    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`album upstream ${res.status}`)

    const json = await res.json()
    const list = json?.albumSonglist?.data?.songList || []

    return list
        .map(item => item?.songInfo)
        .filter(Boolean)
        .map(song => ({
            author: (song.singer || []).map(singer => singer.name).join(' / '),
            title: song.name || song.title || '',
            pic: song.album?.mid
                ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.album.mid}.jpg`
                : '',
            // url/lrc 留 songmid，由 /api 组装成绝对地址
            url: song.mid,
            lrc: song.mid,
            songmid: song.mid,
        }))
}

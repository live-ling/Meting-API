import config from "../../config.js"
import { get_song_url } from "./song.js"
import { changeUrlQuery } from "./util.js"
import { UpstreamError } from "../errors.js"

const parseCookieString = (cookieString) => {
    if (!cookieString) return {}
    const cookies = {}
    cookieString.split(';').forEach(item => {
        const [key, value] = item.trim().split('=')
        if (key && value) {
            cookies[key] = value
        }
    })
    return cookies
}

const get_playlist = async (id, cookie = '') => {
    const cookieObj = parseCookieString(cookie)
    const uin = cookieObj.uin || '0'
    
    const data = {
        type: 1,
        utf8: 1,
        disstid: id,
        loginUin: uin,
        format: 'json'
    }


    const headers = {
        Referer: 'https://y.qq.com/n/yqq/playlist',
    }

    const url = changeUrlQuery(data, 'http://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg')

    let result = await fetch(url, { headers });

    result = await result.json()
    // 歌单不存在或上游结构异常时 cdlist 为空/缺字段，
    // 直接索引会炸成 TypeError → /api 500。收敛成 502（上游异常）。
    const songlist = result?.cdlist?.[0]?.songlist
    if (!Array.isArray(songlist)) {
        throw new UpstreamError('歌单不存在或上游返回异常', 502)
    }
    result = songlist

    let jsonp
    if (config.OVERSEAS) {
        const ids = result.map(song => song.songmid)
        jsonp = await get_song_url(ids.join(','), cookie)
    }
    const res = await Promise.all(result.map(async song => {
        let song_info = {
            author: song.singer.reduce((i, v) => ((i ? i + " / " : i) + v.name), ''),
            title: song.songname,
            pic: `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.albummid}.jpg`,
            url: config.OVERSEAS ? '' : song.songmid,
            lrc: song.songmid,
            songmid: song.songmid,
        }
        return song_info
    }));

    if (config.OVERSEAS) res[0].url = jsonp
    return res;
}


export { get_playlist }

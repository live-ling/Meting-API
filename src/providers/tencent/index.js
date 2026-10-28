import { get_playlist } from "./playlist.js";
import { get_song_url, get_song_info, get_pic } from "./song.js";
import { get_lyric } from "./lyric.js"
import { get_album } from "./album.js"

const support_type = ['url', 'pic', 'lrc', 'song', 'album', 'playlist']

const handle = async (type, id, cookie = '', options = {}) => {
    let result;
    switch (type) {
        case 'lrc':
            result = await get_lyric(id, cookie)
            break
        case 'pic':
            result = await get_pic(id, cookie)
            break
        case 'url':
            result = await get_song_url(id, cookie, options.quality)
            break
        case 'song':
            result = await get_song_info(id, cookie)
            break
        case 'album':
            result = await get_album(id, cookie)
            break
        case 'playlist':
            result = await get_playlist(id, cookie)
            break
        default:
            return -1;
    }
    return result
}

export default {
    register: (ctx) => {
        ctx.register('tencent', { handle, support_type })
    }
}

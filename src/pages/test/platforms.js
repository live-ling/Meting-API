import { icon } from '../../icons.js'
import { escapeHtml } from '../shared/html.js'
import { platformIcons } from '../shared/platform-icons.js'

/**
 * 页面用到的平台元信息与平台图标。
 *
 * 图标是内联的 data URI（见 shared/platform-icons.js），不发额外请求、不依赖运行时读文件；
 * 某个平台没有图时回退到 icons.js 的 lucide 图标。
 */

/** 平台展示名 */
export const platformNames = {
    netease: '网易云音乐',
    tencent: 'QQ 音乐',
    kugou: '酷狗音乐',
    baidu: '百度音乐',
    kuwo: '酷我音乐',
}

/** 窄屏用的短名：参数表列宽不够时切换 */
export const platformShortNames = {
    netease: '网易云',
    tencent: 'QQ',
    kugou: '酷狗',
    baidu: '百度',
    kuwo: '酷我',
}

/** 接口 type 的展示名 */
export const typeNames = {
    playlist: '歌单',
    song: '单曲',
    album: '专辑',
    artist: '歌手',
    search: '搜索',
}

/** 平台图标：真实 logo 用内联背景图，没有就回退成 lucide 音符 */
export function platformIcon(provider, size = 18) {
    if (!platformIcons[provider]) return icon('music')
    const box = `width:${size}px;height:${size}px`
    return `<span class="platform-ico" data-platform="${escapeHtml(provider)}" style="${box}" aria-hidden="true"></span>`
}

/** 带平台名的图标（用于表格表头等需要自解释的场景） */
export function platformIconLabelled(provider, size = 18) {
    const name = platformNames[provider] || provider
    const mark = platformIcon(provider, size)
    return `${mark}<span>${escapeHtml(name)}</span>`
}

export default platformIcon

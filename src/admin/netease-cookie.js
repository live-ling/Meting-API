/**
 * 网易云 Cookie 的解析、筛选与合并
 *
 * 扫码登录（803）和 token 续签（/api/login/token/refresh）拿到的新凭据都只在
 * Set-Cookie 里，需要合并进已有的 Cookie 串再落盘。
 *
 * 合并时只保留这里白名单内的字段：平台还会下发 `_ntes_nuid`、`NMTID` 之外的
 * 一堆跟踪/设备标识，把整个 Set-Cookie 无条件塞进 cookies.json 既没必要，
 * 也扩大了泄露面积。
 */

export const COOKIE_WHITELIST = [
    'MUSIC_U',
    '__csrf',
    'NMTID',
    'os',
    'appver',
    'osver',
    'deviceId',
    'channel',
    'versioncode',
]

/** `a=1; b=2` -> { a: '1', b: '2' }，值里允许出现 `=`（base64 填充） */
export const parseCookiePairs = (cookieString) => {
    const pairs = {}
    if (!cookieString) return pairs
    for (const item of String(cookieString).split(';')) {
        const trimmed = item.trim()
        if (!trimmed) continue
        const index = trimmed.indexOf('=')
        if (index <= 0) continue
        pairs[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1)
    }
    return pairs
}

/**
 * 从 Set-Cookie 数组里挑出白名单字段。
 * 每一项形如 `MUSIC_U=xxx; Max-Age=...; Path=/; HttpOnly`，只取第一段。
 */
export const pairsFromSetCookie = (setCookie) => {
    const pairs = {}
    for (const raw of setCookie || []) {
        const first = String(raw).split(';')[0].trim()
        const index = first.indexOf('=')
        if (index <= 0) continue
        const name = first.slice(0, index).trim()
        const value = first.slice(index + 1).trim()
        if (!COOKIE_WHITELIST.includes(name) || !value) continue
        pairs[name] = value
    }
    return pairs
}

/**
 * 把新字段合并进旧 Cookie 串：旧字段顺序保留，新值覆盖旧值，新字段追加在末尾。
 * 这样即使平台某次只下发 MUSIC_U，也不会把 __csrf 之类的字段冲掉。
 */
export const mergeCookiePairs = (cookieString, pairs) => {
    if (!pairs || Object.keys(pairs).length === 0) return cookieString
    const merged = parseCookiePairs(cookieString)
    Object.assign(merged, pairs)
    return Object.entries(merged)
        .map(([name, value]) => name + '=' + value)
        .join('; ')
}

/**
 * 从 `MUSIC_U=xxx; __csrf=yyy` 这样的字符串里挑白名单字段。
 * 少数场景下 803 的凭据会放在 body 的 cookie 字段里，而不是 Set-Cookie。
 */
export const pairsFromCookieString = (cookieString) => {
    const pairs = {}
    for (const [name, value] of Object.entries(parseCookiePairs(cookieString))) {
        if (!COOKIE_WHITELIST.includes(name) || !value) continue
        pairs[name] = value
    }
    return pairs
}

/** 两次 Cookie 串是否等价（顺序不敏感），用来避免无意义的落盘 */
export const isSameCookie = (left, right) => {
    const a = parseCookiePairs(left)
    const b = parseCookiePairs(right)
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const key of keys) {
        if (a[key] !== b[key]) return false
    }
    return true
}

export default {
    COOKIE_WHITELIST,
    parseCookiePairs,
    pairsFromSetCookie,
    pairsFromCookieString,
    mergeCookiePairs,
    isSameCookie,
}

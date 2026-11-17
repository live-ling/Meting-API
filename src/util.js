export function format(lyric, tlyric) {
  const lyricArray = trimLyric(lyric)
  const tlyricArray = trimLyric(tlyric)
  if (tlyricArray.length === 0) {
    return lyric
  }
  const result = []
  for (let i = 0, j = 0; i < lyricArray.length && j < tlyricArray.length; i += 1) {
    const time = lyricArray[i].time
    let text = lyricArray[i].text
    while (time > tlyricArray[j].time && j + 1 < tlyricArray.length) {
      j += 1
    }
    if (time === tlyricArray[j].time && tlyricArray[j].text.length) {
      text = `${text} (${tlyricArray[j].text})`
    }
    result.push({
      time,
      text
    })
  }
  return result
    .map(x => {
      const minus = Math.floor(x.time / 60000).toString().padStart(2, '0')
      const second = Math.floor((x.time % 60000) / 1000).toString().padStart(2, '0')
      const millisecond = Math.floor((x.time % 1000)).toString().padStart(3, '0')
      return `[${minus}:${second}.${millisecond}]${x.text}`
    })
    .join('\n')
}

const trimLyric = (lyric) => {
  const result = []
  const lines = lyric.split('\n')
  for (const line of lines) {
    const match = line.match(/^\[(\d{2}):(\d{2}\.\d*)\](.*)$/)
    if (match) {
      result.push({
        time: parseInt(parseInt(match[1], 10) * 60 * 1000 + parseFloat(match[2]) * 1000),
        text: match[3]
      })
    }
  }
  return result.sort((a, b) => a.time - b.time)
}

export const getPathFromURL = (url, strict = true) => {
  const queryIndex = url.indexOf("?");
  const result = url.substring(url.indexOf("/", 8), queryIndex === -1 ? url.length : queryIndex);
  if (strict === false && result.endsWith("/")) {
    return result.slice(0, -1);
  }
  return result;
};

/**
 * 对外公开的接口根地址（唯一入口）。
 *
 * 只用于「生成给别人看的链接」：列表里的 url / pic / lrc 字段、首页与 AI 提示词里的 base。
 * 与 get_url(c) 的区别：get_url 跟随请求的 Host / X-Forwarded-Host，同一套服务挂在两个
 * 域名上时，同一个歌单会被拼出两种地址；这里固定成唯一入口，可用 PUBLIC_BASE 覆盖。
 * robots / sitemap 这类描述「当前站点」的产物仍走 get_url。
 */
const DEFAULT_PUBLIC_BASE = 'https://meting.liveling.top'

export const get_public_base = () => {
  let raw = ''
  try { raw = globalThis?.process?.env?.PUBLIC_BASE || '' } catch (_) {}
  if (!raw) {
    try { raw = globalThis?.Deno?.env?.get?.('PUBLIC_BASE') || '' } catch (_) {}
  }
  const base = String(raw || DEFAULT_PUBLIC_BASE).trim().replace(/\/+$/, '')
  return base || DEFAULT_PUBLIC_BASE
}

export const get_runtime = () => {

  if (globalThis?.process?.env?.RUNTIME) {
    return globalThis?.process?.env?.RUNTIME
  }

  if (globalThis?.Deno !== undefined) {
    return 'deno'
  }

  if (globalThis?.Bun !== undefined) {
    return 'bun'
  }

  if (typeof globalThis?.WebSocketPair === 'function') {
    return 'cloudflare'
  }

  if (globalThis?.fastly !== undefined) {
    return 'fastly'
  }

  if (typeof globalThis?.EdgeRuntime === 'string') {
    return 'vercel'
  }

  if (globalThis?.process?.release?.name === 'node') {
    return 'node'
  }

  if (globalThis?.__lagon__ !== undefined) {
    return 'lagon'
  }

  return 'other'
}

export const get_url = (ctx) => {
  const runtime = get_runtime()
  const proto = ctx.req.header('X-Forwarded-Proto')
  const forwardedHost = ctx.req.header('X-Forwarded-Host')
  const forwardedUrl = ctx.req.header('X-Forwarded-Url')
  const path = getPathFromURL(ctx.req.url.split('?')[0])

  if (forwardedUrl && /^https?:\/\//.test(forwardedUrl)) {
    return forwardedUrl
  }

  if (forwardedHost && /^https?:\/\//.test(forwardedHost)) {
    return forwardedHost + path
  }

  const scheme = proto || 'https'
  const host = forwardedHost || ctx.req.header('host') || ctx.req.url.split('/')[2]
  let req_url = scheme + '://' + host + path

  if (runtime === 'vercel') req_url = req_url.replace('http://', 'https://')
  return req_url
}

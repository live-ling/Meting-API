/**
 * /test 试听实验室 · 纯函数核心（React 版）
 *
 * 与旧的内联版（src/pages/test/core.js）契约完全一致，逐条对应：
 *   1. 校验 / 归一化媒体地址（safeURL）；
 *   2. 解析 LRC 并按时间二分定位歌词（parseLRC / lyricIndex）；
 *   3. 解析 Retry-After（retryUntil）；
 *   4. 串行 + 去重 + 有界缓存的请求调度器（createScheduler）。
 *
 * 与旧版的差别只是去掉了「函数体内不能引用模块作用域变量」的限制
 * （旧版要把整个函数 toString() 内联进 HTML，新版是正常模块）。
 */

/** 归一化媒体地址，只放行绝对的 HTTP(S) 链接。 */
export function safeURL(value: unknown, origin: string): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const base = new URL(origin)
    const url = new URL(value, base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    // 同源且 path 恰好是 /api 的自链接：跟随页面协议，避免本地 HTTP 开发时混合内容被拦
    if (url.host === base.host && url.pathname === '/api') url.protocol = base.protocol
    return url.href
  } catch {
    return ''
  }
}

export interface LyricLine {
  time: number
  text: string
}

export interface ParsedLyrics {
  lines: LyricLine[]
  plain: string
}

/**
 * 解析 LRC 歌词文本。
 *
 * 支持：[offset:] 全局偏移、一行多个时间戳、1~3 位毫秒、
 * 同一时间戳的多行（原文 + 翻译）合并、没有时间戳的行作为兜底。
 */
export function parseLRC(value: unknown): ParsedLyrics {
  const source = String(value ?? '').replace(/^@/, '').slice(0, 500000)
  const offset = Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000
  const groups = new Map<number, string[]>()
  const plain: string[] = []

  for (const line of source.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    const text = line.replace(/\[[^\]]*\]/g, '').trim()
    if (!stamps.length) {
      if (text) plain.push(text)
      continue
    }
    for (const stamp of stamps) {
      // 秒数 ≥ 60 视为脏数据（例如 [00:99]）
      if (Number(stamp[2]) >= 60) continue
      const time = Math.max(
        0,
        Number(stamp[1]) * 60 + Number(stamp[2]) + Number('0.' + (stamp[3] || '0')) + offset,
      )
      if (!groups.has(time)) groups.set(time, [])
      const bucket = groups.get(time)!
      if (text && !bucket.includes(text)) bucket.push(text)
    }
  }

  return {
    lines: [...groups]
      .sort((a, b) => a[0] - b[0])
      .map(([time, texts]) => ({ time, text: texts.join('\n') })),
    plain: plain.join('\n'),
  }
}

/** 二分查找「当前时间对应的歌词行」；还没到第一句时返回 -1。 */
export function lyricIndex(lines: LyricLine[], time: number): number {
  let lo = 0
  let hi = lines.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= time) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}

/**
 * 解析 Retry-After：既可以是秒数，也可以是 HTTP 日期。
 * 都解析不出来时给 60 秒兜底冷却，绝不放行立刻重试。
 */
export function retryUntil(value: string | null | undefined, now: number): number {
  if (value && /^\d+(\.\d+)?$/.test(value.trim())) return now + Number(value) * 1000
  const date = Date.parse(value ?? '')
  return Number.isFinite(date) && date > now ? date : now + 60000
}

export type ResponseKind = 'json' | 'text' | 'blob'

export interface SchedulerOptions {
  fetcher?: typeof fetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  onCooldown?: (cooldownUntil: number) => void
  gap?: number
  limit?: number
}

export interface Scheduler {
  request: (url: string, kind?: ResponseKind, signal?: AbortSignal) => Promise<unknown>
  schedule: <T>(work: () => T | Promise<T>, signal?: AbortSignal) => Promise<T>
  blocked: () => boolean
  readonly cooldown: number
  readonly cacheSize: number
}

/**
 * 请求调度器。
 *
 * 契约：
 * - 所有请求走同一条 Promise 链，串行执行，间隔 ≥ 1500ms；
 * - 同 URL + 同 kind 去重：成功结果进缓存（默认 32 条，单条 > 2MB 不缓存），LRU 淘汰；
 * - 429：读取 Retry-After，写入 sessionStorage 冷却，之后一律本地拒绝，永不自动重试；
 * - 支持 AbortSignal：已中止的调用方不会污染后来对同一首歌的选择。
 */
export function createScheduler(options: SchedulerOptions = {}): Scheduler {
  const {
    fetcher = globalThis.fetch,
    now = Date.now,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    storage,
    onCooldown = () => {},
    gap = 1500,
    limit = 32,
  } = options

  const cache = new Map<string, unknown>()
  const pending = new Map<string, { promise: Promise<unknown>; signal?: AbortSignal }>()
  const key = 'meting-test-cooldown'
  let cooldown = 0
  let last = -Infinity
  let chain: Promise<unknown> = Promise.resolve()

  try {
    cooldown = Number(storage?.getItem(key)) || 0
  } catch {
    /* 存储不可用时退化为内存冷却 */
  }

  const blocked = () => cooldown > now()
  const cooldownError = () => new Error('请求冷却中，请稍后手动操作；不会自动重试。')

  function schedule<T>(work: () => T | Promise<T>, signal?: AbortSignal): Promise<T> {
    const task = chain.then(async () => {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      if (blocked()) throw cooldownError()
      // 上一次请求结束到这一次开始至少隔 1500ms（gap 只可能把它拉长）
      const delay = Math.max(0, last + Math.max(1500, gap) - now())
      if (delay) await sleep(delay)
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      if (blocked()) throw cooldownError()
      last = now()
      return work()
    })
    chain = task.catch(() => {})
    return task as Promise<T>
  }

  function request(url: string, kind: ResponseKind = 'json', signal?: AbortSignal): Promise<unknown> {
    const id = kind + ':' + url
    if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'))

    if (cache.has(id)) {
      // 命中后重新插入，维持 LRU 顺序
      const value = cache.get(id)
      cache.delete(id)
      cache.set(id, value)
      return Promise.resolve(value)
    }

    // 已中止的调用方不能污染后来对同一首歌的选择，所以这里要检查 signal
    const existing = pending.get(id)
    if (existing && !existing.signal?.aborted) return existing.promise
    if (pending.size >= 64) return Promise.reject(new Error('请求队列已满，请稍后手动操作。'))

    const entry: { promise: Promise<unknown>; signal?: AbortSignal } = { promise: Promise.resolve(undefined), signal }
    const promise = schedule(async () => {
      const response = await fetcher(url, {
        signal,
        credentials: 'same-origin',
        referrerPolicy: 'no-referrer',
      })
      if (response.status === 429) {
        cooldown = Math.max(cooldown, retryUntil(response.headers.get('Retry-After'), now()))
        try {
          storage?.setItem(key, String(cooldown))
        } catch {
          /* 忽略存储失败 */
        }
        onCooldown(cooldown)
        throw cooldownError()
      }
      if (!response.ok) throw new Error('请求失败（HTTP ' + response.status + '），请手动重试。')

      const value = kind === 'blob' ? await response.blob() : await response[kind]()
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')

      // 限制条目数量，也限制单条体积（封面 blob 尤其容易过大）
      const size = kind === 'blob' ? (value as Blob).size : JSON.stringify(value).length
      if (size <= 2000000) {
        cache.set(id, value)
        while (cache.size > limit) cache.delete(cache.keys().next().value as string)
      }
      return value
    }, signal).finally(() => {
      if (pending.get(id) === entry) pending.delete(id)
    })

    entry.promise = promise
    pending.set(id, entry)
    return promise
  }

  return {
    request,
    schedule,
    blocked,
    get cooldown() {
      return cooldown
    },
    get cacheSize() {
      return cache.size
    },
  }
}

export interface Song {
  name: string
  artist: string
  url: string
  pic: string
  lrc: string
}

interface RawSong {
  title?: unknown
  name?: unknown
  author?: unknown
  artist?: unknown
  url?: unknown
  pic?: unknown
  lrc?: unknown
}

/**
 * 把接口返回的一条记录映射成播放器需要的字段。
 * 字段实际叫 title / author / url / pic / lrc，值可能是字符串或数组；
 * lrc 以 @ 开头表示内联歌词，原样保留，其余情况按 URL 校验。
 */
export function song(raw: RawSong, origin: string): Song {
  const text = (value: unknown): string =>
    Array.isArray(value)
      ? value.map((x) => (typeof x === 'string' ? x : (x as { name?: string })?.name || '')).join(' / ')
      : typeof value === 'string'
        ? value
        : ''
  return {
    name: text(raw.title ?? raw.name) || '未命名曲目',
    artist: text(raw.author ?? raw.artist) || '未知歌手',
    url: safeURL(raw.url, origin),
    pic: safeURL(raw.pic, origin),
    lrc: typeof raw.lrc === 'string' && raw.lrc.startsWith('@') ? raw.lrc : safeURL(raw.lrc, origin),
  }
}

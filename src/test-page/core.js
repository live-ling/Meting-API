// Self-contained factories are also embedded in /test; no static route or CDN required.
export function createTestCore() {
    function safeURL(value, origin) {
        if (typeof value !== 'string' || !value.trim()) return ''
        try {
            const base = new URL(origin)
            const url = new URL(value, base)
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
            // get_url defaults to HTTPS even on local HTTP development servers.
            if (url.host === base.host && url.pathname === '/api') url.protocol = base.protocol
            return url.href
        } catch { return '' }
    }
    function parseLRC(value) {
        const source = String(value || '').replace(/^@/, '').slice(0, 500000)
        const offset = Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000
        const groups = new Map()
        const plain = []
        for (const line of source.split(/\r?\n/)) {
            const stamps = [...line.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
            const text = line.replace(/\[[^\]]*\]/g, '').trim()
            if (!stamps.length) { if (text) plain.push(text); continue }
            for (const stamp of stamps) {
                if (Number(stamp[2]) >= 60) continue
                const time = Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + Number('0.' + (stamp[3] || '0')) + offset)
                if (!groups.has(time)) groups.set(time, [])
                if (text && !groups.get(time).includes(text)) groups.get(time).push(text)
            }
        }
        return { lines: [...groups].sort((a, b) => a[0] - b[0]).map(([time, texts]) => ({ time, text: texts.join('\n') })), plain: plain.join('\n') }
    }
    function lyricIndex(lines, time) {
        let lo = 0, hi = lines.length - 1, result = -1
        while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (lines[mid].time <= time) { result = mid; lo = mid + 1 } else hi = mid - 1
        }
        return result
    }
    function retryUntil(value, now) {
        if (value && /^\d+(\.\d+)?$/.test(value.trim())) return now + Number(value) * 1000
        const date = Date.parse(value)
        return Number.isFinite(date) && date > now ? date : now + 60000
    }
    function createScheduler({ fetcher = globalThis.fetch, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)), storage, onCooldown = () => {}, gap = 1500, limit = 32 } = {}) {
        const cache = new Map(), pending = new Map()
        const key = 'meting-test-cooldown'
        let cooldown = 0, last = -Infinity, chain = Promise.resolve()
        try { cooldown = Number(storage?.getItem(key)) || 0 } catch {}
        const blocked = () => cooldown > now()
        const cooldownError = () => new Error('请求冷却中，请稍后手动操作；不会自动重试。')
        function schedule(work, signal) {
            const task = chain.then(async () => {
                if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
                if (blocked()) throw cooldownError()
                const delay = Math.max(0, last + Math.max(1500, gap) - now())
                if (delay) await sleep(delay)
                if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
                if (blocked()) throw cooldownError()
                last = now()
                return work()
            })
            chain = task.catch(() => {})
            return task
        }
        function request(url, kind = 'json', signal) {
            const id = kind + ':' + url
            if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'))
            if (cache.has(id)) {
                const value = cache.get(id); cache.delete(id); cache.set(id, value)
                return Promise.resolve(value)
            }
            // An aborted owner must not poison a later selection of the same song.
            if (pending.has(id) && !pending.get(id).signal?.aborted) return pending.get(id).promise
            if (pending.size >= 64) return Promise.reject(new Error('请求队列已满，请稍后手动操作。'))
            const entry = { signal }
            const promise = schedule(async () => {
                const response = await fetcher(url, { signal, credentials: 'same-origin', referrerPolicy: 'no-referrer' })
                if (response.status === 429) {
                    cooldown = Math.max(cooldown, retryUntil(response.headers.get('Retry-After'), now()))
                    try { storage?.setItem(key, String(cooldown)) } catch {}
                    onCooldown(cooldown)
                    throw cooldownError()
                }
                if (!response.ok) throw new Error('请求失败（HTTP ' + response.status + '），请手动重试。')
                const value = await response[kind]()
                if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
                // Bound entry count and large response retention (especially cover blobs).
                const size = kind === 'blob' ? value.size : JSON.stringify(value).length
                if (size <= 2000000) {
                    cache.set(id, value)
                    while (cache.size > limit) cache.delete(cache.keys().next().value)
                }
                return value
            }, signal).finally(() => { if (pending.get(id) === entry) pending.delete(id) })
            entry.promise = promise; pending.set(id, entry)
            return promise
        }
        return { request, schedule, blocked, get cooldown() { return cooldown }, get cacheSize() { return cache.size } }
    }
    function song(raw, origin) {
        const text = value => Array.isArray(value) ? value.map(x => typeof x === 'string' ? x : x?.name || '').join(' / ') : typeof value === 'string' ? value : ''
        return { name: text(raw.title || raw.name) || '未命名曲目', artist: text(raw.author || raw.artist) || '未知歌手', url: safeURL(raw.url, origin), pic: safeURL(raw.pic, origin), lrc: typeof raw.lrc === 'string' && raw.lrc.startsWith('@') ? raw.lrc : safeURL(raw.lrc, origin) }
    }
    return { safeURL, parseLRC, lyricIndex, retryUntil, createScheduler, song }
}

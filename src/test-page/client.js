export function mountTestPage(core, doc = document, env = window) {
    const audio = new env.Audio()
    audio.preload = 'none'
    let active = null, generation = 0, controller = null, objectURL = '', playPending = false
    let storage
    try { storage = env.sessionStorage } catch {}
    const banner = doc.querySelector('#request-status')
    const scheduler = core.createScheduler({ fetcher: env.fetch.bind(env), storage, onCooldown: updateCooldown })
    function updateCooldown() {
        banner.textContent = scheduler.blocked() ? 'HTTP 429 · 全页冷却剩余 ' + Math.ceil((scheduler.cooldown - Date.now()) / 1000) + ' 秒 · 到期后请手动操作' : '按需加载 · 请求串行间隔 ≥ 1.5 秒 · 不自动重试'
    }
    updateCooldown()
    env.setInterval(updateCooldown, 1000)
    function status(card, message) { card.status.textContent = message }
    function visual(playing) {
        if (!active) return
        active.root.classList.toggle('is-playing', playing)
        active.play.textContent = playing ? '暂停' : '播放'
        active.play.setAttribute('aria-label', (playing ? '暂停 ' : '播放 ') + active.songs[active.index].name)
    }
    function stop() {
        generation++
        controller?.abort()
        audio.pause()
        visual(false)
        audio.removeAttribute('src')
        audio.load()
        playPending = false
        if (objectURL) { env.URL.revokeObjectURL(objectURL); objectURL = '' }
    }
    function sync() {
        if (!active) return
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0
        active.seek.disabled = !duration
        active.seek.max = String(duration || 1)
        active.seek.value = String(audio.currentTime || 0)
        active.time.textContent = clock(audio.currentTime) + ' / ' + clock(duration)
        const index = core.lyricIndex(active.lines, audio.currentTime || 0)
        if (index === active.lineIndex) return
        active.lineIndex = index
        Array.from(active.lyrics.children).forEach((node, i) => {
            node.classList.toggle('current', i === index)
            if (i === index) {
                node.setAttribute('aria-current', 'true')
                active.lyrics.scrollTop = Math.max(0, node.offsetTop - active.lyrics.offsetTop - active.lyrics.clientHeight / 2 + node.clientHeight / 2)
            } else node.removeAttribute('aria-current')
        })
    }
    function clock(value) { return Number.isFinite(value) ? Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0') : '0:00' }
    function seek(time) { if (Number.isFinite(audio.duration)) { audio.currentTime = Math.max(0, Math.min(time, audio.duration)); sync() } }
    audio.addEventListener('playing', () => { if (!audio.paused && audio.getAttribute('src')) { playPending = false; visual(true); status(active, '正在播放') } })
    for (const event of ['pause', 'waiting', 'ended']) audio.addEventListener(event, () => {
        visual(false)
        if (active && event === 'waiting') status(active, '音频缓冲中…')
        if (active && event === 'ended') status(active, '播放结束；可手动选择下一首。')
    })
    for (const event of ['timeupdate', 'loadedmetadata', 'durationchange']) audio.addEventListener(event, sync)
    audio.addEventListener('error', () => {
        if (!active || !audio.getAttribute('src')) return
        stop()
        status(active, '媒体播放失败，已停止。原生音频无法判断是否为 HTTP 429；不会重试或跳曲。')
    })
    async function select(card, index) {
        if (index < 0 || index >= card.songs.length) return
        if (active && active !== card) status(active, '已停止；当前正在操作其他示例。')
        stop()
        active = card; card.index = index; card.lines = []; card.lineIndex = -1
        controller = new AbortController()
        const signal = controller.signal, token = generation
        const current = () => token === generation && !signal.aborted
        const track = card.songs[index]
        card.title.textContent = track.name; card.artist.textContent = track.artist
        card.cover.removeAttribute('src'); card.cover.hidden = true
        card.play.disabled = !track.url; card.play.textContent = '播放'
        card.prev.disabled = index === 0; card.next.disabled = index === card.songs.length - 1
        card.seek.disabled = true; card.seek.value = '0'; card.time.textContent = '0:00 / 0:00'
        card.list.value = String(index)
        card.lyrics.textContent = '歌词加载中…'
        status(card, track.url ? '已选择曲目；点击播放开始音频请求。' : '接口未返回可用的 HTTP(S) 音频链接。')
        async function lyrics() {
            try {
                const text = track.lrc.startsWith('@') ? track.lrc.slice(1) : track.lrc ? await scheduler.request(track.lrc, 'text', signal) : ''
                if (!current()) return
                const parsed = core.parseLRC(text)
                card.lines = parsed.lines
                card.lyrics.replaceChildren()
                if (!parsed.lines.length) { card.lyrics.textContent = parsed.plain ? '未同步歌词\n\n' + parsed.plain : '暂无歌词'; return }
                for (const line of parsed.lines) {
                    const button = doc.createElement('button')
                    button.type = 'button'; button.className = 'lyric-line'; button.textContent = line.text || '♪'
                    button.setAttribute('aria-label', '跳转到 ' + clock(line.time) + ' ' + line.text)
                    button.addEventListener('click', () => { if (active === card) seek(line.time) })
                    card.lyrics.append(button)
                }
                sync()
            } catch (error) { if (current()) card.lyrics.textContent = '歌词未加载：' + error.message }
        }
        async function cover() {
            if (!track.pic) return
            try {
                // Covers, including redirecting /api?type=pic, share the same scheduler.
                const blob = await scheduler.request(track.pic, 'blob', signal)
                if (!current()) return
                if (!blob.type.startsWith('image/')) throw new Error('封面不是图片')
                objectURL = env.URL.createObjectURL(blob)
                card.cover.src = objectURL; card.cover.hidden = false
            } catch (error) { if (current()) card.coverNote.textContent = '封面未加载（可能为跨域限制）；保留唱片占位。' }
        }
        card.coverNote.textContent = '仅加载当前曲目的封面与歌词'
        await lyrics()
        if (current()) await cover()
    }
    async function toggle(card) {
        if (active !== card) {
            const selection = select(card, card.index)
            const selectedGeneration = generation
            await selection
            if (active !== card || generation !== selectedGeneration) return
        }
        if (!audio.paused || playPending) { playPending = false; audio.pause(); visual(false); status(card, '已暂停'); return }
        if (scheduler.blocked()) { status(card, '请求冷却中，暂不发起播放。'); return }
        const token = generation
        playPending = true; status(card, '准备播放…')
        try {
            // Reserve the global request lane for native media start; never fetch audio bytes.
            await scheduler.schedule(() => {
                if (token !== generation || active !== card || !playPending) return
                if (!audio.getAttribute('src')) audio.src = card.songs[card.index].url
                // Do not hold the JSON lane while native media buffers.
                audio.play().catch(error => {
                    if (token !== generation) return
                    playPending = false; audio.pause(); visual(false)
                    status(card, '播放未开始：' + error.message + '；请手动操作，不自动重试。')
                })
            })
        } catch (error) { if (token === generation) { playPending = false; status(card, error.message) } }
    }
    for (const root of doc.querySelectorAll('.player-card')) {
        const find = name => root.querySelector('[data-ui="' + name + '"]')
        const card = { root, songs: [], index: 0, lines: [], lineIndex: -1 }
        for (const name of ['load', 'status', 'title', 'artist', 'cover', 'coverNote', 'play', 'prev', 'next', 'seek', 'time', 'lyrics', 'list']) card[name] = find(name)
        card.load.addEventListener('click', async () => {
            if (scheduler.blocked()) { status(card, '请求冷却中，请稍后手动加载。'); return }
            card.load.disabled = true; status(card, '排队加载接口数据…')
            try {
                const url = new URL('/api', env.location.origin)
                for (const key of ['server', 'type', 'id']) url.searchParams.set(key, root.dataset[key])
                const data = await scheduler.request(url.href)
                if (!Array.isArray(data)) throw new Error('接口响应不是曲目数组')
                card.songs = data.filter(x => x && typeof x === 'object').slice(0, 1000).map(x => core.song(x, env.location.origin))
                card.list.replaceChildren()
                card.songs.forEach((track, i) => {
                    const option = doc.createElement('option'); option.value = String(i); option.textContent = (i + 1) + '. ' + track.name + ' — ' + track.artist
                    card.list.append(option)
                })
                card.list.disabled = !card.songs.length
                card.load.textContent = '已加载 ' + card.songs.length + ' 首'
                status(card, card.songs.length ? '数据已加载；请选择曲目。' : '接口返回空列表。')
                // Selection remains local until the user explicitly chooses a song.
                if (card.songs.length) {
                    card.title.textContent = card.songs[0].name; card.artist.textContent = card.songs[0].artist
                    card.play.disabled = false; card.next.disabled = card.songs.length < 2
                    card.lyrics.textContent = '点击播放时加载当前曲目的歌词与封面；切歌不会自动播放。'
                }
            } catch (error) { status(card, error.message); card.load.disabled = false }
        })
        card.play.addEventListener('click', () => toggle(card))
        card.prev.addEventListener('click', () => select(card, card.index - 1))
        card.next.addEventListener('click', () => select(card, card.index + 1))
        card.list.addEventListener('change', () => select(card, Number(card.list.value)))
        card.seek.addEventListener('input', () => { if (active === card) seek(Number(card.seek.value)) })
        card.cover.addEventListener('error', () => { card.cover.hidden = true })
    }
    return { audio, scheduler }
}

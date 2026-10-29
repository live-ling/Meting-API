/**
 * /test 试听实验室 · 交互层
 *
 * 全页的行为都集中在这一个函数里：换源、载入、选曲、播放、进度、歌词、封面。
 *
 * 为什么保持「单函数」？页面用 `mountTestPage.toString()` 把本函数内联进 HTML，
 * 所以函数体不能引用任何模块作用域的名字，只能用参数 core / doc / env。
 *
 * 以下契约在重构中保持不变：
 * - 首屏不发任何请求，只有点「载入」/ 预设档案 / 播放才进入调度器；
 * - 全页共享一个 Audio，preload='none'，切歌不自动播放，播放结束不自动下一首；
 * - 请求串行 + 同 URL 去重 + 有界缓存；HTTP 429 只冷却，永不自动重试；
 * - 歌词按 currentTime 二分高亮并滚动居中，点击歌词行跳转。
 *
 * DOM 契约（重构后）：
 * - 唯一的 `[data-server][data-type][data-id]` 根元素就是「点唱工作台」，
 *   它的 data-* 会随换源面板实时更新，载入时按这三者拼请求；
 * - 13 个 `data-ui` 控件在根元素内部；换源控件用独立的 `data-source-ui`。
 */
export function mountTestPage(core, doc = document, env = window) {
    // ── 共享状态 ────────────────────────────────────────────────
    const audio = new env.Audio()
    audio.preload = 'none'

    let active = null       // 当前被操作的工作台（全页唯一）
    let generation = 0      // 每次停止 / 切歌自增，用来丢弃过期的异步结果
    let controller = null   // 当前曲目的 AbortController
    let objectURL = ''      // 唱片封面 blob 的临时地址
    let playPending = false // 已点播放、但 'playing' 事件还没到

    let storage
    try { storage = env.sessionStorage } catch { /* 隐私模式下可能不可用，退化为内存冷却 */ }

    const banner = doc.querySelector('#request-status')
    const scheduler = core.createScheduler({ fetcher: env.fetch.bind(env), storage, onCooldown: updateCooldown })

    /** 顶部状态条（已随页面精简移除）：存在才写，避免整页报错。 */
    function updateCooldown() {
        if (!banner) return
        banner.textContent = scheduler.blocked()
            ? '触发限流（429）· 冷却还剩 ' + Math.ceil((scheduler.cooldown - Date.now()) / 1000) +
              ' 秒 · 到期后请手动再试'
            : '按需加载 · 两次请求至少隔 1.5 秒 · 出错不自动重试'
    }
    updateCooldown()
    env.setInterval(updateCooldown, 1000)

    /** 写工作台底部状态文案。 */
    function status(card, message) { card.status.textContent = message }

    /** 播放中的视觉状态：唱片旋转、唱臂摆入、按钮文案、aria-pressed。 */
    function visual(playing) {
        if (!active) return
        active.root.classList.toggle('is-playing', playing)
        active.play.textContent = playing ? '暂停' : '播放'
        active.play.setAttribute('aria-pressed', playing ? 'true' : 'false')
        active.play.setAttribute('aria-label', (playing ? '暂停 ' : '播放 ') + active.songs[active.index].name)
    }

    /** 彻底停止：中止请求、暂停音频、清掉 src 与封面临时地址。 */
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

    /** 秒 → m:ss。 */
    function clock(value) {
        return Number.isFinite(value)
            ? Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0')
            : '0:00'
    }

    /** 跳转播放位置（歌词点击、进度条拖动共用）。 */
    function seek(time) {
        if (Number.isFinite(audio.duration)) {
            audio.currentTime = Math.max(0, Math.min(time, audio.duration))
            sync()
        }
    }

    /** 同步进度条、时间文本与歌词高亮（timeupdate / 元数据变化时调用）。 */
    function sync() {
        if (!active) return
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0
        active.seek.disabled = !duration
        active.seek.max = String(duration || 1)
        active.seek.value = String(audio.currentTime || 0)
        // 自定义进度条的填充比例（CSS 用 --range-value 画橙色段）
        const ratio = duration ? Math.min(1, (audio.currentTime || 0) / duration) : 0
        active.seek.style.setProperty('--range-value', (ratio * 100).toFixed(2) + '%')
        active.time.textContent = clock(audio.currentTime) + ' / ' + clock(duration)
        const index = core.lyricIndex(active.lines, audio.currentTime || 0)
        if (index === active.lineIndex) return
        active.lineIndex = index
        const nodes = Array.from(active.lyrics.querySelectorAll('.lyric-line'))
        nodes.forEach((node, i) => {
            node.classList.toggle('current', i === index)
            if (i === index) {
                node.setAttribute('aria-current', 'true')
                // 让当前行停在歌词区垂直中央。
                active.lyrics.scrollTop = Math.max(
                    0,
                    node.offsetTop - active.lyrics.offsetTop - active.lyrics.clientHeight / 2 + node.clientHeight / 2,
                )
            } else node.removeAttribute('aria-current')
        })
    }

    /** 曲目单高亮 + 滚动到当前曲目。 */
    function highlight(card, index) {
        const nodes = Array.from(card.list.querySelectorAll('.track-row'))
        nodes.forEach((node, i) => {
            const current = i === index
            node.classList.toggle('current', current)
            if (current) {
                node.setAttribute('aria-current', 'true')
                card.list.scrollTop = Math.max(
                    0,
                    node.offsetTop - card.list.offsetTop - card.list.clientHeight / 2 + node.clientHeight / 2,
                )
            } else node.removeAttribute('aria-current')
        })
    }

    audio.addEventListener('playing', () => {
        if (!audio.paused && audio.getAttribute('src')) {
            playPending = false
            visual(true)
            status(active, '正在播放')
        }
    })
    for (const event of ['pause', 'waiting', 'ended']) audio.addEventListener(event, () => {
        visual(false)
        if (active && event === 'waiting') status(active, '音频缓冲中…')
        if (active && event === 'ended') {
            // 连播：一首播完自动切下一首并接着播；
            // 已经是最后一首就停在当前曲，让用户手动处理。
            const next = active.index + 1
            if (next < active.songs.length) {
                status(active, '连播：正在切到下一首…')
                playTrack(active, next)
            } else {
                status(active, '已播到最后一首。')
            }
        }
    })
    for (const event of ['timeupdate', 'loadedmetadata', 'durationchange']) audio.addEventListener(event, sync)
    audio.addEventListener('error', () => {
        if (!active || !audio.getAttribute('src')) return
        stop()
        status(active, '媒体播放失败，已停止。原生音频无法判断是否为 HTTP 429；不会重试或跳曲。')
    })

    /**
     * 选中第 index 首。
     * 选曲只更新界面并加载「歌词 + 封面」，不碰 Audio.src（播放要用户再点一次）。
     */
    async function select(card, index) {
        if (index < 0 || index >= card.songs.length) return
        stop()
        active = card
        card.index = index
        card.lines = []
        card.lineIndex = -1
        controller = new AbortController()
        const signal = controller.signal, token = generation
        const current = () => token === generation && !signal.aborted
        const track = card.songs[index]
        card.title.textContent = track.name
        card.artist.textContent = track.artist
        card.cover.removeAttribute('src')
        card.cover.hidden = true
        card.play.disabled = !track.url
        card.play.textContent = '播放'
        card.play.setAttribute('aria-pressed', 'false')
        card.prev.disabled = index === 0
        card.next.disabled = index === card.songs.length - 1
        card.seek.disabled = true
        card.seek.value = '0'
        card.time.textContent = '0:00 / 0:00'
        highlight(card, index)
        card.lyrics.textContent = '歌词加载中…'
        status(card, track.url
            ? '已选择曲目；点击播放开始音频请求。'
            : '接口未返回可用的 HTTP(S) 音频链接。')

        /** 歌词：内联（@ 开头）直接用，否则按 URL 走同一个调度器。 */
        async function lyrics() {
            try {
                const text = track.lrc.startsWith('@')
                    ? track.lrc.slice(1)
                    : track.lrc ? await scheduler.request(track.lrc, 'text', signal) : ''
                if (!current()) return
                const parsed = core.parseLRC(text)
                card.lines = parsed.lines
                card.lyrics.replaceChildren()
                if (!parsed.lines.length) {
                    card.lyrics.textContent = parsed.plain ? '未同步歌词\n\n' + parsed.plain : '暂无歌词'
                    return
                }
                for (const line of parsed.lines) {
                    const button = doc.createElement('button')
                    button.type = 'button'
                    button.className = 'lyric-line'
                    // LRC 里同一时间戳可能是「原文 + 翻译」两行，
                    // 拆开排版：原文正常显示，翻译用更小更淡的一行跟在后面。
                    const parts = line.text.split('\n')
                    const main = doc.createElement('span')
                    main.className = 'lyric-main'
                    main.textContent = parts[0] || '♪'
                    button.append(main)
                    if (parts.length > 1) {
                        const translation = doc.createElement('span')
                        translation.className = 'lyric-translation'
                        translation.textContent = parts.slice(1).join(' ')
                        button.append(translation)
                    }
                    button.setAttribute('aria-label', '跳转到 ' + clock(line.time) + ' ' + parts[0])
                    button.addEventListener('click', () => { if (active === card) seek(line.time) })
                    card.lyrics.append(button)
                }
                sync()
            } catch (error) { if (current()) card.lyrics.textContent = '歌词未加载：' + error.message }
        }

        /** 封面：同样走调度器取 blob（type=pic 是 302 跳转），失败保留唱片占位。 */
        async function cover() {
            if (!track.pic) return
            try {
                const blob = await scheduler.request(track.pic, 'blob', signal)
                if (!current()) return
                if (!blob.type.startsWith('image/')) throw new Error('封面不是图片')
                objectURL = env.URL.createObjectURL(blob)
                card.cover.src = objectURL
                card.cover.hidden = false
            } catch (error) {
                if (current()) card.coverNote.textContent = '封面未加载（可能为跨域限制）；保留唱片占位。'
            }
        }

        card.coverNote.textContent = '仅加载当前曲目的封面与歌词'
        await lyrics()
        if (current()) await cover()
    }

    /** 播放 / 暂停。第一次点播放时才设置 Audio.src。 */
    async function toggle(card) {
        if (active !== card) {
            const selection = select(card, card.index)
            const selectedGeneration = generation
            await selection
            if (active !== card || generation !== selectedGeneration) return
        }
        if (!audio.paused || playPending) {
            playPending = false
            audio.pause()
            visual(false)
            status(card, '已暂停')
            return
        }
        if (scheduler.blocked()) { status(card, '请求冷却中，暂不发起播放。'); return }
        const token = generation
        playPending = true
        status(card, '准备播放…')
        try {
            // 只借用全局请求通道（保证串行间隔），不抓音频字节，交给原生 <audio>。
            await scheduler.schedule(() => {
                if (token !== generation || active !== card || !playPending) return
                if (!audio.getAttribute('src')) audio.src = card.songs[card.index].url
                // 不占着通道等原生媒体缓冲。
                audio.play().catch(error => {
                    if (token !== generation) return
                    playPending = false
                    audio.pause()
                    visual(false)
                    status(card, '播放未开始：' + error.message + '；请手动操作，不自动重试。')
                })
            })
        } catch (error) {
            if (token === generation) { playPending = false; status(card, error.message) }
        }
    }

    /**
     * 切到第 index 首并立即播放。
     *
     * 用于「下一首 / 上一首」按钮与连播：
     * 与 select 不同的是它会把音频真正放起来，而不是只换界面。
     * 歌词与封面仍由 select 异步加载，与播放并行，不阻塞出声。
     */
    async function playTrack(card, index) {
        if (index < 0 || index >= card.songs.length) return
        const track = card.songs[index]
        if (!track.url) {
            // 没有可播地址：只切过去，并给出说明
            await select(card, index)
            status(card, '接口未返回可用的 HTTP(S) 音频链接。')
            return
        }
        // select 的前半段是同步的（停旧曲、换界面），歌词封面在后台继续
        const selection = select(card, index)
        const token = generation
        await selection
        if (active !== card || generation !== token) return
        if (scheduler.blocked()) { status(card, '请求冷却中，暂不发起播放。'); return }
        playPending = true
        status(card, '准备播放…')
        try {
            await scheduler.schedule(() => {
                if (token !== generation || active !== card || !playPending) return
                if (!audio.getAttribute('src')) audio.src = track.url
                audio.play().catch(error => {
                    if (token !== generation) return
                    playPending = false
                    audio.pause()
                    visual(false)
                    status(card, '播放未开始：' + error.message + '；请手动操作，不自动重试。')
                })
            })
        } catch (error) {
            if (token === generation) { playPending = false; status(card, error.message) }
        }
    }

    // ── 工作台挂载 ──────────────────────────────────────────────
    // 根元素带 data-server / data-type / data-id，直接用属性定位；
    // 样式类名只负责外观，二者互不牵连。
    const UI = 'data-ui'
    const root = doc.querySelector('[data-server][data-type][data-id]')
    if (!root) return { audio, scheduler }
    const card = { root, songs: [], index: 0, lines: [], lineIndex: -1 }
    for (const name of ['load', 'status', 'title', 'artist', 'cover', 'coverNote',
        'play', 'prev', 'next', 'seek', 'time', 'list', 'lyrics']) {
        card[name] = root.querySelector('[' + UI + '="' + name + '"]')
    }

    // ── 换源面板 ────────────────────────────────────────────────
    const SRC = 'data-source-ui'
    const sourceNode = name => root.querySelector('[' + SRC + '="' + name + '"]')
    const servers = Array.from(root.querySelectorAll('[' + SRC + '=server]'))
    const types = Array.from(root.querySelectorAll('[' + SRC + '=type]'))
    const idInput = sourceNode('id')
    const urlPreview = sourceNode('url')
    const descriptor = sourceNode('descriptor')
    const trackCounts = Array.from(root.querySelectorAll('[' + SRC + '=trackCount]'))
    const presets = Array.from(root.querySelectorAll('[' + SRC + '=preset]'))

    // ── 抽屉：队列 / 换源 两个页签（入口在顶栏，抽屉从右侧滑出）──
    const pickSourceNode = name =>
        root.querySelector('[' + SRC + '="' + name + '"]') || doc.querySelector('[' + SRC + '="' + name + '"]')
    const drawer = sourceNode('drawer')
    const drawerOpen = pickSourceNode('drawerOpen')
    const drawerSource = pickSourceNode('drawerSource')
    const drawerClose = sourceNode('drawerClose')
    const drawerBackdrop = sourceNode('drawerBackdrop')
    const drawerTabs = Array.from(root.querySelectorAll('[data-drawer-tab-btn]'))
    let drawerReturn = null

    function setDrawerTab(name) {
        root.dataset.drawerTab = name
        drawerTabs.forEach(tab => {
            tab.setAttribute('aria-selected', String(tab.dataset.drawerTabBtn === name))
        })
    }

    function setDrawer(open, tab) {
        if (!drawer) return
        if (open && tab) setDrawerTab(tab)
        drawer.hidden = !open
        if (drawerBackdrop) {
            drawerBackdrop.hidden = !open
            drawerBackdrop.classList.toggle('is-on', open)
        }
        if (open) {
            drawerReturn = doc.activeElement
            if (root.dataset.drawerTab === 'source') idInput.focus()
            else (drawer.focus ? drawer.focus() : drawerClose.focus())
        } else if (drawerReturn && drawerReturn.focus) {
            drawerReturn.focus()
        }
    }

    if (drawer && drawerOpen && drawerClose) {
        drawer.classList.add('is-drawer')
        drawer.setAttribute('aria-modal', 'true')
        drawerOpen.hidden = false
        if (drawerSource) drawerSource.hidden = false
        drawerClose.hidden = false
        setDrawerTab(root.dataset.drawerTab || 'queue')
        drawerTabs.forEach(tab => tab.addEventListener('click', () => setDrawerTab(tab.dataset.drawerTabBtn)))
        setDrawer(false)
        drawerOpen.addEventListener('click', () => setDrawer(true, 'queue'))
        if (drawerSource) drawerSource.addEventListener('click', () => setDrawer(true, 'source'))
        drawerClose.addEventListener('click', () => setDrawer(false))
        if (drawerBackdrop) drawerBackdrop.addEventListener('click', () => setDrawer(false))
        doc.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !drawer.hidden) setDrawer(false)
        })
    }

    /** 单选组里被选中的值。 */
    function checkedValue(list) {
        const hit = list.find(input => input.checked)
        return hit ? hit.value : ''
    }

    /**
     * 换源面板 → 工作台同步：
     * 类型 chip 的可用性跟随平台的 support_type；根元素的 data-* 与请求预览实时更新。
     */
    function syncSource() {
        const server = checkedValue(servers)
        const hit = servers.find(input => input.value === server)
        const support = ((hit && hit.dataset.support) || '').split(',').filter(Boolean)
        types.forEach(input => {
            const usable = !support.length || support.includes(input.value)
            input.disabled = !usable
            const chip = input.closest('.chip')
            if (chip) chip.classList.toggle('is-off', !usable)
        })
        if (!types.find(input => input.checked && !input.disabled)) {
            const fallback = types.find(input => !input.disabled)
            if (fallback) fallback.checked = true
        }
        const type = checkedValue(types)
        const id = idInput.value.trim()
        root.dataset.server = server
        root.dataset.type = type
        root.dataset.id = id
        const query = 'server=' + encodeURIComponent(server) + '&type=' + encodeURIComponent(type) +
            '&id=' + encodeURIComponent(id)
        urlPreview.textContent = 'GET ' + '/api?' + query
        descriptor.textContent = '/api · server=' + server + ' · type=' + type + ' · id=' + (id || '…')
        presets.forEach(button => {
            const same = button.dataset.presetServer === server && button.dataset.presetType === type &&
                button.dataset.presetId === id
            if (same) button.setAttribute('aria-current', 'true')
            else button.removeAttribute('aria-current')
        })
    }

    /** 曲目单里的一行：衬线编号 + 曲名 + 歌手。 */
    function trackRow(track, index) {
        const row = doc.createElement('button')
        row.type = 'button'
        row.className = 'track-row'
        const no = doc.createElement('span')
        no.className = 'track-no'
        no.textContent = String(index + 1).padStart(2, '0')
        const name = doc.createElement('span')
        name.className = 'track-name'
        name.textContent = track.name
        const artist = doc.createElement('span')
        artist.className = 'track-artist'
        artist.textContent = track.artist
        row.append(no, name, artist)
        row.setAttribute('aria-label', '选择曲目 ' + (index + 1) + ' ' + track.name + ' — ' + track.artist)
        row.addEventListener('click', () => select(card, index))
        return row
    }

    /** 载入当前数据源的曲目列表（唯一的请求入口，只在用户操作后触发）。 */
    async function load() {
        if (scheduler.blocked()) { status(card, '请求冷却中，请稍后手动加载。'); return }
        card.load.disabled = true
        status(card, '排队加载接口数据…')
        try {
            const url = new URL('/api', env.location.origin)
            for (const key of ['server', 'type', 'id']) url.searchParams.set(key, root.dataset[key])
            const data = await scheduler.request(url.href)
            if (!Array.isArray(data)) throw new Error('接口响应不是曲目数组')
            card.songs = data
                .filter(x => x && typeof x === 'object')
                .slice(0, 1000)
                .map(x => core.song(x, env.location.origin))
            card.list.replaceChildren()
            card.songs.forEach((track, i) => card.list.append(trackRow(track, i)))
            trackCounts.forEach(node => {
                node.textContent = card.songs.length ? card.songs.length + ' 首' : ''
            })
            card.load.disabled = false
            status(card, card.songs.length ? '数据已加载；请选择曲目。' : '接口返回空列表。')
            // 选曲保持本地：只是把第一首显示出来，不请求音频也不自动播放。
            if (card.songs.length) {
                card.index = 0
                card.title.textContent = card.songs[0].name
                card.artist.textContent = card.songs[0].artist
                card.play.disabled = false
                card.prev.disabled = true
                card.next.disabled = card.songs.length < 2
                card.lyrics.textContent = '点击播放时加载当前曲目的歌词与封面；切歌不会自动播放。'
                highlight(card, 0)
            }
        } catch (error) { status(card, error.message); card.load.disabled = false }
    }

    // ── 音量：一个 range + 静音按钮 ─────────────────────────────
    const volume = root.querySelector('#volume')
    const mute = root.querySelector('#mute')
    const volumeValue = root.querySelector('#volume-value')

    function paintVolume() {
        const level = audio.muted ? 0 : audio.volume
        if (volume) {
            volume.value = String(level)
            volume.style.setProperty('--range-value', (level * 100).toFixed(0) + '%')
        }
        if (volumeValue) volumeValue.textContent = Math.round(level * 100) + '%'
        if (mute) {
            mute.classList.toggle('is-muted', level === 0)
            mute.setAttribute('aria-label', level === 0 ? '取消静音' : '静音')
            mute.title = level === 0 ? '取消静音' : '静音'
        }
    }

    if (volume) {
        volume.addEventListener('input', () => {
            audio.muted = false
            audio.volume = Math.max(0, Math.min(1, Number(volume.value)))
            paintVolume()
        })
    }
    if (mute) mute.addEventListener('click', () => { audio.muted = !audio.muted; paintVolume() })
    paintVolume()

    // ── 事件挂载 ────────────────────────────────────────────────
    servers.forEach(input => input.addEventListener('change', syncSource))
    types.forEach(input => input.addEventListener('change', syncSource))
    idInput.addEventListener('input', syncSource)

    // 预设档案：一键填入换源面板并载入（等价于原来的「加载示例」）。
    presets.forEach(button => button.addEventListener('click', () => {
        const server = button.dataset.presetServer
        const type = button.dataset.presetType
        const id = button.dataset.presetId
        const serverInput = servers.find(input => input.value === server)
        if (serverInput && !serverInput.disabled) serverInput.checked = true
        const typeInput = types.find(input => input.value === type)
        if (typeInput) typeInput.checked = true
        idInput.value = id
        syncSource()
        setDrawer(false)
        load()
    }))

    card.load.addEventListener('click', () => { setDrawer(false); load() })
    card.play.addEventListener('click', () => toggle(card))
    // 上一首 / 下一首：切过去并接着播（正在放的时候才播，没在放就只换曲）
    card.prev.addEventListener('click', () => {
        const index = card.index - 1
        if (index < 0) return
        if (!audio.paused) playTrack(card, index)
        else select(card, index)
    })
    card.next.addEventListener('click', () => {
        const index = card.index + 1
        if (index >= card.songs.length) return
        if (!audio.paused) playTrack(card, index)
        else select(card, index)
    })
    card.seek.addEventListener('input', () => { if (active === card) seek(Number(card.seek.value)) })
    card.cover.addEventListener('error', () => { card.cover.hidden = true })

    syncSource()

    // 打开页面就直接载入默认数据源（网易云歌单 2877205781）
    load()

    return { audio, scheduler }
}

/**
 * /test 试听实验室 · 播放与交互状态（React 版）
 *
 * 与旧的内联版（src/pages/test/client.js）对齐的契约：
 * - 全页共享一个 Audio，preload='none'；切歌不自动播放（除非点的是「下一首」或连播触发）；
 * - 请求串行（间隔 ≥1500ms）+ 同 URL 去重 + 有界缓存；HTTP 429 只冷却，永不自动重试；
 * - 歌词按 currentTime 二分高亮并滚动居中，点击歌词行跳转；
 * - 封面与歌词走同一个调度器，失败保留占位并提示。
 *
 * 两处与旧版不同（本次按需求新增）：
 * - 打开页面自动载入默认数据源（首屏只发这一次列表请求）；
 * - 支持「连播」：一首播完自动切下一首，可随时关掉。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createScheduler,
  lyricIndex,
  parseLRC,
  song,
  type LyricLine,
  type Scheduler,
  type Song,
} from './core'

export interface Source {
  server: string
  type: string
  id: string
}

export type DrawerTab = 'queue' | 'source'

export interface PlayerApi {
  songs: Song[]
  index: number
  lines: LyricLine[]
  lineIndex: number
  status: string
  playing: boolean
  currentTime: number
  duration: number
  cover: string
  coverNote: string
  lyricPlain: string
  loading: boolean
  source: Source
  drawerOpen: boolean
  drawerTab: DrawerTab
  volume: number
  muted: boolean
  cooldownUntil: number
  /** 冷却剩余秒数（0 表示不在冷却中） */
  cooldownLeft: number
  /** 秒 → m:ss */
  clock: (value: number) => string
  load: (override?: Source) => Promise<void>
  select: (index: number) => Promise<void>
  toggle: () => Promise<void>
  seek: (time: number) => void
  step: (delta: number) => Promise<void>
  setSource: (patch: Partial<Source>) => void
  applyPreset: (preset: Source) => Promise<void>
  setDrawer: (open: boolean, tab?: DrawerTab) => void
  setDrawerTab: (tab: DrawerTab) => void
  setVolume: (value: number) => void
  toggleMute: () => void
}

/** 秒 → m:ss */
const clock = (value: number): string =>
  Number.isFinite(value)
    ? Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0')
    : '0:00'

export function usePlayer(initialSource: Source): PlayerApi {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const generationRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const objectUrlRef = useRef('')
  const playPendingRef = useRef(false)
  const schedulerRef = useRef<Scheduler | null>(null)

  const [songs, setSongs] = useState<Song[]>([])
  const [index, setIndex] = useState(0)
  const [lines, setLines] = useState<LyricLine[]>([])
  const [lineIndex, setLineIndex] = useState(-1)
  const [status, setStatus] = useState('尚未请求接口 · 点右上角「换源」挑一个数据源')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [cover, setCover] = useState('')
  const [coverNote, setCoverNote] = useState('封面也是接口返回的')
  const [lyricPlain, setLyricPlain] = useState('')
  const [loading, setLoading] = useState(false)
  const [source, setSourceState] = useState<Source>(initialSource)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('queue')
  const [volume, setVolumeState] = useState(1)
  const [muted, setMuted] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  /** 冷却剩余秒数：给顶栏的提示用 */
  const [cooldownLeft, setCooldownLeft] = useState(0)

  // 事件回调里要读到最新的队列与播放状态，用 ref 镜像，避免回调反复重建
  const songsRef = useRef<Song[]>([])
  const indexRef = useRef(0)
  const playingRef = useRef(false)
  const linesRef = useRef<LyricLine[]>([])

  useEffect(() => {
    songsRef.current = songs
  }, [songs])
  useEffect(() => {
    indexRef.current = index
  }, [index])
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    linesRef.current = lines
  }, [lines])

  /** 调度器只创建一次：它是全页唯一的请求通道 */
  const scheduler = useMemo(() => {
    let storage: Pick<Storage, 'getItem' | 'setItem'> | null = null
    try {
      storage = window.sessionStorage
    } catch {
      /* 隐私模式下可能不可用，退化为内存冷却 */
    }
    return createScheduler({
      fetcher: window.fetch.bind(window),
      storage,
      onCooldown: (until) => setCooldownUntil(until),
    })
  }, [])

  useEffect(() => {
    schedulerRef.current = scheduler
  }, [scheduler])

  /** 冷却倒计时：每秒刷新一次 */
  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownLeft(0)
      return
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
      setCooldownLeft(left)
      if (left === 0) setCooldownUntil(0)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  /** 同步进度条、时间文本与歌词高亮 */
  const sync = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const dur = Number.isFinite(audio.duration) ? audio.duration : 0
    setDuration(dur)
    setCurrentTime(audio.currentTime || 0)
    const found = lyricIndex(linesRef.current, audio.currentTime || 0)
    setLineIndex((prev) => (prev === found ? prev : found))
  }, [])

  /** 彻底停止：中止请求、暂停音频、清掉 src 与封面临时地址 */
  const stop = useCallback(() => {
    generationRef.current++
    controllerRef.current?.abort()
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    setPlaying(false)
    playPendingRef.current = false
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = ''
    }
    setCover('')
  }, [])

  /** 选中第 index 首：只更新界面并加载「歌词 + 封面」，不碰 Audio.src */
  const select = useCallback(
    async (next: number) => {
      const list = songsRef.current
      if (next < 0 || next >= list.length) return
      stop()
      const track = list[next]
      setIndex(next)
      setLines([])
      setLineIndex(-1)
      setLyricPlain('')
      const controller = new AbortController()
      controllerRef.current = controller
      const signal = controller.signal
      const token = generationRef.current
      const current = () => token === generationRef.current && !signal.aborted

      setStatus(
        track.url
          ? '已选择曲目；点击播放开始音频请求。'
          : '接口未返回可用的 HTTP(S) 音频链接。',
      )
      setCoverNote('仅加载当前曲目的封面与歌词')
      setLyricPlain('歌词加载中…')

      /** 歌词：内联（@ 开头）直接用，否则按 URL 走同一个调度器 */
      const loadLyrics = async () => {
        try {
          const text = track.lrc.startsWith('@')
            ? track.lrc.slice(1)
            : track.lrc
              ? ((await scheduler.request(track.lrc, 'text', signal)) as string)
              : ''
          if (!current()) return
          const parsed = parseLRC(text)
          setLines(parsed.lines)
          if (!parsed.lines.length) {
            setLyricPlain(parsed.plain ? '未同步歌词\n\n' + parsed.plain : '暂无歌词')
            return
          }
          setLyricPlain('')
        } catch (error) {
          if (current()) setLyricPlain('歌词未加载：' + (error as Error).message)
        }
      }

      /** 封面：同样走调度器取 blob（type=pic 是 302 跳转），失败保留唱片占位 */
      const loadCover = async () => {
        if (!track.pic) return
        try {
          const blob = (await scheduler.request(track.pic, 'blob', signal)) as Blob
          if (!current()) return
          if (!blob.type.startsWith('image/')) throw new Error('封面不是图片')
          const url = URL.createObjectURL(blob)
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = url
          setCover(url)
        } catch {
          if (current()) setCoverNote('封面未加载（可能为跨域限制）；保留唱片占位。')
        }
      }

      await loadLyrics()
      if (current()) await loadCover()
    },
    [scheduler, stop],
  )

  /**
   * 播放指定曲目：选曲（加载歌词与封面）与发起播放并行，
   * 播放本身仍要排队走调度器，保证与其它请求保持 1500ms 间隔。
   */
  const playTrack = useCallback(
    async (next: number) => {
      const list = songsRef.current
      if (next < 0 || next >= list.length) return
      const audio = audioRef.current
      if (!audio) return
      const track = list[next]
      if (!track.url) {
        await select(next)
        return
      }

      // select 的同步部分会先停掉当前播放并换曲；异步部分（歌词/封面）与播放并行
      void select(next)

      if (scheduler.blocked()) {
        setStatus('请求冷却中，暂不发起播放。')
        return
      }

      const token = generationRef.current
      playPendingRef.current = true
      setStatus('准备播放…')
      try {
        await scheduler.schedule(() => {
          if (token !== generationRef.current || !playPendingRef.current) return
          if (!audio.getAttribute('src')) audio.src = track.url
          // 不占着通道等原生媒体缓冲
          void audio.play().catch((error: Error) => {
            if (token !== generationRef.current) return
            playPendingRef.current = false
            audio.pause()
            setPlaying(false)
            setStatus('播放未开始：' + error.message + '；请手动操作，不自动重试。')
          })
        })
      } catch (error) {
        if (token === generationRef.current) {
          playPendingRef.current = false
          setStatus((error as Error).message)
        }
      }
    },
    [scheduler, select],
  )

  /** 播放 / 暂停。第一次点播放时才设置 Audio.src。 */
  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    const list = songsRef.current
    if (!list.length) return

    if (!audio.paused || playPendingRef.current) {
      playPendingRef.current = false
      audio.pause()
      setPlaying(false)
      setStatus('已暂停')
      return
    }

    if (scheduler.blocked()) {
      setStatus('请求冷却中，暂不发起播放。')
      return
    }

    const track = list[indexRef.current]
    if (!track?.url) {
      setStatus('接口未返回可用的 HTTP(S) 音频链接。')
      return
    }

    const token = generationRef.current
    playPendingRef.current = true
    setStatus('准备播放…')
    try {
      // 只借用全局请求通道（保证串行间隔），不抓音频字节，交给原生 <audio>。
      await scheduler.schedule(() => {
        if (token !== generationRef.current || !playPendingRef.current) return
        if (!audio.getAttribute('src')) audio.src = track.url
        // 不占着通道等原生媒体缓冲
        void audio.play().catch((error: Error) => {
          if (token !== generationRef.current) return
          playPendingRef.current = false
          audio.pause()
          setPlaying(false)
          setStatus('播放未开始：' + error.message + '；请手动操作，不自动重试。')
        })
      })
    } catch (error) {
      if (token === generationRef.current) {
        playPendingRef.current = false
        setStatus((error as Error).message)
      }
    }
  }, [scheduler])

  /** 跳转播放位置（歌词点击、进度条拖动共用） */
  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(time, audio.duration))
      sync()
    }
  }, [sync])

  /** 载入当前数据源的曲目列表（唯一的请求入口） */
  const load = useCallback(
    async (override?: Source) => {
      const target = override ?? source
      if (scheduler.blocked()) {
        setStatus('请求冷却中，请稍后手动加载。')
        return
      }
      setLoading(true)
      setStatus('排队加载接口数据…')
      try {
        const url = new URL('/api', window.location.origin)
        for (const key of ['server', 'type', 'id'] as const) url.searchParams.set(key, target[key])
        const data = (await scheduler.request(url.href)) as unknown
        if (!Array.isArray(data)) throw new Error('接口响应不是曲目数组')
        const list = data
          .filter((x) => x && typeof x === 'object')
          .slice(0, 1000)
          .map((x) => song(x as Record<string, unknown>, window.location.origin))
        songsRef.current = list
        setSongs(list)
        setStatus(list.length ? '数据已加载；请选择曲目。' : '接口返回空列表。')
        // 选曲保持本地：只是把第一首显示出来，不请求音频也不自动播放
        if (list.length) {
          indexRef.current = 0
          setIndex(0)
          setLines([])
          setLineIndex(-1)
          setLyricPlain('点击播放时加载当前曲目的歌词与封面；切歌不会自动播放。')
        }
      } catch (error) {
        setStatus((error as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [scheduler, source],
  )

  /** 换源：更新数据源并把类型收敛到该平台支持的范围内 */
  const setSource = useCallback((patch: Partial<Source>) => {
    setSourceState((prev) => ({ ...prev, ...patch }))
  }, [])

  /** 预设档案：一键填入换源面板并载入 */
  const applyPreset = useCallback(
    async (preset: Source) => {
      setSourceState(preset)
      setDrawerOpen(false)
      await load(preset)
    },
    [load],
  )

  /** 上一首 / 下一首：正在播放时接着播，否则只是切换选中项 */
  const step = useCallback(
    async (delta: number) => {
      const next = indexRef.current + delta
      if (next < 0 || next >= songsRef.current.length) return
      if (playingRef.current) {
        await playTrack(next)
      } else {
        await select(next)
      }
    },
    [playTrack, select],
  )

  /** 侧栏：打开时可顺便切到某个页签 */
  const setDrawer = useCallback((open: boolean, tab?: DrawerTab) => {
    if (tab) setDrawerTab(tab)
    setDrawerOpen(open)
  }, [])

  const setVolume = useCallback((value: number) => {
    const audio = audioRef.current
    const level = Math.max(0, Math.min(1, value))
    setVolumeState(level)
    if (audio) {
      audio.muted = false
      audio.volume = level
    }
    setMuted(false)
  }, [])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }, [])

  /** 播放结束后的事件：自动切到下一首（连播） */
  const handleEnded = useCallback(() => {
    const next = indexRef.current + 1
    const list = songsRef.current
    if (next < list.length) {
      setStatus('连播：正在切到下一首…')
      void playTrack(next)
      return
    }
    setStatus('已播到最后一首。')
  }, [playTrack])

  const handleEndedRef = useRef(handleEnded)
  useEffect(() => {
    handleEndedRef.current = handleEnded
  }, [handleEnded])

  /** 音频元素与事件绑定 */
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'none'
    audioRef.current = audio
    // 挂到 DOM 上（隐藏）：全页仍然只有一个 Audio 实例，
    // 但这样浏览器媒体控件、调试与自动化测试都能拿到它。
    audio.hidden = true
    audio.setAttribute('data-testid', 'test-audio')
    document.body.append(audio)

    const onPlaying = () => {
      if (!audio.paused && audio.getAttribute('src')) {
        playPendingRef.current = false
        setPlaying(true)
        setStatus('正在播放')
      }
    }
    const onPause = () => setPlaying(false)
    const onWaiting = () => setStatus('音频缓冲中…')
    const onEnded = () => handleEndedRef.current()
    const onError = () => {
      if (!audio.getAttribute('src')) return
      stop()
      setStatus('媒体播放失败，已停止。原生音频无法判断是否为 HTTP 429；不会重试或跳曲。')
    }
    const onTimeUpdate = () => sync()

    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    for (const event of ['timeupdate', 'loadedmetadata', 'durationchange']) {
      audio.addEventListener(event, onTimeUpdate)
    }

    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      for (const event of ['timeupdate', 'loadedmetadata', 'durationchange']) {
        audio.removeEventListener(event, onTimeUpdate)
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      audio.remove()
      audioRef.current = null
    }
  }, [stop, sync])

  return {
    songs,
    index,
    lines,
    lineIndex,
    status,
    playing,
    currentTime,
    duration,
    cover,
    coverNote,
    lyricPlain,
    loading,
    source,
    drawerOpen,
    drawerTab,
    volume: muted ? 0 : volume,
    muted,
    cooldownUntil,
    cooldownLeft,
    clock,
    load,
    select,
    toggle,
    seek,
    step,
    setSource,
    applyPreset,
    setDrawer,
    setDrawerTab,
    setVolume,
    toggleMute,
  }
}

/**
 * /test 试听实验室（React 版）
 *
 * 迁移自旧的内联页面（src/pages/test/**）。行为契约逐条保留：
 *   - 首屏不发任何请求，只有点「载入」/ 预设 / 播放才进入调度器；
 *   - 请求串行（间隔 ≥1500ms）+ 同 URL 去重 + 有界缓存；429 只冷却，永不自动重试；
 *   - 全页一个 Audio，切歌不自动播放，播完不自动下一首；
 *   - 歌词二分高亮 + 滚动居中 + 点击跳转；封面与歌词共用调度器。
 *
 * 与旧版的一个有意差异：旧版打开页面会自动载入默认数据源，
 * 这里改成「不自动请求」，首屏保持零请求（与首页「按需加载」的约定一致），
 * 用户在换源面板点「载入」或点预设档案即可。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Art, Deck, Drawer, Lyrics } from '../features/test/components'
import { FALLBACK_CAPABILITIES, fetchCapabilities, TYPE_NAMES } from '../features/test/api'
import { usePlayer } from '../features/test/usePlayer'
import { platformIconCss } from '../features/test/platformIcons'
import '../features/test/test.css'

/** 默认数据源：优先网易云歌单（只预填，不请求） */
const DEFAULT_SOURCE = { server: 'netease', type: 'playlist', id: '2877205781' }

export default function TestPage() {
  const [capabilities, setCapabilities] = useState(FALLBACK_CAPABILITIES)
  const player = usePlayer(DEFAULT_SOURCE)

  // 能力矩阵：运行时从 /api/capabilities 读，前端不维护第二份清单
  useEffect(() => {
    const controller = new AbortController()
    fetchCapabilities(controller.signal)
      .then(setCapabilities)
      .catch(() => {
        /* 取不到就用兜底数据，页面仍可操作 */
      })
    return () => controller.abort()
  }, [])

  // 平台图标的 background-image：每个平台只内联一次
  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.testIcons = '1'
    style.textContent = platformIconCss
    document.head.append(style)
    return () => {
      style.remove()
    }
  }, [])

  const columns = capabilities.columns
  const listTypes = useMemo(
    () => capabilities.types.filter((type) => ['song', 'playlist', 'album', 'artist', 'search'].includes(type)),
    [capabilities.types],
  )
  const serverLabel = columns.find((column) => column.id === player.source.server)?.label ?? player.source.server
  const typeLabel = TYPE_NAMES[player.source.type] ?? player.source.type

  // 打开页面自动载入默认数据源（只发这一次列表请求）
  const autoLoaded = useRef(false)
  const loadRef = useRef(player.load)
  loadRef.current = player.load
  useEffect(() => {
    if (autoLoaded.current) return
    autoLoaded.current = true
    void loadRef.current()
  }, [])

  return (
    <div className="testPage">
      <header className="topbar">
        <a className="brand" href="/">
          <img className="brand-logo" src="/logo.png" alt="" width={22} height={22} />
          <span>Meting API</span>
          <em>试听</em>
        </a>
        <nav className="topbar-actions" aria-label="站点导航">
          <button
            className="ghost"
            type="button"
            data-source-ui="drawerOpen"
            aria-expanded={player.drawerOpen}
            onClick={() => player.setDrawer(true, 'queue')}
          >
            队列
          </button>
          <button
            className="ghost"
            type="button"
            data-source-ui="drawerSource"
            onClick={() => player.setDrawer(true, 'source')}
          >
            换源
          </button>
          <a className="ghost" href="/">
            返回首页
          </a>
        </nav>
      </header>

      <main id="main" className="stage">
        <div className={`workspace${player.drawerOpen ? ' has-drawer' : ''}`}>
          <article className={`player${player.playing ? ' is-playing' : ''}`}>
            <Deck player={player} serverLabel={serverLabel} typeLabel={typeLabel} />
            <Art player={player} />
            <Lyrics player={player} />
          </article>
          <Drawer
            player={player}
            columns={columns}
            types={listTypes}
            presets={capabilities.presets}
          />
        </div>
      </main>
    </div>
  )
}

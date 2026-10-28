/**
 * /test 试听页的 React 组件
 *
 * 结构与旧的内联版一一对应：
 *   - 控制台（deck）：状态、曲名、进度、传送控制、音量；
 *   - 封套（art）：唱片占位 / 封面；
 *   - 歌词（lyrics）：滚动歌词与逐行高亮；
 *   - 抽屉（drawer）：队列 / 换源 两个页签，从右侧滑出。
 */
import { useEffect, useRef } from 'react'
import { platformIcons } from './platformIcons'
import { PLATFORM_SHORT_NAMES, TYPE_NAMES, type CapabilityColumn } from './api'
import type { PlayerApi } from './usePlayer'

/** 平台图标：有 logo 用 logo，没有就退化成文字标签 */
function PlatformIcon({ provider, size = 16 }: { provider: string; size?: number }) {
  if (!platformIcons[provider]) return null
  return (
    <span
      className="platform-ico"
      data-platform={provider}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

/** ---------------- 控制台 ---------------- */
export function Deck({
  player,
  serverLabel,
  typeLabel,
}: {
  player: PlayerApi
  serverLabel: string
  typeLabel: string
}) {
  const { songs, index, status, playing, currentTime, duration } = player
  const track = songs[index]
  const ratio = duration ? Math.min(1, currentTime / duration) : 0

  return (
    <section className="deck" aria-label="播放控制">
      <div className="kicker">
        <span className="bar" aria-hidden="true" />
        <span className="kicker-text" data-ui="status" role="status" aria-live="polite">
          {status}
        </span>
        <span className="dot" aria-hidden="true" />
      </div>

      <h1 className="track-title">
        <span className="num" data-source-ui="descriptor">
          /api · server={player.source.server} · type={player.source.type} · id=
          {player.source.id || '…'}
        </span>
        <span className="title-text" data-ui="title">
          {track ? track.name : '还没载入曲目'}
        </span>
      </h1>
      <p className="track-artist" data-ui="artist">
        {track ? track.artist : `${serverLabel} · ${typeLabel}`}
      </p>
      <p className="track-meta">
        <span data-source-ui="trackCount">{songs.length ? `${songs.length} 首` : ''}</span>
      </p>

      <div className="progress-wrap">
        <input
          className="scrub"
          data-ui="seek"
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(currentTime, duration || 1)}
          aria-label="播放进度，秒"
          disabled={!duration}
          style={{ '--range-value': `${(ratio * 100).toFixed(2)}%` } as React.CSSProperties}
          onChange={(event) => player.seek(Number(event.target.value))}
        />
        <div className="times">
          <span className="time-note">进度</span>
          <output className="time-value" data-ui="time">
            {player.clock(currentTime)} / {player.clock(duration)}
          </output>
        </div>
      </div>

      <div className="transport" aria-label="播放控制">
        <button
          type="button"
          className="tbtn"
          data-ui="prev"
          aria-label="上一首"
          title="上一首"
          disabled={index === 0 || !songs.length}
          onClick={() => void player.step(-1)}
        />
        <button
          type="button"
          className="playbtn"
          data-ui="play"
          aria-label={playing ? `暂停 ${track?.name ?? ''}` : `播放 ${track?.name ?? ''}`}
          aria-pressed={playing}
          title={playing ? '暂停' : '播放'}
          disabled={!track?.url}
          onClick={() => void player.toggle()}
        >
          {playing ? '暂停' : '播放'}
        </button>
        <button
          type="button"
          className="tbtn"
          data-ui="next"
          aria-label="下一首"
          title="下一首"
          disabled={index >= songs.length - 1 || !songs.length}
          onClick={() => void player.step(1)}
        />
      </div>

      <div className="deckrow">
        <div className="vol">
          <button
            type="button"
            className={`vol-btn${player.muted ? ' is-muted' : ''}`}
            aria-label={player.muted ? '取消静音' : '静音'}
            title={player.muted ? '取消静音' : '静音'}
            onClick={player.toggleMute}
          />
          <input
            className="volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.volume}
            aria-label="音量"
            style={{ '--range-value': `${(player.volume * 100).toFixed(0)}%` } as React.CSSProperties}
            onChange={(event) => player.setVolume(Number(event.target.value))}
          />
          <output className="vol-num">{Math.round(player.volume * 100)}%</output>
        </div>
      </div>
    </section>
  )
}

/** ---------------- 封套 ---------------- */
export function Art({ player }: { player: PlayerApi }) {
  return (
    <section className="art" aria-label="封面">
      <div className="art-stage">
        <div className="art-vtext" aria-hidden="true">
          Side A · 33⅓ · Meting API
        </div>
        <div className="groove" aria-hidden="true" />
        <div className="plate" aria-hidden="true" />
        <figure className="sleeve">
          {player.cover ? (
            <img src={player.cover} alt="曲目封面" data-ui="cover" />
          ) : (
            <img src="" alt="" data-ui="cover" data-empty="true" hidden />
          )}
          <span className="sleeve-empty" aria-hidden="true">
            METING
            <br />
            API
          </span>
          <figcaption className="sleeve-tag">METING · ARCHIVE</figcaption>
        </figure>
        <p className="cover-note" data-ui="coverNote">
          {player.coverNote}
        </p>
      </div>
    </section>
  )
}

/** ---------------- 歌词 ---------------- */
export function Lyrics({ player }: { player: PlayerApi }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 当前行滚动到歌词区垂直中央
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const node = container.querySelector<HTMLElement>('.lyric-line.current')
    if (!node) return
    container.scrollTop = Math.max(
      0,
      node.offsetTop - container.offsetTop - container.clientHeight / 2 + node.clientHeight / 2,
    )
  }, [player.lineIndex, player.lines])

  return (
    <section className="lyrics" aria-label="歌词">
      <header className="lyr-head">
        <h2>歌词</h2>
        <span>Lyrics</span>
      </header>
      <div
        className="lyr-scroll"
        data-ui="lyrics"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="滚动歌词"
      >
        {player.lines.length ? (
          player.lines.map((line, i) => {
            // LRC 里同一时间戳的多行：第一行是原文，其余是翻译
            const parts = line.text.split('\n')
            return (
              <button
                key={`${line.time}-${i}`}
                type="button"
                className={`lyric-line${i === player.lineIndex ? ' current' : ''}`}
                data-time={line.time}
                aria-current={i === player.lineIndex ? 'true' : undefined}
                aria-label={`跳转到 ${player.clock(line.time)} ${parts[0]}`}
                onClick={() => player.seek(line.time)}
              >
                {parts[0] || '♪'}
                {parts.length > 1 ? (
                  <span className="lyric-translation">{parts.slice(1).join(' ')}</span>
                ) : null}
              </button>
            )
          })
        ) : (
          player.lyricPlain || '还没有歌词。\n\n先载入一个数据源，再点播放。'
        )}
      </div>
    </section>
  )
}

/** ---------------- 队列 ---------------- */
export function Queue({ player }: { player: PlayerApi }) {
  if (!player.songs.length) {
    return <p className="plist-empty">载入后，这里的歌会列出来。</p>
  }
  return (
    <>
      {player.songs.map((track, i) => (
        <button
          key={`${track.name}-${i}`}
          type="button"
          className={`track-row${i === player.index ? ' current' : ''}`}
          aria-current={i === player.index ? 'true' : undefined}
          aria-label={`选择曲目 ${i + 1} ${track.name} — ${track.artist}`}
          onClick={() => void player.select(i)}
        >
          <span className="track-no">{String(i + 1).padStart(2, '0')}</span>
          <span className="track-name">{track.name}</span>
          <span className="track-artist">{track.artist}</span>
        </button>
      ))}
    </>
  )
}

/** ---------------- 换源面板 ---------------- */
export function SourcePanel({
  player,
  columns,
  types,
  presets,
}: {
  player: PlayerApi
  columns: CapabilityColumn[]
  types: string[]
  presets: { provider: string; type: string; id: string }[]
}) {
  const { source } = player
  const currentColumn = columns.find((column) => column.id === source.server)
  const down = columns.filter((column) => column.status === 'down')

  // 类型 chip 的可用性跟随平台的 support_type
  const usableTypes = (type: string) =>
    !currentColumn || currentColumn.types.length === 0 || currentColumn.types.includes(type)

  const query = `server=${encodeURIComponent(source.server)}&type=${encodeURIComponent(source.type)}&id=${encodeURIComponent(source.id)}`

  return (
    <div className="source-panel">
      <fieldset className="source-group">
        <legend className="field-label">平台</legend>
        <div className="chip-row">
          {columns.map((column) => (
            <label
              key={column.id}
              className={`chip${column.status === 'down' ? ' is-off' : ''}`}
            >
              <input
                type="radio"
                name="src-server"
                value={column.id}
                checked={source.server === column.id}
                disabled={column.status === 'down'}
                onChange={() => player.setSource({ server: column.id })}
              />
              <span className="chip-text">
                <PlatformIcon provider={column.id} />
                {column.label}
              </span>
            </label>
          ))}
        </div>
        {down.length ? (
          <p className="fineprint">
            {down.map((column) => column.label).join('、')} 的上游已经不可用，先停用了。
          </p>
        ) : null}
      </fieldset>

      <fieldset className="source-group">
        <legend className="field-label">类型</legend>
        <div className="chip-row">
          {types.map((type) => (
            <label key={type} className={`chip${usableTypes(type) ? '' : ' is-off'}`}>
              <input
                type="radio"
                name="src-type"
                value={type}
                checked={source.type === type}
                disabled={!usableTypes(type)}
                onChange={() => player.setSource({ type })}
              />
              <span className="chip-text">{TYPE_NAMES[type] || type}</span>
            </label>
          ))}
        </div>
        <p className="fineprint">选了 search 就在下面填关键词；url / lrc / pic 不返回曲目，去首页试。</p>
      </fieldset>

      <div className="source-group">
        <label className="field-label" htmlFor="src-id">
          ID / 关键词
        </label>
        <div className="id-row">
          <input
            className="id-input"
            id="src-id"
            data-source-ui="id"
            type="text"
            value={source.id}
            maxLength={256}
            spellCheck={false}
            onChange={(event) => player.setSource({ id: event.target.value })}
          />
          <button
            className="button button-primary"
            type="button"
            data-ui="load"
            disabled={player.loading}
            onClick={() => void player.load()}
          >
            {player.loading ? '载入中' : '载入'}
          </button>
        </div>
        <p className="fineprint">歌曲号、歌单号，或者搜一个词，中文也行。</p>
      </div>

      <p className="request-preview">
        <span className="field-label">请求</span>
        <code data-source-ui="url">GET /api?{query}</code>
      </p>

      {presets.length ? (
        <div className="preset-block">
          <p className="field-label">预设</p>
          <ul className="preset-list">
            {presets.map((preset) => {
              const same =
                preset.provider === source.server &&
                preset.type === source.type &&
                preset.id === source.id
              const label = TYPE_NAMES[preset.type] || preset.type
              return (
                <li key={`${preset.provider}-${preset.type}-${preset.id}`}>
                  <button
                    type="button"
                    className="preset"
                    data-source-ui="preset"
                    aria-current={same ? 'true' : undefined}
                    aria-label={`载入 ${preset.provider} ${label} 示例 ${preset.id}`}
                    onClick={() =>
                      void player.applyPreset({
                        server: preset.provider,
                        type: preset.type,
                        id: preset.id,
                      })
                    }
                  >
                    <span className="preset-name">
                      <PlatformIcon provider={preset.provider} size={14} />
                      <span>
                        {PLATFORM_SHORT_NAMES[preset.provider] || preset.provider} · {label}
                      </span>
                    </span>
                    <span className="preset-id">{preset.id}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** ---------------- 抽屉 ---------------- */
export function Drawer({
  player,
  columns,
  types,
  presets,
}: {
  player: PlayerApi
  columns: CapabilityColumn[]
  types: string[]
  presets: { provider: string; type: string; id: string }[]
}) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const idRef = useRef<HTMLInputElement>(null)

  // 打开时把焦点移进抽屉；Esc 收起
  useEffect(() => {
    if (!player.drawerOpen) return
    const target = player.drawerTab === 'source' ? idRef.current : drawerRef.current
    target?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') player.setDrawer(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [player, player.drawerOpen, player.drawerTab])

  return (
    <>
      {/* 侧边把手：抽屉收起时贴在右侧边缘，随时可以拉出来 */}
      <button
        className={`drawer-handle${player.drawerOpen ? ' is-open' : ''}`}
        type="button"
        data-source-ui="drawerHandle"
        aria-label={player.drawerOpen ? '收起侧栏' : '展开侧栏'}
        aria-expanded={player.drawerOpen}
        title={player.drawerOpen ? '收起侧栏' : '展开侧栏'}
        onClick={() => player.setDrawer(!player.drawerOpen)}
      >
        <span className="drawer-handle-icon" aria-hidden="true" />
      </button>

      <aside
        className={`drawer is-drawer${player.drawerOpen ? ' is-open' : ''}`}
        data-source-ui="drawer"
        role="dialog"
        tabIndex={-1}
        aria-labelledby="drawer-title"
        ref={drawerRef}
      >
        <div className="drawer-head">
          <div>
            <h2 id="drawer-title">曲目</h2>
            <p>
              <span>{player.songs.length ? `${player.songs.length} 首` : ''}</span>
            </p>
          </div>
          <button
            className="icon-btn"
            type="button"
            data-source-ui="drawerClose"
            aria-label="收起侧栏"
            title="收起侧栏"
            onClick={() => player.setDrawer(false)}
          >
            ×
          </button>
        </div>
        <div className="drawer-tabs" role="tablist" aria-label="侧栏面板">
          <button
            type="button"
            className="drawer-tab"
            role="tab"
            aria-selected={player.drawerTab === 'queue'}
            onClick={() => player.setDrawerTab('queue')}
          >
            队列
          </button>
          <button
            type="button"
            className="drawer-tab"
            role="tab"
            aria-selected={player.drawerTab === 'source'}
            onClick={() => player.setDrawerTab('source')}
          >
            换源
          </button>
        </div>
        <div className="drawer-panel" hidden={player.drawerTab !== 'queue'}>
          <div className="plist" data-ui="list" role="group" aria-label="曲目单">
            <Queue player={player} />
          </div>
        </div>
        <div className="drawer-panel" hidden={player.drawerTab !== 'source'}>
          <SourcePanel
            player={player}
            columns={columns}
            types={types}
            presets={presets}
          />
        </div>
      </aside>
    </>
  )
}

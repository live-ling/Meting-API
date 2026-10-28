/**
 * /test 试听页的数据层：能力矩阵 + 预设组合。
 *
 * 能力矩阵来自后端 /api/capabilities（读 providers 的 support_type 与状态），
 * 前端不再维护第二份硬编码清单：以后给某个平台增加类型，页面自动跟上。
 */
import { apiData } from '../../lib/http'

export interface CapabilityColumn {
  id: string
  label: string
  types: string[]
  status: 'ok' | 'down'
  note: string
}

export interface Preset {
  provider: string
  type: string
  id: string
}

export interface Capabilities {
  columns: CapabilityColumn[]
  types: string[]
  presets: Preset[]
}

/** 接口取不到时的兜底：至少保证页面能显示与操作 */
export const FALLBACK_CAPABILITIES: Capabilities = {
  columns: [
    { id: 'netease', label: '网易云音乐', types: ['url', 'lrc', 'song', 'album', 'playlist', 'artist', 'search', 'pic'], status: 'ok', note: '' },
    { id: 'tencent', label: 'QQ 音乐', types: ['url', 'pic', 'lrc', 'song', 'album', 'playlist'], status: 'ok', note: '' },
    { id: 'kugou', label: '酷狗音乐', types: ['url', 'lrc', 'song', 'album', 'playlist', 'search'], status: 'ok', note: '' },
  ],
  types: ['song', 'playlist', 'album', 'artist', 'search'],
  presets: [],
}

export async function fetchCapabilities(signal?: AbortSignal): Promise<Capabilities> {
  const data = await apiData<Capabilities>('/api/capabilities', { signal })
  if (!data || !Array.isArray(data.columns)) return FALLBACK_CAPABILITIES
  return data
}

/** 接口的 type 参数展示名 */
export const TYPE_NAMES: Record<string, string> = {
  playlist: '歌单',
  song: '单曲',
  album: '专辑',
  artist: '歌手',
  search: '搜索',
}

/** 窄屏用的平台短名 */
export const PLATFORM_SHORT_NAMES: Record<string, string> = {
  netease: '网易云',
  tencent: 'QQ',
  kugou: '酷狗',
  baidu: '百度',
  kuwo: '酷我',
}

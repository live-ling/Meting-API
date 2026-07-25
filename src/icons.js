/**
 * Meting-API 统一图标系统
 * 
 * 基于 Lucide Icons (lucide-static)，导出纯 SVG 字符串，完美契合 Hono SSR。
 * 
 * 用法:
 *   import { icon, icons } from '#icons'
 *   c.html(`<span class="icon">${icon('music')}</span>`)
 *   // 或直接解构: ${icons.Music}
 * 
 * 图标列表: https://lucide.dev/icons
 */

import * as lucide from 'lucide-static'

// 语义别名映射：项目内使用简短 key，映射到 lucide 图标名
const ALIAS_MAP = {
  // 品牌/音乐
  music:       'Music',
  music2:      'Music3',
  music3:      'Music4',

  // 导航/仪表盘
  dashboard:   'BarChart3',
  link:        'Link',
  docs:        'BookOpen',
  api:         'Zap',

  // 数据/表格
  list:        'ClipboardList',
  table:       'Table2',
  send:        'Send',

  // 状态
  success:     'CheckCircle2',
  error:       'XCircle',
  check:       'Check',
  xmark:       'X',

  // 安全/认证
  lock:        'Lock',
  lockKey:     'LockKeyhole',
  key:         'Key',
  shield:      'Shield',

  // 用户
  user:        'User',
  users:       'Users',
  eye:         'Eye',

  // 操作
  settings:    'Settings',
  trash:       'Trash2',
  bell:        'Bell',
  cookie:      'Cookie',
  test:        'FlaskConical',
  radio:       'Radio',
  download:    'Download',
  search:      'Search',
  warning:     'AlertTriangle',
  ban:         'Ban',
  help:        'CircleHelp',
}

/**
 * 根据别名获取 SVG 图标字符串
 * @param {'music'|'dashboard'|'link'|...} name - 图标别名
 * @param {string} [className=''] - 额外 CSS 类名
 * @returns {string} SVG HTML 字符串
 */
export function icon(name, className = '') {
  const lucideName = ALIAS_MAP[name]
  if (!lucideName || !lucide[lucideName]) {
    console.warn(`[Icons] 未知图标: ${name}`)
    return ''
  }
  const svg = lucide[lucideName]
  const classAttr = className ? `icon ${className}` : 'icon'
  return svg
    .replace(/class="[^"]*"/, `class="${classAttr}"`)
    .replace(/\s+/g, ' ')
    .trim()
}

/** 直接导出全部 lucide 原始图标，供高级用法 */
export const icons = lucide

/** 别名映射表，供外部参考 */
export const aliasMap = ALIAS_MAP

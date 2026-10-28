/**
 * 能力矩阵
 *
 * 首页和 AI 提示词里的「哪些 server 支持哪些 type」不再手写，
 * 而是每次请求时从 providers 的 `support_type` 读取。
 * 以后给某个 provider 增加类型（例如 album），页面与提示词会自动跟上。
 */

import Providers from '../../providers/index.js'

/** 矩阵行的展示顺序；即使某个类型当前无人支持，也保留一行并显示 ❌ */
const TYPE_ORDER = ['song', 'playlist', 'album', 'artist', 'search', 'url', 'lrc', 'pic']

/** 列的展示顺序与中文名；未列出的 provider 会追加到末尾 */
const PROVIDER_ORDER = ['netease', 'tencent', 'kugou', 'baidu', 'kuwo']
const PROVIDER_LABELS = {
    netease: '网易云音乐',
    tencent: 'QQ 音乐',
    kugou: '酷狗音乐',
    baidu: '百度音乐',
    kuwo: '酷我音乐',
}

/**
 * 读取当前实例支持的能力。
 *
 * @returns {{
 *   servers: string[],
 *   columns: Array<{ id: string, label: string, types: string[], status: 'ok'|'down', note: string }>,
 *   rows: Array<{ type: string, cells: Array<{ provider: string, label: string, supported: boolean }> }>,
 *   degraded: Array<{ id: string, label: string, note: string }>,
 *   supports: (server: string, type: string) => boolean
 * }}
 */
export function readCapabilities() {
    const providers = new Providers()
    const registered = providers.get_provider_list()
    const ordered = [
        ...PROVIDER_ORDER.filter(id => registered.includes(id)),
        ...registered.filter(id => !PROVIDER_ORDER.includes(id)),
    ]

    const columns = ordered.map(id => {
        const provider = providers.get(id)
        const support = provider?.support_type
        const types = Array.isArray(support) ? support.filter(type => typeof type === 'string') : []
        return {
            id,
            label: PROVIDER_LABELS[id] || id,
            types,
            // 平台状态来自 provider 自己（见 providers/index.js），只用于提示，不影响路由
            status: provider?.status === 'down' ? 'down' : 'ok',
            note: provider?.statusNote || '',
        }
    })

    const supported = new Set(columns.flatMap(column => column.types))
    const types = [...TYPE_ORDER, ...[...supported].filter(type => !TYPE_ORDER.includes(type))]

    const rows = types.map(type => ({
        type,
        cells: columns.map(column => ({
            provider: column.id,
            label: column.label,
            supported: column.types.includes(type),
        })),
    }))

    return {
        servers: columns.map(column => column.id),
        columns,
        rows,
        degraded: columns
            .filter(column => column.status !== 'ok' || column.note)
            .map(column => ({ id: column.id, label: column.label, note: column.note, status: column.status })),
        supports: (server, type) => columns.some(
            column => column.id === server && column.types.includes(type)
        ),
    }
}

export default readCapabilities

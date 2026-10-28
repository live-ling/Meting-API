/**
 * /api/capabilities —— 对外公开的能力矩阵接口。
 *
 * 之前「哪些平台支持哪些 type」只有服务端读得到（src/pages/home/capabilities.js），
 * 首页与 AI 提示词在 SSR 时直接读它；React 版试听页需要同一份数据，
 * 所以补一个只读接口，前端运行时拉取：以后给某个 provider 增加类型，
 * 页面与提示词会自动跟上，不用维护第二份硬编码清单。
 *
 * 同时把「可用的示例组合」（src/example.js 里 show:true 的条目）一起返回，
 * 试听页的预设列表直接用它。
 */
import { readCapabilities } from '../pages/home/capabilities.js'
import example from '../example.js'

/** 试听页能返回曲目列表的类型（url / lrc / pic 只返回单值，不进队列） */
const LIST_TYPES = ['song', 'playlist', 'album', 'artist', 'search']

export const capabilitiesHandler = (c) => {
    const capabilities = readCapabilities()

    const presets = Object.entries(example).flatMap(([provider, items]) =>
        Object.entries(items)
            .filter(([type, item]) => item?.show && LIST_TYPES.includes(type))
            .map(([type, item]) => ({ provider, type, id: String(item.value) })))

    return c.json({
        success: true,
        data: {
            // 每个平台的展示名、支持的类型、当前状态（ok / down）与说明
            columns: capabilities.columns.map(column => ({
                id: column.id,
                label: column.label,
                types: column.types,
                status: column.status,
                note: column.note,
            })),
            // 全部类型（含当前无人支持的），前端按此顺序展示
            types: capabilities.rows.map(row => row.type),
            // 可直接载入的示例组合
            presets,
        },
    })
}

export default capabilitiesHandler

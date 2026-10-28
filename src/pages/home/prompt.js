/**
 * 「给 AI 的集成提示词」
 *
 * 提示词里的基础地址、server × type 矩阵、示例 id 全部来自运行时：
 *   - 基础地址：get_url(c)（由 home-page.js 传入）
 *   - 能力矩阵：providers 的 support_type（由 capabilities.js 传入）
 *   - 示例 id：example.js（与 `/test` 页面共用同一份示例数据）
 *
 * 目标：把这份提示词单独交给一个 AI，它不回问、不查外部文档也能一次接对。
 * 所以这里同时写清「接口事实」「真实响应样例」「运行时规则」「验收清单」四块。
 */

import example from '../../example.js'

/** 例子里优先挑这几个类型，挑不到再往后找 */
const SAMPLE_TYPE_ORDER = ['song', 'playlist', 'artist', 'search', 'lrc', 'url', 'pic']

const pickSample = (capabilities) => {
    for (const column of capabilities.columns) {
        const samples = example?.[column.id] || {}
        for (const type of SAMPLE_TYPE_ORDER) {
            const value = samples[type]?.value
            if (value && column.types.includes(type)) {
                return { server: column.id, type, id: value }
            }
        }
    }
    return null
}

/** markdown 形式的支持矩阵，行顺序与页面表格一致 */
const matrixTable = ({ columns, rows }) => {
    const head = `| type | ${columns.map(column => column.id).join(' | ')} |`
    const divider = `| --- | ${columns.map(() => '---').join(' | ')} |`
    const body = rows.map(row => {
        const marks = row.cells.map(cell => (cell.supported ? '✅' : '❌'))
        return `| ${row.type} | ${marks.join(' | ')} |`
    })
    return [head, divider, ...body].join('\n')
}

/**
 * 生成可直接粘贴给 AI 的集成提示词。
 *
 * @param {{ base: string, capabilities: object }} input  base 为当前请求的站点根地址
 */
export function buildPrompt({ base, capabilities }) {
    const { columns, rows } = capabilities
    const sample = pickSample(capabilities)
    const perProvider = columns
        .map(column => {
            const types = rows
                .filter(row => row.cells.some(cell => cell.provider === column.id && cell.supported))
                .map(row => row.type)
            const status = column.status === 'down' ? '（上游当前不可用）' : ''
            return `- ${column.id}（${column.label}）${status}：${types.join('、') || '无'}`
        })
        .join('\n')
    const sampleLine = sample
        ? `GET ${base}/api?server=${sample.server}&type=${sample.type}&id=${sample.id}`
        : `GET ${base}/api?server=${columns[0]?.id || 'netease'}&type=song&id=…`

    return `# 角色
你是资深前端工程师。任务是在一个已有 Web 项目里接入 Meting-API 音乐接口。
只使用本文档给出的事实；不要臆造接口、参数、字段、错误码，也不要补充「通常会有的」接口。

# 交付物
1. 一个模块文件（如 meting.js），导出：searchSongs(keyword)、getPlaylist(id)、getSong(id)、getLrc(id)、getAudioUrl(id)、getCover(id)。
2. 一个最小可用界面：搜索框 → 结果列表 → 点击播放（封面、标题、歌手、进度、歌词）。
3. 加载中 / 空结果 / 出错 三种状态，其中 429 要显示冷却倒计时。
4. 不新增后端服务；如果确实需要跨域代理，在答案里说明原因并给出一行代理配置。

# 接口事实
- 基础地址：${base}
- 唯一入口：GET ${base}/api?server={server}&type={type}&id={id}
- 三个参数都可以省略；省略时服务端默认 server=tencent、type=playlist、id=7326220405
- 参数值必须用 encodeURIComponent 编码，不要手拼未编码的 id
- server 可选值与当前支持：
${perProvider}
- 支持矩阵（✅ 可用 / ❌ 服务端返回 400）：
${matrixTable({ columns, rows })}
- type 语义：
  · song / playlist / album / artist / search → JSON 数组，顺序与请求的 id 顺序一致
  · lrc → text/plain 歌词
  · url → 302 跳转到音频文件
  · pic → 302 跳转到封面图片
- id 规则：type=search 时 id 是关键词（中文可以，长度 ≤256）；
  其他类型只允许字母、数字、下划线、逗号、连字符（长度 ≤256）。
- 不同平台的 id 互不通用（网易云是数字串，酷狗是 32 位 hash），换 server 必须同时换 id。
- search 的返回同样是歌曲数组，字段与其他列表类型一致。
- 响应头 X-Cache: HIT / MISS 只用于调试，不影响数据。

# 真实请求与响应
1) 歌单
   GET ${base}/api?server=netease&type=playlist&id=2877205781
   200 application/json
   [{"title":"海阔天空","author":"Beyond",
     "url":"${base}/api?server=netease&type=url&id=347230",
     "pic":"${base}/api?server=netease&type=pic&id=347230",
     "lrc":"${base}/api?server=netease&type=lrc&id=347230"}]
2) 歌词
   GET ${base}/api?server=netease&type=lrc&id=347230
   200 text/plain
   [00:00.00]作词 : 刘卓辉
   [00:12.34]今天我 寒夜里看雪飘过
   解析规则：行首 [mm:ss.xx]（毫秒 1~3 位）；一行可能带多个时间戳，拆成多行；
   [offset:±N] 是整体偏移（毫秒），要累加到每行时间上；没有时间戳的行是纯文本歌词。
3) 音频
   GET ${base}/api?server=netease&type=url&id=347230
   GET ${base}/api?server=netease&type=url&id=347230&quality=lossless
   302，Location: https://…mp3 或 .flac
   可选 quality：standard(128) / higher(192) / exhigh(320) / lossless / hires / jymaster，默认 standard。
   实际音质受平台、会员权限和曲库限制，请求高音质也可能回落到较低音质；完全无直链时 404。
   直接把这条 API 链接写进 <audio src> 即可，浏览器会自动跟随跳转。
4) 封面
   GET ${base}/api?server=netease&type=pic&id=347230
   302，Location: https://…jpg
5) 错误响应
   400 {"status":400,"message":"server 参数不合法","param":{"server":"…","type":"…","id":"…"}}
   404 {"error":"no url"} 或 {"error":"no pic"}
   403 非浏览器客户端被拒（UA 拦截）
   429 带 Retry-After 响应头（秒数或 HTTP 日期）
   500 {"error":"internal server error"}
   502 {"error":"upstream unavailable","message":"…"} 上游故障

# 字段规范化
- title / author / url / pic / lrc 可能是字符串，也可能是字符串数组：
  统一用 toText(v) = Array.isArray(v) ? v.join(' / ') : (v ?? '')，不要把数组直接塞进文案。
- url / pic / lrc 可能是本 API 的链接、http(s) 外链，或以 @ 开头的内联内容：
  · @ 开头 = 内联内容（歌词）：去掉 @ 后按 LRC 解析，绝不能当 URL 用
  · 其他情况按 URL 处理；不是 http(s) 的相对值要和基础地址拼接
- 不要假设数组非空、字段一定存在、字段类型固定。

# 运行时规则（必须实现）
1. 按需请求：页面初始化不发请求，用户操作后再发。
2. 串行队列：同一时刻只允许一个在途请求；两次请求开始时间间隔 ≥1500ms；
   相同 server+type+id 去重并缓存（LRU，最多 32 条；单条响应 >2MB 不缓存）。
3. 429：读 Retry-After 进入冷却，期间禁用按钮并显示剩余秒数；
   到期后由用户手动重试，禁止自动重试或定时轮询。
4. 解析防御：先判断 response.ok；JSON 用 Array.isArray 校验；文本用 textContent 注入；
   媒体地址只接受 https?: 协议。
5. 播放：全页只有一个 <audio preload="none">；点击后才设置 src；
   切歌不自动播放；播放结束后不自动下一首；播放出错就停止并提示，不重试。
6. 跨域：本接口不保证 CORS。若页面与 API 不同源且浏览器直连失败，
   改用同源代理（/api/* → ${base}/api/*），并在答案里说明这一点。

# 验收清单（输出前逐条自检）
- [ ] 首屏没有任何网络请求
- [ ] 快速连点不会并发请求，两次请求间隔 ≥1.5 秒
- [ ] 429 冷却期间按钮禁用并显示倒计时，不自动重试
- [ ] 空数组显示空状态而不是报错
- [ ] lrc 用 response.text() 解析，JSON 接口用 response.json()
- [ ] 全页只有一个 audio，切歌不自动播放
- [ ] 所有文本都通过 textContent 注入

# 输出要求
先列文件清单和 3–5 条关键决策，再给完整代码；不要留 TODO；
不要使用本文档未列出的参数、字段或错误码。
示例请求：${sampleLine}`
}

export default buildPrompt

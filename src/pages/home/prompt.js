/**
 * 「给 AI 的集成提示词」
 *
 * 提示词里的基础地址、server × type 矩阵、示例 id 全部来自运行时：
 *   - 基础地址：get_url(c)（由 home-page.js 传入）
 *   - 能力矩阵：providers 的 support_type（由 capabilities.js 传入）
 *   - 示例 id：example.js（与 `/test` 页面共用同一份示例数据）
 *
 * 目标：把这份提示词单独交给一个 AI，它不回问、不查外部文档也能一次接对。
 *
 * v2（2026-11-17）三处结构性调整：
 *   1. 不预设技术栈与目录：新增「先勘察再动手」，文件放哪、用什么框架由目标仓库决定；
 *   2. 把「只能猜」的契约写成唯一解（返回值语义、默认 server、quality 落点、2MB 判定、
 *      无 id 字段、302 不是错误），每条都写了理由；
 *   3. 验收拆成「可自动自证 / 必须人工确认」两栏，禁止 AI 声称验证过它做不到的事。
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
你是资深前端工程师。任务是把 Meting-API 音乐接口接入「这个仓库里现有的项目」，不是新建一个独立 demo。
只使用本文档给出的事实；不要臆造接口、参数、字段、错误码，也不要补充「通常会有的」接口。
本文只约束「接口怎么用」和「必须满足的行为」，不约束技术栈、目录、文件数——那些由仓库决定。

# 0. 先勘察，再动手（本文故意不写死文件名和目录）
不要因为看到"模块文件""界面"就去新建 meting.js / app.js / index.html。先读项目，再决定接入点：
1. 判断框架与模块格式：package.json、锁文件、vite.config.*、next.config.*、nuxt.config.*、webpack.*、astro.config.*、tsconfig.json。
   结论写成一句：这是什么框架、ESM 还是 CJS、JS 还是 TS、有没有构建步骤。
2. 找现有的请求层：src/api、src/services、src/utils/request、axios 实例、已有的 fetch 封装、错误处理约定。
3. 找现有的状态与 UI：store（pinia/redux/zustand）、hooks/composables、组件库、样式方案（Tailwind/CSS Modules/SCSS/设计 token）、
   项目里既有的「加载中 / 空 / 错误」三种态是怎么写的。
4. 找现成的播放能力：是否已有 <audio>、是否已经在用 MetingJS 或别的播放器库、是否有全局 player store。
5. 先输出「接入点清单」再写代码：新增/修改哪些文件、放在哪个目录、复用了哪些既有封装、为什么这样放符合本项目约定。
   项目没有约定的地方，明确写出你的默认选择及理由。
6. 若仓库里已有旧的 Meting 接入（MetingJS / APlayer / 自研播放器），按这三条行为变化先核对一遍，能过就不要动它：
   · type=url 拿不到直链现在是 404（更早的版本会 302 到一个必然失败的假地址）→ 播放器必须有失败态；
   · 非 search 的 id 不再允许空白字符（配置里写成 "347230, 347231" 会 400）→ 去掉逗号后的空格；
   · 上游下线的平台（baidu / kuwo）稳定返回 502，且错误码从统一的 500 细分成 404 / 400 / 502。

硬约束：
- 跟随项目既有格式与命名；类型、导出方式、目录层级都以现有文件为准。
- 不新增依赖、不新增后端服务、不新增构建步骤；能复用现有封装就不要另写一套。
- 视觉与交互复用既有体系（组件库/设计 token/既有空态错误态写法），不要另起一套设计语言。
- 最小 diff：只改必要文件，不重排无关代码；改既有文件时保持其原有风格。
- 若项目已经在用 MetingJS 一类库：先判断能否零改动继续用（本接口向后兼容它的调用方式），再决定是否替换成自研模块。

# 1. 接口事实（照抄，不用猜）
- 基础地址：${base}
- 唯一入口：GET ${base}/api?server={server}&type={type}&id={id}（可选 &quality=，见「3) 音频」）
- 三个参数都可以省略；省略时服务端默认 server=tencent、type=playlist、id=7326220405
- 参数值必须用 encodeURIComponent 编码，不要手拼未编码的 id
- server 可选值与当前支持：
${perProvider}
- 支持矩阵（✅ 可用 / ❌ 服务端返回 400）：
${matrixTable({ columns, rows })}
- type 语义：
  · song / playlist / album / artist / search → JSON 数组，顺序与请求的 id 顺序一致
  · lrc → text/plain 歌词
  · url → 302 跳转到音频文件（可加 quality 选音质，见下文「3) 音频」）
  · pic → 302 跳转到封面图片
- id 规则：type=search 时 id 是关键词（中文可以，长度 ≤256），
  也接受 keyword= 作为别名（两者并存时 id 优先）；limit= 不支持，固定返回 30 条。
  其他类型只允许字母、数字、下划线、逗号、连字符（长度 ≤256）。
  实测过的两条硬校验（提前在本地拦住，能省一次 400 往返）：
  · 关键词含 < > { } \\ 或控制字符 → 400 "id 参数包含非法字符"
  · 非 search 的 id 含空白字符（包括「逗号后加空格」）→ 400 "id 参数包含非法字符"
  · search 缺省/空关键词 → 400（id= 或 keyword= 传一个即可；空关键词不会回随机结果）
  · 逗号多 id 仅 type=song 支持；playlist/url/lrc/pic 带逗号 → 400
- 不同平台的 id 互不通用（网易云是数字串，酷狗是 32 位 hash），换 server 必须同时换 id。
- search 的返回同样是歌曲数组，字段与其他列表类型一致。
- 响应头 X-Cache: HIT / MISS 只用于调试，不影响数据。
- 未知的 query 参数（历史上 MetingJS 会带 auth、r）会被忽略，不影响响应。
- 限流事实（写客户端时必须遵守，不是建议）：
  · /api 全局限流 60 次/分钟/IP，type=search 另有 300 次/日配额；
  · type=url 有「成功配额」：每 60 秒最多 20 首【不同】歌曲能解析出直链（302），
    同一首歌重复播放/重试不重复计数——正常听歌（间隔 ≥3 分钟）永远碰不到线，
    只有「短时间批量解析大量不同 id」会撞 429；
  · 一次加载 N 首歌 ≈ N×3 次请求（url+lrc+pic），12 首就逼近限流一半；
  · 所以禁止「整批预取所有歌的直链」：url 只在该曲即将播放前请求，lrc/pic 同理按需；
  · 任何请求失败都不要立刻整批重排重试——这正是线上 429 的最大来源。

# 2. 契约：这几条只能照写，不要用「通常做法」
1) getAudioUrl(id, { quality }) 与 getCover(id) 返回的是**本 API 的链接字符串**（同步返回，不发请求）。
   不要 fetch 去跟随 302，三个理由：
   · 多一次请求要占 1.5 秒的间隔配额；
   · fetch(redirect:'manual') 时 302 的 response.ok 是 false，沿用 !res.ok 判断会把正常跳转当失败；
   · fetch(follow) 拿到的是有时效的直链（服务端 url 缓存只有 10 分钟），缓存下来会过期。
   把链接直接给 <audio src> / <img src>，浏览器自己跟随跳转。
2) 六个函数统一默认 server=netease，并且**总是显式传 server**。
   原因：省略时服务端默认 tencent，而 tencent 不支持 search，搜索框一旦默认 tencent 就必 400。
3) quality 只作为 getAudioUrl 的可选第二参（表外值在本地直接抛错，不要发出去）。列表接口不要传 quality。
4) 缓存键 = server + type + id + quality；单条响应 >2MB 不缓存。
   JSON 用 response.json() 取到对象后已经没有字节数了，所以体积判定用 content-length 响应头；取不到就不缓存。
5) 响应对象**没有 id 字段**。播放与歌词只能沿用返回的 url / pic / lrc 字段，不要试图从结果反推 id。
6) lrc 字段可能是完整的 http(s) 链接：直接请求它，不要拆出 id 再重新拼。
7) 302 不是错误，404 也不代表「接口挂了」：
   · type=url / pic 的 302 是正常成功；
   · 404 {"error":"no url"} = 这首歌没有直链，按「这首不可播」提示即可，不要整体报错、不要重试。
8) 歌单返回几十首时，只把 url 字段当「链接模板」存着，不要循环 fetch 全部解析直链：
   播放到第 N 首才请求第 N 首的 type=url；列表渲染只用 title/author/pic/lrc，
   pic 交给 <img src> 让浏览器懒加载（loading="lazy"），不主动 fetch。

# 3. 真实请求与响应
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
   解析规则：行首 [mm:ss.xx]（毫秒 1~3 位，按标准 LRC 左补零：.34 记 340ms、.5 记 500ms）；
   一行可能带多个时间戳，拆成多行；[offset:±N] 是整体偏移（毫秒），要累加到每行时间上；
   没有时间戳的行是纯文本歌词（界面上按原顺序附在定时行之后，别丢）。
3) 音频
   GET ${base}/api?server=netease&type=url&id=347230
   GET ${base}/api?server=netease&type=url&id=347230&quality=lossless
   302，Location: https://…mp3 或 .flac
   可选 quality（默认 standard，只对 type=url 生效）：
     standard  128 kbps MP3            · QQ 音乐 M500
     higher    192 kbps MP3            · QQ 音乐 M800（QQ 无 192k 档，直接给 320k）
     exhigh    320 kbps MP3            · QQ 音乐 M800
     lossless  FLAC 无损               · QQ 音乐 F000
     hires     FLAC 24 bit / 48 kHz 起 · QQ 音乐 F000（不高于无损）
     jyeffect  高清环绕声（空间音频）   · QQ 音乐不支持，回落 128 kbps
     sky       沉浸环绕声（空间音频）   · QQ 音乐不支持，回落 128 kbps
     jymaster  超清母带                · QQ 音乐 F000（不高于无损）
   简写也认：128 / 128k / std、192 / 192k、320 / 320k / hq、flac / sq、
   hi-res / hi_res / hr、effect、master。
   传了表外的值直接 400（响应里会列出可选值）；没权限时上游静默回落到较低档，不报错：
   实际档位看响应头 X-Audio-Quality-Actual，码率看 X-Audio-Bitrate；完全无直链时 404。
   酷狗 / 百度 / 酷我 目前忽略 quality。
   直接把这条 API 链接写进 <audio src> 即可，浏览器会自动跟随跳转。
4) 封面
   GET ${base}/api?server=netease&type=pic&id=347230
   302，Location: https://…jpg
   封面地址可能是 http（在 https 页面会被浏览器按混合内容拦掉）：给 <img> 挂 onerror，回退到占位图，不要影响播放。
5) 错误响应
   400 {"status":400,"message":"server 参数不合法","param":{"server":"…","type":"…","id":"…"}}
   404 {"error":"no url"} 或 {"error":"no pic"}
   403 被 UA 拦截规则拒绝（浏览器无法修改 User-Agent，遇到就如实提示，不要尝试改头）
   429 带 Retry-After 响应头（秒数或 HTTP 日期）：出现即说明节奏超限，
   正确响应是「停 + 等 Retry-After」，错误响应是「重排队列立刻再来」——
   后者会被限流持续压制，且累计违规可能被封禁 1 小时。
   500 {"error":"internal server error"}
   502 {"error":"upstream unavailable","message":"…"} 上游故障
   同一条规则适用于所有 server：上游下线的平台（如 baidu / kuwo）会稳定返回 502，不是你的代码问题。

# 4. 字段规范化
- title / author / url / pic / lrc 可能是字符串，也可能是字符串数组：
  统一用 toText(v) = Array.isArray(v) ? v.join(' / ') : (v ?? '')，不要把数组直接塞进文案。
- url / pic / lrc 可能是本 API 的链接、http(s) 外链，或以 @ 开头的内联内容：
  · @ 开头 = 内联内容，绝不是 URL：lrc 字段去掉 @ 后按 LRC 解析；
    url / pic 字段出现 @ 一律视为不可用（new URL('@…', base) 会拼出一个「合法」的错误地址，必须显式拦住）
  · 其他情况按 URL 处理；不是 http(s) 的相对值要和基础地址拼接
  · 交给 <audio>/<img> 之前，只放行 http: 和 https:
- 不要假设数组非空、字段一定存在、字段类型固定。

# 5. 运行时规则（必须实现）
1. 按需请求：页面初始化不发请求，用户操作后再发。
2. 串行队列：同一时刻只允许一个在途请求；两次请求开始时间间隔 ≥1500ms；
   相同 server+type+id+quality 去重并缓存（LRU，最多 32 条；单条响应 >2MB 不缓存）；
   禁止启动时预解析整个歌单的直链。
3. 429：读 Retry-After 进入冷却，期间禁用触发请求的控件并显示倒计时；
   到期后由用户手动重试，禁止自动重试或定时轮询。
   Retry-After 可能是秒数、HTTP 日期，也可能是「距次日零点的秒数」（最长约 86400），
   倒计时按 hh:mm:ss 显示，别直接打印「还需 86213 秒」。
4. 解析防御：先判断 response.ok；JSON 用 Array.isArray 校验；文本用 textContent 注入；
   媒体地址只接受 https?: 协议。
5. 播放：全页只有一个 <audio preload="none">；点击后才设置 src；
   点列表项 = 载入（不自动播放），播放键 = 播放；播放结束后不自动下一首；
   播放出错就停止并提示，不重试。
6. 跨域：先实测一次响应的 Access-Control-Allow-Origin（本服务通常回 *，此时不需要代理）。
   若确实被拦，用**项目现有 dev server** 的 proxy 配置解决（Vite server.proxy / webpack devServer.proxy / Next rewrites），
   不要新增独立服务；在答案里给出那一行配置和原因。

# 6. 自验：没有浏览器也要拿得出证据
- 语法/类型：node --check、项目自带的 lint 或 tsc。
- 把 fetch 打桩写单测（不要联网），至少断言：
  3 次调用开始时间间隔 ≥1490ms；同 key 并发只发 1 次；重复请求命中缓存不再发；
  429 之后冷却期内零请求；非数组 JSON 抛错；LRC 的多时间戳/offset/毫秒补零解析正确。
- 真接口探针（可选，1~2 条，注意 ≥1.5s 间隔）：核对 200 的 JSON 形状、type=url 的 302、错误体形状。
- 以下三条无法在无浏览器环境自证，**不要声称已验证**，只能标注「需人工在 DevTools 确认」：
  首屏零请求、冷却期按钮禁用与倒计时、切歌不自动播放。

# 7. 验收清单（输出前逐条自检）
- [ ] 接入点复用了项目既有的请求层/组件/样式，而不是另起一套
- [ ] 没有新增依赖、没有新增后端服务
- [ ] 首屏没有任何网络请求
- [ ] 快速连点不会并发请求，两次请求间隔 ≥1.5 秒
- [ ] 429 冷却期间控件禁用并显示倒计时，不自动重试
- [ ] 空数组显示空状态而不是报错；404 单曲只提示该曲不可播
- [ ] lrc 用 response.text() 解析，JSON 接口用 response.json()
- [ ] 全页只有一个 audio，切歌不自动播放
- [ ] 所有文本都通过 textContent 注入

# 8. 输出要求
先给「接入点清单 + 3~5 条关键决策（含你为本项目做的适配）」，再给完整代码或可直接应用的 diff；
不要留 TODO；不要使用本文未列出的参数、字段或错误码；改完说明哪些验收项是自动验证的、哪些需要人工看。
示例请求：${sampleLine}`
}

export default buildPrompt

# Changelog

本项目的所有重要变更都记录在这里。

## [Unreleased] - 2026-10-29

### 调整：API 日志上限与存储格式

- 日志上限 `MAX_LOGS` 从 5000 提到 40000（按约 1000 请求/天算覆盖 30 天有余量），
  避免日志被过早滚动丢弃。
- 保存改为紧凑序列化（去掉缩进），单条约 385 字节，4 万条约 14.7 MB；
  当前文件从 254KB 降到 201KB（省约 21%）。
- 重启服务生效；加载本就取尾部 `slice(-MAX_LOGS)`，旧数据无缝衔接。

### 新增：试听页首屏自动加载、连播与状态精简

- `/test` 首屏自动加载默认数据源（网易云歌单 `2877205781`），无需手动点「加载示例」；
  换源 / 重载会先停掉当前播放，并重置封面、歌词和曲目列表。
- 新增连播：非最后一首播完自动切下一首，最后一首播完停在当前曲，由用户手动处理。
- 429 冷却不再使用顶部常驻状态条，只写工作台状态；冷却到期仍需手动重试，不自动重试。
- 预设平台不可用时提示「不可用」，不再静默沿用上一个平台。
- 工作台根元素新增 `data-server-label` / `data-type-label`，展示名跟随选中项刷新。
- 新增假 DOM `test/support/test-page-dom.js`，以及 `test/test-page-client.test.js`
  （6 条）和 `test/test-page-render.test.js`（6 条）固化上述行为。

### 修复：客户端 IP 解析防伪与 unknown 配额

- 修复 `X-Forwarded-For` 可被伪造的问题：不再直接取链首，而是从左往右跳过内网/保留
  地址和受信代理网段（CDN 出口），取第一个公网地址；链上全是内网/受信地址时按
  `unknown` 处理。此前攻击者伪造 `192.168.x.x` 即可让风控计数、封禁和地理统计全部
  记到内网地址上，真实来源隐身。
- 无法归因的 `unknown` 来源不再参与 QPS 计数与封禁，避免一个伪造内网头的攻击者连带
  封掉所有来源不明的本地用户；但 search 接口走全局共享日配额
  （`quota.unknownSharedDailyLimit`，默认 200 次/日），刷接口的攻击者会自己耗尽共享池。
- `src/service/api-logger.js` 改为复用同一套 IP 解析，日志统计与风控看到的是同一个身份。
- 新增 `test/unknown-quota-smoke.mjs` 冒烟脚本（手工运行），覆盖共享配额、公网解析、
  非 search 放行与页面访问。

### 修复：图例显隐、CSV 导出认证与来源跳转

- 仪表盘折线图与请求类型饼图的图例改为可点击按钮：点击切换对应系列显示/隐藏，
  隐藏后饼图按剩余项重算占比、中心显示可见总数与最大项占比；全部隐藏时给出提示，
  图例变灰可随时恢复。切范围/刷新不会丢失显隐状态。
- 饼图显示优化：中心显示「可见调用数 + 范围 + 最大类型占比」，最大类型加「最多」标签，
  悬停同时给出占可见与占全部的比例。
- 修复 API 调用日志导出 CSV 返回 `{"success":false,"error":"未提供认证信息"}`：
  原实现用 `window.open` 让浏览器发导航请求，不会携带 `X-Auth-*` 头；改为
  fetch（带头）→ blob → `a.download` 触发保存，失败时在页面内提示。
- 修复来源详情模态框「在 API 日志中查看」跳转：改为手动切换视图并 `await loadApiLogs(1)`
  后再 `scrollIntoView` 滚动到日志列表，避免经过 `switchSection` 重复加载来源统计、
  也确保数据到位后再定位。
- 测试：`test/admin-ui.test.js` 17 条（新增图例显隐、fetch 导出、跳转滚动断言）；
  全套 **14 个文件 / 145 条**通过。

### 新增：API 日志按 IP 折叠、归属地展示与多通道查询

- API 调用日志默认按 IP 折叠成一行，显示最近调用、归属地、平台、类型、请求数、
  状态码、平均耗时和最新请求；点击行展开该 IP 的调用详情，详情支持「加载更多」。
- 调用列表的每一项改为独立的圆角卡片（含展开后的详情面板），行与行之间留出间距，
  不再是紧贴的表格条纹。
- 详情表新增「归属地」列，位置在类型与请求 ID 之间；归属地同时显示地区、运营商和
  来源通道（ShowAPI / ipwho.is / ipapi.co / ip.sb）。
- 旧日志没有归属地时，打开日志页会后台补查，前端静默轮询几次后自动补上，不再只是
  一串没有地区信息的 IP。
- IP 归属地从「ShowAPI + 硬编码 ipwho.is 回退」改为可配置的多通道路由：
  `src/service/geo-providers.js` 注册通道，设置页可单独启用/停用、上移/下移顺序、
  填写密钥、逐通道测试；查询时按顺序尝试，失败或不支持当前 IP 时自动切下一个。
- 默认仍为 ShowAPI 主通道 + ipwho.is 备用，ipapi.co / ip.sb 默认关闭但可手动启用；
  旧配置 `geoApiKey` 会自动迁移到 ShowAPI 通道，无需重新填写。
- 新增管理员接口字段：`GET/PUT /admin/geo` 返回通道列表，`POST /admin/geo/test`
  支持 `provider`（通道 id 或 `all`）；`GET /admin/api-logs?group=ip` 返回聚合结果，
  `ipExact` 用于展开单个 IP 的详情。
- CSV 导出新增「归属地」「归属地来源」两列。
- 新增 `test/geo-channels.test.js`（10 条）覆盖通道默认值、排序/持久化、接口返回、
  分组分页、`ipExact` 与归属地落库；`test/geo-display.test.js` 增加 5 条多通道与回退用例。

### 优化：文档胶囊、缓存图表与通知样式

- IP 通道卡片的文档链接改为无下划线的胶囊标签，悬停时填充主色。
- 缓存设置的「运行统计」卡片新增两幅图：命中率环形图（命中/未命中 + 中心命中率）
  和分类型 TTL 横向条形图；跟随刷新/保存实时更新。
- 通知（toast）从纯色背景改为卡片式浅底 + 左侧状态色条 + 彩色图标，成功/失败只改变
  描边与图标颜色，不再整块大红大绿。
- 测试：`test/admin-ui.test.js` 15 条；全套 **14 个文件 / 143 条**通过。

### 优化：来源列表圆角、图表动画、通道测试回退与背景图 TTL=0

- 来源分析表格每行改为独立圆角卡片（`border-spacing` + 首尾格圆角），与 API 调用列表
  的视觉语言一致。
- 仪表盘折线图加入路径描边动画、面积淡入、数据点弹出和坐标淡入；饼图加入扇区渐显、
  中心数字淡入和图例错峰上浮；统一支持 `prefers-reduced-motion`。
- 修复 IP 归属地测试：单通道测试失败或缺密钥时，自动按配置顺序回退到备用通道，
  返回 `fallbackUsed` 和完整尝试记录；测试结果统一用 HTTP 200 返回，避免“备用通道可用
  但界面报错”；单通道测试超时缩短为 4 秒。
- 登录页背景图缓存时长允许填 **0**：表示永久缓存，接口地址不变时刷新/到期都不再自动
  换图；设置页校验、状态展示和后端 `isFresh()` 同步调整。
- 测试：`test/geo-display.test.js` 12 条、`test/login-bg.test.js` 10 条；
  全套 **14 个文件 / 141 条**通过。

### 调整：仪表盘范围、来源详情弹窗与日志聚合精简

- 仪表盘新增「数据范围」选择：近 24 小时 / 近 7 天 / 近 30 天。KPI、请求趋势、
  请求类型饼图和来源站点都跟随范围；趋势图自动切换小时 / 6 小时 / 天桶，
  坐标与悬停文案同步显示日期。
- 来源分析（Referer）详情从行内折叠改为**模态框**；点击任意来源行打开，
  弹窗保留平台/类型/地区/Host 分布、Top IP 和「在 API 日志中查看」。
- API 调用聚合行不再显示平台和类型，只保留归属地、请求数、状态码、耗时和最新请求；
  展开详情表也移除了归属地列，改为在详情顶部用大号标题展示地区、运营商和来源通道。
- IP 通道卡片：按钮统一右对齐；IPv4/IPv6 支持合并成一个徽标（`IPv4` 或
  `IPv4 / IPv6`）；需要密钥的通道改为「编辑密钥」按钮展开输入框。
- 新增范围统计接口：`GET /admin/api-logs/stats?hours=`、
  `GET /admin/api-logs/timeseries?hours=` 支持到 720 小时。
- 测试：`test/admin-ui.test.js` 13 条、`test/geo-channels.test.js` 14 条；
  全套 **14 个文件 / 139 条**通过。

### 新增：仪表盘图表与来源分析详情

- 仪表盘「近 24 小时请求」柱状图改为 SVG 折线图：总请求 / 成功 / 失败三条线，
  带面积渐变、网格、整点标签、悬停明细和峰值摘要。
- 「请求类型」改为 SVG 环形饼图：中心显示 24h 调用总数，右侧图例显示各类型
  调用数与占比；不再使用横向条形列表。
- 来源分析（Referer）支持点击行展开详情：平台 / 类型 / 地区 / Host 分布、
  Top IP（含归属地、成功/失败、最近访问）。每行可一键跳到 API 调用日志，
  按该来源筛选调用；日志筛选卡新增「来源站点」输入框。
- 来源分析新增「显示 10 / 30 / 100 / 200 个」选择，并显示来源总数与调用总数。
- 后端 `getRefererStats()` 现在会聚合每个来源的完整分布和 Top IP；
  `/admin/api-logs` 新增 `referer` 精确筛选（支持 `direct` / `invalid`）。
- 新增 `test/admin-ui.test.js` 图表/来源详情结构断言，`test/geo-channels.test.js`
  增加来源分布、Top IP 与 `refererSite` 筛选用例；全套 **14 个文件 / 137 条**通过。

### 新增：登录页 ACG 随机背景图（带服务端缓存）

- 登录页背景改为 [uapis.cn 随机图接口](https://uapis.cn/docs/api-reference/get-random-image)
  的 ACG 分类，默认地址 `https://uapis.cn/api/v1/random/image?category=acg`。
- 新增 [`src/admin/login-bg.js`](src/admin/login-bg.js)：服务端抓取并缓存图片，
  浏览器只请求同源的 `GET /admin/login-bg`。默认缓存 6 小时，图片与元信息落在
  `data/login-bg/`，**刷新登录页不会换图，重启后也能恢复**；抓取失败保留旧图。
- 设置页新增「登录页背景」卡片：开关、接口地址、缓存时长（1~168 小时）、
  预览、立即换一张、清除缓存。换接口地址会自动作废旧图。
- 新增管理员接口：`GET/PUT /admin/login-bg/settings`、
  `POST /admin/login-bg/refresh`、`POST /admin/login-bg/cache/clear`。
- 新增 `test/login-bg.test.js`（9 条），覆盖缓存命中、ETag 304、显式换图、
  过期回退旧图、无缓存失败返回 502、关闭后 404 与 URL 校验。

### 调整：设置页分类选项卡与侧栏

- 设置页从一张大网格拆成「账户 / 安全 / 集成与外观 / 缓存」四个选项卡，
  每个分类只放两张卡片，不再挤成长列。
- 侧栏收起按钮移到左栏底部（`sidebar-foot`），手机端仍由顶栏汉堡按钮打开抽屉。
- API 调用日志页面移除卡片里重复的「API 调用日志」标题，保留顶栏页面标题。
- 新增 `test/admin-ui.test.js`（6 条）固化选项卡分组、侧栏按钮位置与标题去重。

### 新增：/api 响应缓存后台配置

- 设置页新增「缓存」选项卡：开关、分类型 TTL（分钟）、最大条目、命中/淘汰统计、清空缓存。
- 新增 [`src/service/cache-config.js`](src/service/cache-config.js)：默认 TTL、边界与
  「后台 > 环境变量 > 内置默认」的解析逻辑；`CACHE_ENABLED=0` 仍是运维级总开关。
- [`src/service/api-cache.js`](src/service/api-cache.js) 改为读取后台配置；TTL 改动保存后自动清空旧缓存。
- 新增管理员接口：`GET/PUT /admin/cache`、`POST /admin/cache/clear`。
- 新增 `test/cache-config.test.js`（6 条）。

### 优化：IP 归属地与登录页预览

- 后台「测试 IP」留空时自动使用当前访问 IP：优先 `X-Forwarded-For` / `X-Real-IP`，
  本地/内网访问时回退 uapis myip 接口（10 分钟缓存）。新增 `GET /admin/geo/client-ip`。
- ShowAPI 返回的国家、省/市/区、运营商、大洲、城市编码、经纬度、英文名等字段全部保留；
  测试结果用字段网格展示，并可展开原始 JSON。
- ShowAPI 只支持 IPv4（IPv6 返回 `ret_code=-1`）。IPv6 与 ShowAPI 失败时自动回退
  [ipwho.is](https://ipwho.is/)（无需 key，字段为英文），API 日志的归属地查询同样生效。
- 登录页背景预览默认带上服务端渲染的 `src`，即使状态接口慢也不会先显示空白。
- 新增 `test/geo-display.test.js`（6 条，含 IPv6 与回退用例）。

### 修复：日志列表与长文本展示

- API 调用日志改为固定列宽，类型/请求 ID/歌曲信息超长时省略，鼠标悬停显示全文；
  扫描器塞进 `type` 的 SQL 片段不再撑高行或撑破页面。
- 操作日志、Cookie 监测历史增加分页（每页 20 条）。
- Top 活跃 IP 列表限高 320px 并内部滚动。
- 弹窗改为「头/体/脚」flex 布局，正文独立滚动，按钮不会再被长表单挤出视口。
- 仪表盘「请求类型」把非法 `type` 统一归入「其他」，不再显示 SQL 片段。
- 仪表盘近 24 小时柱状图加高到 210px（原 150px）。

## [1.4.3] - 2026-10-28

### 下线：网易云扫码登录入口

新版接口仍然被风控拦在最后一步（点击确认后返回 8821，与官网扫码的表现不一致），
短期内没有稳定的绕法，因此把入口隐藏，避免让人白试一次。

- 新增 [`src/admin/features.js`](src/admin/features.js) 的功能开关
  `neteaseQrLoginEnabled = false`，改回 `true` 即可恢复按钮、弹窗与接口调用。
- 「Cookie 列表」恢复为单个「添加 Cookie」按钮；空列表提示、帮助文案同步收敛。
- 扫码相关代码、接口与单测全部保留，未删除。
- **自动续签不受影响**：手动粘贴的 `MUSIC_U` 仍会每 12 小时尝试续期。

## [1.4.2] - 2026-10-28

### 修复：扫码确认后返回 8821（风控）

1.4.1 上线后实测状态是 `801 -> 802 -> 8821`，`8821` 是网易云对**旧扫码接口**的风控
（「请切换其他登录方式或升级新版本再试」），不是我们的解析问题。

- 改用新版桌面端接口：`interface.music.163.com/api/login/qrcode/unikey` 与
  `.../client/login`，明文表单 `type=3`（与 api-enhanced 4.41.1 一致）。
- 扫码请求不再伪造 `X-Real-IP` / `X-Forwarded-For`，用真实出口 IP；
  仍复用同一个 `_ntes_nuid`，并持续带上接口下发的 `NMTID`。
- `8821` / `-462` 现在返回明确失败提示，不再静默空转。

## [1.4.1] - 2026-10-28

### 修复：扫码已确认但一直停在 802

线上首次试用的现象是「能识别到已扫码，手机确认后后台没反应」。原因是二维码会话的
每次轮询都在换客户端身份：`request()` 每次生成新的 `_ntes_nuid`，并随机挑一个
国内 IP 塞进 `X-Real-IP`。网易云把「确认」结果绑定在建 key 的那个客户端上，
身份一变就可能永远拿不到 803。

- 扫码会话在创建时固定一份 `_ntes_nuid` 与出口 IP，并携带建 key 响应里的 Set-Cookie，
  后续所有轮询复用同一身份。
- `request()` 支持 `options.ip` 固定出口 IP；`_ntes_nuid` 只在缺省时随机生成。
- 停在 802 超过 8 秒后，补一次 `type=3` 查询（新版网页端用的类型），拿到 803 即采用。
- 803 的凭据除 `Set-Cookie` 外，也支持从响应体 `cookie` 字段解析。
- 轮询状态变化会打一行日志（只打状态码）；前端在二维码下方显示「上游状态码」，
  方便下次定位是卡在 802 还是 803 取不到 Cookie。

## [1.4.0] - 2026-10-28

### 新增：网易云扫码登录

后台「Cookie 列表」新增「网易云扫码登录」，用网易云音乐 App 扫一次码即可完成添加，
不再需要 F12 复制 Cookie。

- 新增 [`src/admin/netease-qr.js`](src/admin/netease-qr.js)：扫码会话管理。
  `unikey` 只存在服务端内存，浏览器只拿到 `sessionId` + 已渲染的二维码图片；
  会话绑定发起人、TTL 180 秒、一次性，803 成功后先 `validateCookie` 再入库。
- 新增 [`src/admin/netease-cookie.js`](src/admin/netease-cookie.js)：Set-Cookie 筛选
  （白名单 `MUSIC_U` / `__csrf` 等）与字段级合并，避免整串覆盖或把跟踪字段落盘。
- 新增三个接口（均需管理员）：
  `POST /admin/cookies/qr/netease/create`、`/check`、`/cancel`，
  统一 `Cache-Control: no-store`。
- 前端：`src/admin/page.js` 新增扫码弹窗，2 秒轮询 801/802/803，
  成功后自动刷新列表并提示昵称与 VIP 播放能力。

### 新增：网易云 Cookie 自动续签

- 新增 [`src/admin/netease-refresh.js`](src/admin/netease-refresh.js)：每 12 小时调用
  `/api/login/token/refresh`，把新的 `MUSIC_U` 合并回 `cookies.json`；
  新 Cookie 先校验，校验不过保留旧值，日志不打印 Cookie 内容。
- [`src/providers/netease/util.js`](src/providers/netease/util.js) 的 `request()` 新增
  `returnHeaders` 选项，用于读取 `Set-Cookie`；默认行为不变。

### 安全

- 扫码接口与 Cookie 的新增/修改/删除/验证接口收紧为管理员专属
  （此前任意登录用户都能写 Cookie）。只读列表保持原行为。
- 扫码轮询走 POST body，不把 `unikey` 放进 query，避免被 `logger()` 与 nginx access log 记录。

### 测试

- 新增 `test/netease-qr.test.js`（11 条）与 `test/netease-refresh.test.js`（7 条），
  `test/admin-auth.test.js` 补 3 条扫码接口权限用例。

## [1.3.0] - 2026-10-26

### 新增：补回原始项目的三个平台

原始项目（metowolf/Meting-API）支持 `netease` / `tencent` / `kugou` / `baidu` / `kuwo`，
本 fork 重写时只保留了前两个。本次按原始项目的方式补回后三个：

- 新增 [`src/providers/legacy/index.js`](src/providers/legacy/index.js)：基于 `@meting/core`
  （与原始项目同一个库、同一套上游接口）的统一 provider，负责
  `name/artist[]/url_id/pic_id/lyric_id` → `title/author/url/pic/lrc` 的映射，
  并懒加载该库（只有请求这三个平台时才 import）。
- `kugou` / `baidu` / `kuwo` 均注册全部 8 种 `type`：`song` / `album` / `playlist` /
  `artist` / `search` / `url` / `lrc` / `pic`。
- 不做跨平台兜底：请求哪个 `server` 就打哪个平台。

### 新增：上游错误语义

- 新增 [`src/providers/errors.js`](src/providers/errors.js) 的 `UpstreamError`。
  此前 provider 抛任何异常都被压成 `500 internal server error`；
  现在可对外说明的原因（上游下线、需要 Cookie、没有版权）会带上状态码与 `message`，
  内部异常仍然只回通用 500。
- 上游不可用统一 `502`；直链缺失 `404`；平台不支持该 `type` 时 `400`。

### 新增：平台 Cookie 兜底

- 支持 `METING_COOKIE_<SERVER>` 环境变量（与原始项目同名），如 `METING_COOKIE_KUGOU`，
  优先级低于后台保存的 Cookie。酷狗直链（`type=url`）依赖 `t` + `KugooID`。

### 平台现状（2026-10 实测）

| server | 状态 | 说明 |
|--------|------|------|
| `kugou` | ✅ 可用 | `search`/`song`/`album`/`artist`/`playlist`/`lrc`/`pic` 均返回真实数据；`url` 需 Cookie |
| `baidu` | ❌ 上游下线 | `musicapi.taihe.com` DNS 已不解析，请求 502 |
| `kuwo` | ❌ 上游关闭 | 接口要求有效 `kw_token`，官网已不再下发，请求 502 |

> 这两个平台的路由与能力保留：上游一旦恢复（或换用自有 token），无需改代码即可工作。
> 首页能力矩阵会按 provider 的 `status` 标注「当前不可用」，`/test` 只展示实测可用的示例。

### 其他

- `/test` 页面新增酷狗示例（playlist / song / album / search），共 12 张卡片。
- 首页能力矩阵扩到 5 列，并新增「平台现状」说明。
- 新增 `test/legacy-providers.test.js`（10 条，不联网）覆盖字段映射与注册表状态。
- **修复 edge 构建**：`@meting/core` 顶部 `import { URLSearchParams } from "url"`，
  而官方 url polyfill 不导出该符号，导致 `npm run build:all` 直接失败。
  新增 `src/polyfills/url.js`，并在 `esbuild.config.js` 里只对
  「importer 为 `@meting/core` 的 `url` 引用」做替换（http/https polyfill 继续用官方实现）。
  三个产物（cloudflare-workers / cloudflare-workers-min / deno）现在都能正常生成。

## [1.2.0] - 2026-10-26

按本站访问日志分析（`reports/log_report_7d.md`、`reports/log_report_30d.md`）与
原始项目 [metowolf/Meting-API](https://github.com/metowolf/Meting-API) 的能力对齐做了一轮修复与优化。

### 新增

- **`/api` 响应缓存**（`src/service/api-cache.js`）：按类型设置 TTL（url/search 10 分钟，
  playlist/artist 30 分钟，lrc/song/album/pic 60 分钟），响应带 `X-Cache: HIT|MISS`，
  命中率见 `/api/stats` 的 `data.cache`。可用 `CACHE_ENABLED`、`CACHE_TTL_SECONDS`、
  `CACHE_MAX_ENTRIES` 调整。日志分析显示 30 天内只有 23 个不同歌单被反复拉取，
  30~60 分钟 TTL 可减少约 40%~50% 的上游请求。
- **`type=album`**（网易云 / QQ 音乐）：原始项目支持但本 fork 重写时遗漏。
- **`/robots.txt` 与 `/sitemap.xml`**：自动生成并 `Disallow: /api`（这两个路径在日志里长期 404）。
- **search 日配额**：默认单 IP 每日 300 次，超出返回 429 + `Retry-After`。
  现有 QPS 限流对「每分钟 1~2 次、持续数天」的慢速刷接口无效。
- **抓取型 UA 拦截**：默认拦 `YisouSpider` 访问 `/api`（日志中占 17%~22% 且无 SEO 价值），
  页面、`robots.txt` 与后台不受影响。

### 修复

- **`type=url` 拿不到直链时不再返回假地址**：网易云旧逻辑回退到
  `music.163.com/song/media/outer/url`（实测只会 302 到 `/404`），QQ 音乐旧逻辑会拼出
  `https://aqqmusic.tc.qq.com/` 这样的 CDN 根路径。现在统一返回 404，与原始项目一致。
- **网易云直链规范化**：`m7c/m8c` 回源节点改回 `m7/m8`、强制 https、去掉 `vuutv` 防盗链参数。
- **QQ 音乐直链**：补 `ws.stream → dl.stream` 域名替换，`purl` 为空时不拼残缺 URL。
- **`/api/` 尾斜杠**：不再 404。
- **`/api` 参数校验**：非 `search` 类型的 `id` 不再接受空白字符（此前会把非法输入透传到上游）。

### 兼容与文档

- `/demo` 301 跳转到 `/test`，兼容原始项目的演示页地址。
- 补充缓存、元信息、安全规则等文档，并新增 `test/admin-auth.test.js` 等回归用例。

### 保持不变（重要）

管理后台的登录链路（`src/admin/store.js` 的令牌/锁定、`src/admin/api.js` 的 `/admin/login`、
`src/middleware/auth.js`）没有任何行为改动，并额外用 12 条用例固化：
登录成功/失败、连续失败锁定、令牌缺失/伪造/错配、普通用户越权、登出后令牌失效，
以及「高频请求后仍能打开登录页并登录」与「携带有效令牌的请求不受频控影响」。

## [1.1.2] 及更早

历史版本变更见 git 提交记录。

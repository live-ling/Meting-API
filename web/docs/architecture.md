# 完整架构

> 目标：把现有的「单文件内联 HTML」前端整体迁到 Vite + React，**后端一行不改**（必要时只加静态资源路由），
> 三条路由 `/`、`/test`、`/admin` 都由同一个前端工程产出。

## 1. 技术选型

| 层 | 选择 | 为什么 |
|---|---|---|
| 构建 | **Vite 6** | 多路由单页、开发秒开、产物可直接内联或静态托管 |
| 框架 | **React 19 + TypeScript** | 生态最大；后台表单/表格多，TS 能挡住字段拼错 |
| 路由 | **React Router 7** | 声明式嵌套路由，后台九个功能区天然对应子路由 |
| 服务端状态 | **TanStack Query 5** | 缓存、去重、轮询（监测/日志）、401 统一处理，省掉手写 loading 状态机 |
| 客户状态 | **Zustand 5** | 只放 UI 态（侧栏折叠、弹窗、当前曲目），不放大块服务端数据 |
| 表单 | **React Hook Form + Zod** | 后台表单密集；Zod 同时用于接口响应校验 |
| 无障碍基础件 | **Radix UI**（Dialog / Tabs） | 弹窗与页签的焦点管理、键盘行为不用自己写 |
| 图标 | **lucide-react** | 与现有 `lucide-static` 同源，视觉一致 |
| 样式 | **CSS Modules + 设计令牌** | 原型多为定制视觉，CSS Modules 能 1:1 翻译；令牌集中在 `tokens.css` |
| 后端 | **保持 Hono** | `/api`、`/admin/*`、鉴权、限流、缓存都不动，前端只换渲染层 |

不选 Next/Astro 的原因：这个项目是「一个 API + 三个界面」，没有 SSR/SEO 需求，
引入服务端框架会把部署模型（Node / Workers / Deno）复杂化，收益为零。

## 2. 运行时架构

```
浏览器
  │  GET /            → 前端入口（index.html + assets）
  │  GET /test
  │  GET /admin/...   → 同一个 SPA，前端路由分流
  │
  │  fetch /api?server=…            公开接口（不变）
  └─ fetch /admin/login|cookies|…   管理接口（不变，cookie 会话）

Hono（仓库根 app.js）
  ├─ /api            providers + 缓存 + 限流（原样）
  ├─ /admin/*        管理 API（原样，authMiddleware 校验 cookie）
  ├─ /admin/<path>   后台页面入口（改为返回前端构建产物）
  ├─ /test           试听页入口（同上）
  └─ /               首页入口（同上）
```

管理后台路径是可配置的（`ADMIN_PATH`）。页面入口会在 HTML 里注入：

```html
<script>window.__BOOT__ = { adminPath: "/admin" }</script>
```

前端 `src/boot.ts` 读取它，所有后台跳转都基于这个值，**不写死 `/admin`**。

## 3. 数据层约定

```ts
// 查询：服务端状态
useQuery({ queryKey: ['cookies', platform], queryFn: () => apiData('/admin/cookies?platform=…') })

// 变更：写操作后失效相关查询
const mutation = useMutation({
  mutationFn: (payload) => apiData('/admin/cookies', { method: 'POST', body: payload }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cookies'] }),
})
```

- Query Key 规范：`[资源, 过滤条件]`，例如 `['cookies', 'netease']`、`['api-logs', { page, type }]`。
- 轮询：`refetchInterval` 只给需要实时的场景（监测状态 30s、API 日志 10s），页面不可见时自动停。
- 401：`lib/http.ts` 抛 `ApiError(401)`；会话查询返回 `null`，后台入口自动切回登录页。
- 接口响应统一 `{ success, data }`，`apiData()` 拆信封；业务失败（`success:false`）按错误抛出。

## 4. 鉴权流程

```
GET  /admin/check        → 200 {username, role} / 401
POST /admin/login        → 200 {success, data} 或 {success, require2FA, data}
POST /admin/login +code  → 2FA 校验
POST /admin/logout       → 需带 X-Auth-Username 头（沿用旧实现）
```

前端：`useSession()` 拉 `/admin/check`；未登录渲染 `<LoginPage>`，登录成功后失效 `['session']` 重新拉。
**不改** cookie 名称、有效期、锁定策略——这些都在 `src/admin/store.js` 与 middleware 里，属于后端契约。

## 5. 样式与原型接入

- `styles/tokens.css`：唯一令牌来源（颜色、字号、间距、圆角、阴影、动效）。
- 页面样式用 `*.module.css`，与组件同目录；不允许在 JSX 里写色值。
- 原型接入顺序：抽令牌 → 拆组件（`components/`）→ 拼页面（`pages/`）→ 响应式断点（360/768/1024/1440）。
- 动态效果只在 `prefers-reduced-motion: no-preference` 下启用。

## 6. 构建与部署

### 方案 A（推荐）：静态资源由 Hono 托管

```js
import { serveStatic } from '@hono/node-server/serve-static'
app.use('/assets/*', serveStatic({ root: './web/dist' }))
app.get('/', c => c.html(readFileSync('./web/dist/index.html', 'utf8')))
app.get('/test', …)
app.get('/admin/*', …)   // 返回同一个 index.html
```

- Node 部署（当前 nginx 反代）直接可用；
- Workers/Deno 需要各自的静态资源机制（Workers Static Assets / Deno serveDir），
  也可以退回方案 B。

### 方案 B：产物内联（保持「单 HTML 响应」）

构建后再跑一个脚本，把 `dist/assets/*.js|css` 读成字符串写进 `src/admin/ui/generated.ts`，
页面入口拼成一份 HTML。优点：不改静态路由、Workers 零配置；缺点：首屏体积大。

建议先走 A，若确实要保住「单文件响应」再切 B——切换成本只在一个构建脚本。

## 7. 迁移阶段

| 阶段 | 内容 | 验收 |
|---|---|---|
| P0 | 工程骨架、令牌、路由、登录页（已完成） | `pnpm dev` 可打开三条路由，登录可进后台 |
| P1 | 后台壳 + 仪表盘 + Cookie 管理 | 与旧后台功能对齐，登录/2FA 回归通过 |
| P2 | 监测 / Token / 滥用防护 | 轮询、封禁、解封可用 |
| P3 | 用户 / 操作日志 / API 日志 / 设置 | 表单校验、导出、Webhook/SMTP 测试 |
| P4 | `/test` 试听页（已完成） | 复用现有播放逻辑，契约不变 |
| P5 | `/` 介绍页 | 文案与能力矩阵动态生成 |
| P6 | 切流与清理 | 删除 `src/admin/page.js`、`src/pages/**` 旧实现 |

每个阶段结束跑：`pnpm typecheck` + 仓库根 `node .\node_modules\vitest\vitest.mjs run`
（其中 `test/admin-auth.test.js` 12 条是鉴权回归门禁）。

### P4 完成情况（/test → React）

- 旧实现：`src/pages/test/**`（内联 HTML + `toString()` 注入）+ `src/template.js` 的 `handler`。
- 新实现：`web/src/features/test/**`（`core.ts` 纯函数、`usePlayer.ts` 状态机、
  `components.tsx` 组件、`test.css` 样式）+ `web/src/pages/TestPage.tsx`。
- 后端：`src/routes/spa.js` 托管 `web/dist`（`/assets/*` + SPA 入口 + `logo.png`），
  `src/routes/capabilities.js` 提供 `GET /api/capabilities`（能力矩阵与预设）。
- `/test` 在有构建产物时返回 React 页面；没有时（Workers / Deno）回退旧的内联页。
- 与旧版的**有意差异**：
  - 首屏自动载入默认数据源（旧版也是自动载入，行为一致）；
  - 新增「连播」：播完自动下一首，可关闭；
  - 能力矩阵改为运行时读 `/api/capabilities`，前端不再硬编码。
- 旧实现暂时保留（`src/pages/test/**`）作为 Workers/Deno 的回退，
  P6 清理时连同 `src/template.js` 一起删除。

## 8. 风险与取舍

- **后台逻辑量大**（旧 `page.js` 2797 行）：逐页搬，不一次性重写；每页对照 `docs/api-map.md` 接接口。
- **后台路径可配置**：所有跳转必须走 `adminBase`，否则自定义路径下会 404。
- **Workers/Deno 部署**：方案 A 需要平台侧静态资源支持；若不想动部署，选 B。
- **体积**：React 运行时约 45KB gzip，后台可接受；首页若在意体积，可后续单独做静态预渲染。
- **回归**：迁移期间旧后台保持可用，新前端在 `/admin?next=1` 之类开关下灰度，确认后再切默认。

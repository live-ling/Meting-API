# Meting-API Web

Meting-API 的前端工程：**首页 / 试听实验室 / 管理后台**，Vite + React + TypeScript。

后端不动：仍是仓库根目录的 Hono 应用（`app.js`），提供 `/api`、`/admin/*`、`/admin/<path>` 页面入口。
本工程只负责渲染与交互，所有数据仍走现有接口。

## 快速开始

```bash
# 1. 先起后端（仓库根目录）
cd ..
$env:PORT='3000'; node node.js

# 2. 再起前端
cd web
pnpm install
pnpm dev          # http://localhost:5173
```

开发服务器已把 `/api` 与 `/admin/<接口前缀>` 代理到 `http://127.0.0.1:3000`，
页面路由（`/`、`/test`、`/admin/...`）由 Vite 自己接管。

> **开发时直接访问 http://127.0.0.1:3000/test 即可。**
> 后端检测到 Vite 在跑时，会把前端资源请求转发给它（见 `src/routes/spa.js`），
> 所以开发地址与生产地址一致，不用切端口。HMR 的 WebSocket 由 Vite 配置
> 直连 5173（`web/vite.config.ts` 的 `server.hmr`），热更新照常工作。
>
> Vite 没启动时，3000 端口直接返回 `web/dist` 的构建产物。

```bash
pnpm build        # 产物在 web/dist
pnpm preview      # 预览产物
pnpm typecheck    # 只做类型检查
```

构建后仓库根目录的 Hono 会自动托管 `web/dist`：
`/test` 返回前端入口 HTML，`/assets/*` 返回带指纹的静态文件。
没构建前端时（Workers / Deno 没有文件系统）`/test` 会回退到旧的内联页面，
不会 404。

## 目录

```
web/
├─ index.html            站点入口（多路由单页应用）
├─ vite.config.ts        开发代理 / 构建配置
├─ public/logo.png       站点图标
├─ docs/
│  ├─ architecture.md    完整架构与迁移计划
│  └─ api-map.md         现有接口与页面功能对照
└─ src/
   ├─ main.tsx           挂载：QueryClient + 路由
   ├─ App.tsx            /、/test、<后台路径> 三条路由
   ├─ boot.ts            服务端注入的运行时参数（后台路径）
   ├─ components/        通用组件（当前只有占位页）
   ├─ features/          按业务分组的 hooks（auth、test、logs…）
   │  └─ test/           试听实验室：core.ts（纯函数）/ usePlayer.ts（状态）/
   │                     components.tsx（组件）/ test.css（样式）
   ├─ lib/               http 封装、QueryClient
   ├─ pages/             页面：HomePage / TestPage / admin/*
   └─ styles/            tokens.css（设计令牌）、global.css
```

## 试听实验室（/test）

已从旧的内联页面（`src/pages/test/**`）整体迁移到 React，视觉 1:1 保留，
行为契约不变：

- 打开页面**自动载入**默认数据源（网易云歌单），只发这一次列表请求；
- 请求串行（间隔 ≥1500ms）+ 同 URL 去重 + 有界缓存（32 条）；
- HTTP 429 → 读 `Retry-After` → sessionStorage 冷却 → **永不自动重试**；
- 全页一个 `Audio`（`preload='none'`），切歌不自动播放；
- **连播**：一首播完自动切下一首；
- 歌词按 `currentTime` 二分高亮 + 滚动居中，点击歌词行跳转；
- 封面与歌词走同一个调度器，失败保留唱片占位并提示。

版式：

- 左侧三栏 = 控制台 / 封套 / 歌词；传送控件在控制台区域水平居中；
- 右侧「队列 / 换源」是**可收起的侧栏**（不是浮层）：展开时内容区让出一列，
  收起时右边缘留一个把手随时拉出；≤1180px 时改为浮层，避免把三栏挤没；
- 封套背后的同心圆环持续缓慢旋转，播放时唱片呼吸。

能力矩阵（哪些平台支持哪些 type）来自后端 `GET /api/capabilities`，
前端不再维护第二份硬编码清单；加平台或加类型时页面会自动跟上。

## 样式原型怎么接进来

1. 把原型（HTML/CSS 或截图）放进 `web/docs/prototypes/`，命名如 `admin-dashboard.html`。
2. 我先从原型里抽令牌（颜色 / 字号 / 间距 / 圆角 / 阴影）落到 `styles/tokens.css`。
3. 再把原型拆成组件：`components/` 放通用件，`pages/*` 放页面骨架。
4. 页面里**不写死颜色和间距**，一律引用 `var(--*)`，方便后续统一调整。

## 约定

- 只用函数组件 + hooks；不引入 class 组件。
- 服务端数据一律走 TanStack Query，不手写 `useEffect + fetch`。
- 表单统一 React Hook Form + Zod，错误文案中文、面向用户。
- 所有接口请求走 `lib/http.ts`，401 视为未登录。
- 提交前跑 `pnpm typecheck`；涉及登录的改动跑仓库根目录的 `test/admin-auth.test.js`。

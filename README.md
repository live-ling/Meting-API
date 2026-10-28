# Meting-API

多平台音乐 API 服务，支持网易云音乐、QQ 音乐、酷狗音乐、百度音乐、酷我音乐，提供完整的 Cookie 管理、VIP 歌曲播放、自动续期和监测通知功能。

## 功能特性

- 五平台支持：网易云音乐、QQ 音乐、酷狗音乐、百度音乐、酷我音乐
- Cookie 管理系统：增删改查、在线验证、VIP 播放能力检测
- 网易云 Cookie 自动续签：每 12 小时调用刷新接口回写 `MUSIC_U`
- 网易云扫码登录：已下线（平台风控 8821），代码保留，开关见 `src/admin/features.js`
- Cookie 定时监测：可配置间隔自动检查，失效/VIP 丢失时自动通知
- Webhook 通知：兼容 Gotify、企业微信、钉钉、飞书等
- 2FA 双因素认证：TOTP 实现，兼容 Google Authenticator
- 用户与权限管理：多用户、角色区分、登录失败锁定
- 管理后台：功能完备的单页应用，响应式设计
- 多运行时部署：Node.js / Docker / Vercel / Cloudflare Workers
- Docker 多架构镜像：支持 amd64/arm64，自动 CI/CD 发布

## API 支持矩阵

| 类型 | 说明 | `netease` | `tencent` | `kugou` | `baidu`¹ | `kuwo`¹ |
|------|------|:---:|:---:|:---:|:---:|:---:|
| `song` | 单曲信息 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `album` | 专辑曲目 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `playlist` | 歌单 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `artist` | 歌手歌曲 | ✅ | ❌ | ✅ | ✅ | ✅ |
| `search` | 搜索 | ✅ | ❌ | ✅ | ✅ | ✅ |
| `url` | 播放链接 | ✅ | ✅ | ✅² | ✅ | ✅ |
| `lrc` | 歌词 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pic` | 封面图片 | ✅ | ✅ | ✅ | ✅ | ✅ |

¹ `baidu` / `kuwo` 的路由与能力已按原始项目补齐，但**上游公开接口目前不可用**，请求会返回 502（详见下方「平台可用性」）。
² `kugou` 的直链需要 Cookie（`t` + `KugooID`），未提供时返回 404。

> `album` 与 `/api/` 尾斜杠是相对原始项目（[metowolf/Meting-API](https://github.com/metowolf/Meting-API)）补齐的能力；
> `url` 在拿不到直链时返回 **404**（不再 302 到 CDN 根路径或占位页）。

## 平台可用性

`netease` / `tencent` 是本仓库自研 provider；`kugou` / `baidu` / `kuwo` 通过
[`@meting/core`](https://www.npmjs.com/package/@meting/core) 接入，与原始项目使用同一套上游接口。
路由不做跨平台兜底：请求哪个 `server`，就打哪个平台。

| server | 状态（2026-10 实测） | 说明 |
|--------|------|------|
| `netease` | ✅ 可用 | 自研 provider，支持 VIP Cookie |
| `tencent` | ✅ 可用 | 自研 provider；无 VIP Cookie 时 `url` 返回 404 |
| `kugou` | ✅ 可用 | `search` / `song` / `album` / `artist` / `playlist` / `lrc` / `pic` 均可取到真实数据；`url` 需 Cookie（`t` + `KugooID`），可通过 `METING_COOKIE_KUGOU` 提供 |
| `baidu` | ❌ 上游下线 | `musicapi.taihe.com` 已无法解析；请求返回 502 与原因 |
| `kuwo` | ❌ 上游关闭 | 接口要求有效 `kw_token`，官网已不再下发（返回 `request is illegal`）；请求返回 502 与原因 |

上游异常时统一返回 `502`，响应体形如：

```json
{ "error": "upstream unavailable", "message": "kuwo 上游没有返回有效曲目（该平台的公开接口可能已下线），详见 README「平台可用性」" }
```

> `pic` 在酷狗返回的是歌手头像（上游只提供这张图），不是专辑封面。

## 地区限制

### 部署在国外

| 客户端访问地区 | 国内 | 国外 |
|:---:|:---:|:---:|
| 网易云 | ✅ | ✅ |
| QQ音乐 | ✅¹ | ❌ |

### 部署在国内

| 客户端访问地区 | 国内 | 国外 |
|:---:|:---:|:---:|
| 网易云 | ✅ | ✅ |
| QQ音乐 | ✅ | ❌ |

¹ 使用 JSONP，需要替换前端插件：
- `https://cdn.jsdelivr.net/npm/meting@2.0.1/dist/Meting.min.js` → `https://cdn.jsdelivr.net/npm/@xizeyoupan/meting@latest/dist/Meting.min.js`
- `https://unpkg.com/meting@2.0.1/dist/Meting.min.js` → `https://unpkg.com/@xizeyoupan/meting@latest/dist/Meting.min.js`

详见 [MetingJS](https://github.com/xizeyoupan/MetingJS)

## 快速开始

### 环境要求

- Node.js >= 18.0.0

### 手动部署

```bash
git clone https://github.com/live-ling/Meting-API.git
cd Meting-API
npm install
node node.js
```

部署成功后访问 `http://localhost:3000/test` 验证服务是否正常运行。

### Docker 部署

```bash
docker pull ghcr.io/live-ling/meting-api:latest
docker run -d --name meting -p 3000:3000 ghcr.io/live-ling/meting-api:latest
```

持久化数据：

```bash
docker run -d --name meting \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/live-ling/meting-api:latest
```

自定义端口和用户：

```bash
docker run -d --name meting \
  -p 8080:8080 \
  -e PORT=8080 \
  -e UID=1000 \
  -e GID=1000 \
  -v ./data:/app/data \
  ghcr.io/live-ling/meting-api:latest
```

### Vercel 部署

<a href="https://vercel.com/import/project?template=https://github.com/live-ling/Meting-API"><img src="https://vercel.com/button" height="36"></a>

点击按钮后按提示操作即可。Vercel 部署时 `OVERSEAS` 自动设为 `1`。

> **注意**：Vercel/Cloudflare Workers 运行时不支持管理后台功能（依赖文件系统），仅提供基础 API 服务。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |
| `OVERSEAS` | `false` | 海外模式。Vercel/Cloudflare 运行时自动设为 `true` |
| `ADMIN_PATH` | `admin` | 管理后台路径。如设为 `secret-admin`，则后台地址为 `/secret-admin` |
| `DATA_DIR` | `./data` | 数据存储目录 |
| `UID` | `1010` | Docker 容器用户 UID |
| `GID` | `1010` | Docker 容器用户 GID |
| `CACHE_ENABLED` | `1` | 设为 `0` 关闭 `/api` 响应缓存 |
| `CACHE_TTL_SECONDS` | 按类型 | 统一覆盖所有类型的缓存 TTL；不设则用下方分类型默认值 |
| `CACHE_MAX_ENTRIES` | `500` | 缓存条目上限，超出按插入顺序淘汰 |
| `METING_COOKIE_<SERVER>` | — | 平台 Cookie 兜底，如 `METING_COOKIE_KUGOU`；优先级低于后台里保存的 Cookie |

## 接口缓存

访问日志分析显示：30 天内被请求的歌单只有 23 个，最热的歌单平均每 12.6 分钟被拉一次。
因此 TTL 必须大于拉取间隔才有收益，默认分类型设置：

| 类型 | 默认 TTL |
|------|----------|
| `url` | 10 分钟（直链本身有时效） |
| `search` | 10 分钟 |
| `playlist` / `artist` | 30 分钟 |
| `lrc` / `song` / `album` / `pic` | 60 分钟 |

- 响应头 `X-Cache: HIT|MISS` 可直接看是否命中；命中率与容量在 `GET /api/stats` 的 `data.cache`。
- 只缓存成功结果；缓存键包含 `server/type/id` + Cookie 指纹 + `OVERSEAS`，VIP Cookie 与直链不会串用。
- 后台「设置 → 缓存」可运行时修改开关、分类型 TTL、最大条目，查看命中/淘汰统计并清空缓存。
- 优先级：后台分类型 TTL > `CACHE_TTL_SECONDS` > 内置默认；`CACHE_ENABLED=0` 是运维级总开关，会覆盖后台开关。
- 需要立即刷新某个内容时，可在后台清空缓存；TTL 改动保存后旧缓存也会自动清空。

## 使用方法

### 前端插件集成

在导入 [MetingJS](https://github.com/xizeyoupan/MetingJS) 前添加：

```html
<script>
var meting_api='http://your-domain/api?server=:server&type=:type&id=:id&auth=:auth&r=:r';
</script>
```

### API 请求示例

```
GET /api?server=netease&type=playlist&id=7326220405
GET /api?server=tencent&type=song&id=004Yi5BD3ksoAN
GET /api?server=netease&type=album&id=34720827
GET /api?server=tencent&type=album&id=000MkMni19ClKG
GET /api?server=netease&type=url&id=22704470
GET /api?server=netease&type=url&id=22704470&quality=lossless
GET /api?server=tencent&type=lrc&id=004Yi5BD3ksoAN
```

> `/api/`（带尾斜杠）与 `/api` 等价；`/demo` 会 301 跳转到 `/test`。

### 音质参数（`type=url`）

`quality` 可选，默认 `standard`：

| 值 | 说明 | 常见简写 |
|---|---|---|
| `standard` | 128kbps | `128`, `std` |
| `higher` | 192kbps | `192` |
| `exhigh` | 320kbps | `320`, `hq` |
| `lossless` | FLAC 无损 | `flac`, `sq` |
| `hires` | Hi-Res（视曲库/会员） | `hi-res`, `hr` |
| `jyeffect` / `sky` / `jymaster` | 网易云音效 / 沉浸声 / 母带 | `effect`, `master` |

- `netease` 支持全部值；`tencent` 映射为 `M500`（standard）、`M800`（higher/exhigh）、`F000`（lossless/hires/jymaster）。
- 没有对应会员或曲目本身没有该音质时，上游可能回落到较低音质；完全拿不到直链时返回 **404**。
- 响应头：`X-Audio-Quality` 回显请求值，`X-Audio-Quality-Actual` 回显上游实际命中值，`X-Audio-Bitrate` 是实际码率（netease）。
- 缓存键已包含音质，不会把 320k 和无损串用。

### 响应格式

- `type=url`：以 `@` 开头返回纯文本；否则 302 重定向到音频 URL；**拿不到直链时返回 404**（JSON `{"error":"no url"}`）
- `type=pic`：302 重定向到图片 URL；拿不到时返回 404
- `type=lrc`：返回纯文本歌词（含翻译合并）
- 其他类型：返回 JSON 数组

## 站点元信息

| 路径 | 说明 |
|------|------|
| `/robots.txt` | 自动生成，`Disallow: /api` 与后台路径（后台路径随 `ADMIN_PATH` 变化） |
| `/sitemap.xml` | 仅包含 `/` 与 `/test` |
| `/api/stats` | 累计与近 24 小时调用统计，含缓存命中率 `data.cache` |

## 管理后台

访问 `/{ADMIN_PATH}`（默认 `/admin`）进入管理后台。

默认账号密码：`admin` / `admin123`，**请登录后立即修改默认密码**。

### 功能模块

| 模块 | 功能 |
|------|------|
| 仪表盘 | Cookie 统计、有效 Cookie 数、用户数、操作记录 |
| Cookie 管理 | 增删改查、在线验证、获取教程（扫码入口暂下线） |
| Cookie 监测 | 定时检查、自动刷新、Webhook 通知、监测历史 |
| 用户管理 | 增删改查、角色分配（管理员专属） |
| 操作日志 | 所有操作记录查看 |
| 设置 | 按「账户 / 安全 / 集成与外观 / 缓存」分组：个人资料、密码修改、后台路径、2FA、IP 归属地、登录页背景、响应缓存 |

### 登录页背景图

登录页默认使用 [uapis.cn 随机图接口](https://uapis.cn/docs/api-reference/get-random-image)
的 ACG 分类作为背景（`https://uapis.cn/api/v1/random/image?category=acg`）。

- 图片由服务端抓取，浏览器只请求同源的 `/admin/login-bg`，不跨域、不受接口限流影响。
- 抓取结果缓存在内存与 `data/login-bg/`（`image.bin` + `meta.json`），默认 6 小时。
  **刷新登录页始终是同一张**，进程重启后也从磁盘恢复；到期后才会自动换图。
- 设置页「登录页背景」可以关闭、改接口地址（换 `category` 即可换风格）、改缓存时长，
  也可以手动「立即换一张」或「清除缓存」。
- 抓取失败时保留旧图，并在 1 分钟内不再重试，避免接口异常时反复打上游。

### IP 归属地

- 「测试 IP」留空时会自动使用当前访问后台的 IP：优先取 `X-Forwarded-For` / `X-Real-IP`；
  本地或内网访问时回退到 uapis 的 myip 接口（10 分钟缓存）。
- 支持 IPv4 / IPv6。IPv4 走 ShowAPI；IPv6 与 ShowAPI 失败时自动回退
  [ipwho.is](https://ipwho.is/)（无需额外 key，字段为英文）。
- 测试结果会展示国家、省/市/区、运营商、大洲、城市编码、经纬度、英文名，并可展开原始字段。
- 归属地查询按 IP 缓存在 `data/ip_geo_cache.json`，重复 IP 只查一次。

### Cookie 获取方法

#### 网易云音乐

> 扫码登录入口**暂时下线**：网易云对第三方扫码接口做风控，确认后返回 8821，
> 拿不到会话。代码与接口保留在 [`src/admin/netease-qr.js`](src/admin/netease-qr.js)，
> 把 [`src/admin/features.js`](src/admin/features.js) 里的 `neteaseQrLoginEnabled` 改回 `true` 即可恢复。

手动方式：

1. 登录 [music.163.com](https://music.163.com)
2. 按 F12 打开开发者工具
3. 切换到 Network 标签，刷新页面
4. 找到任意请求，复制请求头中的 Cookie 字段
5. 粘贴到管理后台的 Cookie 输入框

#### QQ音乐

1. 登录 [y.qq.com](https://y.qq.com)
2. 按 F12 打开开发者工具
3. 切换到 Application → Cookies → y.qq.com
4. 复制 `uin` 和 `qqmusic_key` 的值
5. 格式：`uin=你的uin; qqmusic_key=你的key`

> **提示**：QQ 音乐目前仍需手动粘贴 `uin` + `qqmusic_key`。扫码登录与自动续期当前只实现了网易云
> （QQ 扫码要走 ptlogin2 → check_sig → p_skey → graph OAuth 多步链路，且参数随版本变化，暂未接入）。

### 网易云 Cookie 自动续签

扫码/粘贴拿到 `MUSIC_U` 后，服务会每 12 小时调用一次 `/api/login/token/refresh`：

- 只合并 `MUSIC_U`、`__csrf` 等白名单字段，不会整串覆盖
- 新 Cookie 先校验，校验不过就保留旧值
- 日志不打印 Cookie 内容
- 续签失败不会静默：Cookie 失效仍由「Cookie 监测」发通知

## Cookie 监测系统

### 功能

- 定时监测 Cookie 有效性（间隔 5 分钟 ~ 24 小时）
- 检测 VIP 播放能力丢失
- 网易云 Cookie 自动续签（12 小时一次）
- Webhook 通知（Cookie 失效、VIP 丢失）

### 配置步骤

1. 登录管理后台 → Cookie 监测
2. 启用定时监测，设置检查间隔
3. 配置 Webhook 通知（可选）
4. 保存设置

### Webhook 消息格式

```json
{
  "title": "Cookie失效通知 - 网易云音乐",
  "message": "平台: 网易云音乐\n备注: VIP账号\n失效时间: 2024-01-15 18:30:00\n原因: Cookie已失效\n\n请及时更新Cookie以确保服务正常",
  "priority": 5
}
```

### 通知事件优先级

| 事件 | 优先级 |
|------|--------|
| Cookie 失效 | 5 |
| VIP 播放能力丢失 | 4 |
| Cookie 自动刷新成功 | 3 |

### 常用 Webhook 配置

#### Gotify（推荐）

1. 部署 Gotify 服务端
2. 创建应用，获取 Token
3. Webhook URL：`https://your-gotify-server/message?token=YOUR_TOKEN`

#### 企业微信

1. 群聊中添加机器人
2. 获取 Webhook 地址填入

#### 钉钉

1. 群聊中添加自定义机器人
2. 安全设置选择「自定义关键词」，添加「Cookie」
3. 获取 Webhook 地址填入

#### 飞书

1. 群聊中添加自定义机器人
2. 获取 Webhook 地址填入

### 自定义 Headers

如需添加认证头，在「自定义 Headers」中输入 JSON：

```json
{
  "Authorization": "Bearer your-token-here"
}
```

## 安全特性

| 特性 | 说明 |
|------|------|
| 登录失败锁定 | 连续 5 次失败后锁定 15 分钟 |
| 隐藏管理入口 | 通过 `ADMIN_PATH` 自定义后台路径 |
| 动态路径修改 | 管理员可在后台设置页面修改路径，重启生效 |
| 2FA 双因素认证 | TOTP 实现，兼容 Google Authenticator / Authy |
| 非 root 运行 | Docker 容器以 `meting` 用户运行 |
| 滥用防护 | 窗口限流 + 可疑参数 + 路径枚举 + 自动封禁（后台路径与已登录会话豁免） |
| search 日配额 | 默认单 IP 每日 300 次，超出返回 429 并给出 `Retry-After`（堵慢速刷接口） |
| 抓取型 UA 拦截 | 默认拦 `YisouSpider` 访问 `/api`（返回 403），页面与后台不受影响 |
| 缓存降载 | 见上文「接口缓存」，减少上游调用与风控概率 |

## 管理 API

### 认证

所有管理 API 需在请求头中携带认证信息：

```
X-Auth-Username: your-username
X-Auth-Token: your-token
```

### 端点列表

#### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/login` | 登录（支持 2FA） |
| POST | `/admin/logout` | 登出 |
| GET | `/admin/check` | 检查登录状态 |

#### Cookie 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/cookies` | Cookie 列表（支持 `?platform=` 筛选） |
| GET | `/admin/cookies/:id` | Cookie 详情 |
| POST | `/admin/cookies` | 添加 Cookie |
| PUT | `/admin/cookies/:id` | 更新 Cookie |
| DELETE | `/admin/cookies/:id` | 删除 Cookie |
| POST | `/admin/cookies/:id/verify` | 验证 Cookie |
| POST | `/admin/cookies/:id/refresh` | 刷新 QQ 音乐 Cookie |
| POST | `/admin/cookies/validate` | 在线验证（不保存） |

#### 用户管理（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/users` | 用户列表 |
| POST | `/admin/users` | 添加用户 |
| PUT | `/admin/users/:username` | 更新用户 |
| DELETE | `/admin/users/:username` | 删除用户 |
| PUT | `/admin/profile` | 修改当前用户资料 |
| PUT | `/admin/password` | 修改当前用户密码 |

#### Cookie 监测（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/monitor` | 监测配置 |
| PUT | `/admin/monitor` | 更新监测配置 |
| GET | `/admin/monitor/status` | 运行状态 |
| POST | `/admin/monitor/check` | 立即检查 |
| GET | `/admin/monitor/logs` | 监测日志 |

#### Webhook（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/webhook` | Webhook 配置 |
| PUT | `/admin/webhook` | 更新配置 |
| POST | `/admin/webhook/test` | 测试发送 |

#### 2FA

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/2fa/status` | 2FA 状态 |
| POST | `/admin/2fa/setup` | 初始化设置 |
| POST | `/admin/2fa/enable` | 启用 2FA |
| POST | `/admin/2fa/disable` | 禁用 2FA |

#### 登录页背景图

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/login-bg` | 登录页背景图（公开，同源代理 + 服务端缓存） |
| GET | `/admin/login-bg/settings` | 背景图配置与缓存状态（管理员） |
| PUT | `/admin/login-bg/settings` | 保存开关、接口地址、缓存时长（管理员） |
| POST | `/admin/login-bg/refresh` | 立即换一张并刷新缓存（管理员） |
| POST | `/admin/login-bg/cache/clear` | 清除内存与磁盘缓存（管理员） |

#### 响应缓存

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/cache` | 缓存开关、分类型 TTL、容量与命中统计（管理员） |
| PUT | `/admin/cache` | 保存缓存配置（管理员，TTL 单位为分钟） |
| POST | `/admin/cache/clear` | 清空 `/api` 响应缓存（管理员） |

#### IP 归属地

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/geo/client-ip` | 获取当前访问 IP（优先 XFF，内网时回退 uapis myip） |
| POST | `/admin/geo/test` | 测试查询；不传 IP 时使用当前访问 IP |

#### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/logs` | 操作日志 |
| GET | `/admin/config` | 系统配置（管理员） |
| PUT | `/admin/config/admin-path` | 修改后台路径（管理员） |

## 反向代理

### Nginx

```nginx
server {
    listen 8099;
    server_name localhost;

    location /meting/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header X-Forwarded-Host $scheme://$host:$server_port/meting;
    }
}
```

### Caddy

```
http://localhost:8099 {
    handle_path /meting* {
        reverse_proxy http://localhost:3000 {
            header_up X-Forwarded-Host {scheme}://{host}:{port}/meting
        }
    }
}
```

### SSL 配置

#### Nginx

```nginx
server {
    listen 8099 ssl;
    server_name localhost;

    ssl_certificate     ../server.crt;
    ssl_certificate_key ../server.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location /meting/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header X-Forwarded-Host $scheme://$host:$server_port/meting;
    }
}
```

#### Caddy

```
https://localhost:8099 {
    tls ./server.crt ./server.key
    handle_path /meting* {
        reverse_proxy http://localhost:3000 {
            header_up X-Forwarded-Host {scheme}://{host}:{port}/meting
        }
    }
}
```

## 常见问题

### QQ音乐无法播放？

- 确认部署在国内服务器
- 确认添加了有效的 VIP Cookie
- 尝试使用包含 `psrf_qqrefresh_token` 的完整 Cookie 以支持自动续期

### Cookie 刷新失败？

- 检查 Cookie 是否已完全过期（超过 90 天）
- 尝试重新登录获取新 Cookie
- 确保 Cookie 中包含 `psrf_qqrefresh_token` 字段

### Docker 数据持久化？

使用 `-v` 挂载数据目录：

```bash
docker run -d -p 3000:3000 -v ./data:/app/data ghcr.io/live-ling/meting-api:latest
```

### 忘记管理后台路径？

检查 `DATA_DIR/config.json` 中的 `adminPath` 字段，或通过环境变量 `ADMIN_PATH` 重新指定。

## 开发与测试

```bash
# 全部测试（vitest）
node ./node_modules/vitest/vitest.mjs run

# 只跑与登录/权限相关的回归用例（改管理后台前后必跑）
node ./node_modules/vitest/vitest.mjs run test/admin-auth.test.js
```

> 注意：`npm test` 在部分终端（如 Windows PowerShell 管道）下会静默无输出，请直接用上面的 node 直调方式。

| 测试文件 | 覆盖内容 |
|----------|----------|
| `test/admin-auth.test.js` | 登录/锁定/令牌校验/权限/登出，以及「滥用检测不得拦掉登录」 |
| `test/api-contract.test.js` | 尾斜杠、robots/sitemap、参数校验、缓存模块 |
| `test/legacy-providers.test.js` | 酷狗/百度/酷我的字段映射与注册表状态（不联网） |
| `test/abuse-rules.test.js` | search 日配额、抓取型 UA 拦截的生效与豁免 |
| `test/test-page.test.js` | `/test` 页面的离线工具函数（LRC、调度器、URL 校验） |
| `test/providers.test.js` | 各 provider 的示例请求（需要外网） |

## 相关项目

- [MetingJS](https://github.com/xizeyoupan/MetingJS) - 前端音乐播放插件
- [Hono](https://github.com/honojs/hono) - Web 框架
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) - 网易云音乐 API
- [QQMusicApi](https://github.com/jsososo/QQMusicApi) - QQ 音乐 API

## License

MIT

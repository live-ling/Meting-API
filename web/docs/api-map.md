# 接口 × 页面 对照

> 后端路由全部在 `src/admin/api.js`，本文件只做「页面需要哪些接口」的映射，供迁移时逐页对照。
> 所有管理接口都需要登录 Cookie；标 **admin** 的还要求管理员角色。

## 登录 / 会话

| 方法 | 路径 | 用途 | 页面 |
|---|---|---|---|
| POST | `/admin/login` | 账号密码登录；返回 `require2FA` 时进入验证码步骤 | LoginPage |
| POST | `/admin/logout` | 退出（需 `X-Auth-Username` 头） | 顶栏 |
| GET | `/admin/check` | 当前会话 `{username, role}` | AdminApp 守卫 |

## 仪表盘 / 日志

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/admin/logs` | 操作日志 |
| GET | `/admin/api-logs/stats` | 调用统计 |
| GET | `/admin/api-logs` | 调用明细 |
| DELETE | `/admin/api-logs` | 清空（admin） |
| GET | `/admin/api-logs/export` | 导出 CSV |

## Cookie 管理

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/admin/cookies` | 列表（可选 `platform` 过滤） |
| GET | `/admin/cookies/:id` | 详情 |
| POST | `/admin/cookies` | 新增 |
| PUT | `/admin/cookies/:id` | 修改 |
| DELETE | `/admin/cookies/:id` | 删除 |
| POST | `/admin/cookies/:id/verify` | 单条验证 |
| POST | `/admin/cookies/validate` | 批量验证 |

## Cookie 监测

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/admin/monitor` | 监测配置 |
| PUT | `/admin/monitor` | 保存配置 |
| GET | `/admin/monitor/status` | 当前状态（轮询） |
| POST | `/admin/monitor/check` | 立即检查 |
| GET | `/admin/monitor/logs` | 监测日志 |

## API Token

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/admin/tokens` | 列表 |
| POST | `/admin/tokens` | 创建 |
| GET | `/admin/tokens/:id` | 详情 |
| PUT | `/admin/tokens/:id` | 修改 |
| DELETE | `/admin/tokens/:id` | 吊销 |
| GET | `/admin/public-token` | 公开令牌状态 |
| POST | `/admin/public-token` | 重置公开令牌（admin） |

## 滥用防护

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/admin/abuse/stats` | 统计 |
| GET | `/admin/abuse/logs` | 违规明细 |
| DELETE | `/admin/abuse/logs` | 清空 |
| GET | `/admin/abuse/config` | 规则配置 |
| PUT | `/admin/abuse/config` | 保存规则 |
| GET | `/admin/abuse/bans` | 封禁列表 |
| POST | `/admin/abuse/bans` | 新增封禁 |
| DELETE | `/admin/abuse/bans/:ip` | 解封 |
| POST | `/admin/abuse/reset/:ip` | 重置该 IP 计数 |

## 用户 / 账号安全

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/admin/users` | 用户列表（admin） |
| POST | `/admin/users` | 新增（admin） |
| PUT | `/admin/users/:username` | 修改（admin） |
| DELETE | `/admin/users/:username` | 删除（admin） |
| PUT | `/admin/profile` | 改自己的资料 |
| PUT | `/admin/password` | 改密码 |
| GET | `/admin/2fa/status` | 2FA 状态 |
| POST | `/admin/2fa/setup` | 生成密钥 / 二维码 |
| POST | `/admin/2fa/enable` | 启用 |
| POST | `/admin/2fa/disable` | 关闭 |

## 设置

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/admin/config` | 读取配置（admin） |
| PUT | `/admin/config/admin-path` | 修改后台路径（admin） |
| GET/PUT | `/admin/webhook` | Webhook 配置 |
| POST | `/admin/webhook/test` | 测试推送 |
| GET/PUT | `/admin/smtp` | SMTP 配置 |
| POST | `/admin/smtp/test` | 测试发信 |

## 公开接口（首页 / 试听用）

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api?server&type&id` | 音乐数据（列表 / 302 / 文本） |
| GET | `/api/stats` | 运行统计（首页数据带） |
| GET | `/api/capabilities` | 能力矩阵：各平台支持的 type、状态与可用的示例预设 |

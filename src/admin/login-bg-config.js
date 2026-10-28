/**
 * 登录页背景图的默认值与边界。
 *
 * 单独放一个不依赖 fs / store 的模块，方便 store 与 login-bg 服务共用，
 * 也避免把 Node 专属的磁盘逻辑带进管理后台的配置层。
 */

/** 随机图接口：uapis.cn 的 ACG 分类，302 到一张真实图片 */
export const DEFAULT_LOGIN_BG_API = 'https://uapis.cn/api/v1/random/image?category=acg'

/** 默认缓存 6 小时：一天最多换 4 次，远低于接口的访问配额 */
export const DEFAULT_LOGIN_BG_TTL_HOURS = 6

export const LOGIN_BG_TTL_MIN_HOURS = 1
export const LOGIN_BG_TTL_MAX_HOURS = 168

export const LOGIN_BG_URL_MAX_LENGTH = 500

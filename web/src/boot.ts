/**
 * 启动参数：服务端注入的运行时信息。
 * 管理后台路径是可配置的，前端所有跳转都要基于它，不能写死 /admin。
 */
export const boot = window.__BOOT__ ?? {}

export const adminBase = (boot.adminPath ?? '/admin').replace(/\/+$/, '') || '/admin'

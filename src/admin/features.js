/**
 * 功能开关
 *
 * 网易云扫码登录：暂时下线。
 *
 * 原因：网易云对第三方扫码接口做风控，确认后返回 8821
 * （「请切换其他登录方式或升级新版本再试」），拿不到会话；
 * 与官网扫码的反应也不一致，继续留着按钮只会让人白试一次。
 *
 * 代码、接口与测试都还在，改回 true 即可恢复后台按钮。
 */
export const neteaseQrLoginEnabled = false

export default { neteaseQrLoginEnabled }

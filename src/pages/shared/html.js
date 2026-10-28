/**
 * SSR 小工具：把任意值安全地嵌进 HTML 文本 / 属性上下文。
 *
 * 这两个页面以前各自实现了一份 `esc`/`escape`，这里统一成一份，
 * 避免以后改一处漏一处。
 */

const ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}

/** 转义 HTML 文本与属性值（属性请始终使用双引号） */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch])

/** 仅转义会破坏 double-quoted 属性的字符，用于已经可信的 HTML 片段拼接 */
export const escapeAttr = escapeHtml

/**
 * 把一段函数序列化成可内联执行的字符串。
 * 页面脚本都来自本仓库常量，不包含任何用户输入，但仍统一走这个入口，
 * 便于以后接入 CSP nonce 或构建期压缩。
 */
export const inlineScript = (fn) => `(${fn.toString()})`

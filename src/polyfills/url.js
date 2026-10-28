/**
 * `url` 模块垫片（仅用于 edge 打包）
 *
 * `@meting/core` 顶部有一句 `import { URLSearchParams } from "url"`，
 * 但 NodeModulesPolyfillPlugin 提供的 url polyfill 并不导出 URLSearchParams，
 * 导致 Cloudflare Workers / Deno 的打包直接失败。
 *
 * 这两个 API 在 Workers、Deno、Bun、Node 里都是全局对象，
 * 所以这里直接转发全局实现即可，不需要真的模拟 node:url。
 *
 * 只在 esbuild 打包时通过 `alias` 生效，Node 运行时仍然用原生 node:url。
 */
export const URL = globalThis.URL
export const URLSearchParams = globalThis.URLSearchParams

export default { URL, URLSearchParams }

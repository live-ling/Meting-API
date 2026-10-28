import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 开发时前端跑在 5173，接口仍由 http://127.0.0.1:3000 的 Hono 提供。
 *
 * 哪些路径要代理给后端：
 * - /api            公开接口
 * - /admin/<动词>   管理接口（login/logout/check/cookies/...）
 *
 * /admin 下的页面路由（/admin、/admin/dashboard…）不能被代理，
 * 所以这里用正则只匹配真实的接口前缀，交给 Vite 自己返回 index.html。
 */
const ADMIN_API = [
  'login', 'logout', 'check', 'cookies', 'users', 'profile', 'logs',
  'password', 'config', 'webhook', 'smtp', 'monitor', '2fa', 'tokens',
  'abuse', 'api-logs', 'public-token',
].join('|')

/** 后端地址 */
const BACKEND = 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 允许局域网访问，方便用手机扫同一个页面
    host: true,
    proxy: {
      '/api': { target: BACKEND },
      [`^/admin/(${ADMIN_API})(/|$)`]: { target: BACKEND },
    },
    /*
     * HMR 的 WebSocket 直接连 Vite 自己：
     * 开发时页面是从后端的 3000 端口打开的（后端把页面请求代理给 Vite），
     * 若 HMR 仍用页面同源，浏览器会连到 3000 —— 而那里没有 WS 处理器。
     * 这里显式指定 HMR 端口，让浏览器直连 Vite，热更新照常工作。
     */
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'ws',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
})

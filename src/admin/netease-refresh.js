/**
 * 网易云 Cookie 自动续签
 *
 * 背景：扫码只是「第一次拿到 MUSIC_U」。要兑现「一次添加、后续自动续签」，
 * 需要定时调用 /api/login/token/refresh 把新的 MUSIC_U 换回来写入。
 *
 * 注意事项：
 *   - 该接口走 weapi（与 NeteaseCloudMusicApi 的 /login/refresh 一致）。
 *   - 只在响应头里给出新 Cookie，所以 request() 要开 returnHeaders。
 *   - 只合并白名单字段；新 Cookie 会先校验一次，校验不过就保留旧值，
 *     避免把平台返回的残缺凭据写坏整个服务。
 *   - 任何日志都不打印 Cookie 内容。
 */

import store from './store.js'
import { request } from '../providers/netease/util.js'
import { validateCookie } from './cookie-validator.js'
import { pairsFromSetCookie, mergeCookiePairs, isSameCookie } from './netease-cookie.js'

const REFRESH_URL = 'https://music.163.com/api/login/token/refresh'
const DEFAULT_INTERVAL_MS = 12 * 60 * 60 * 1000

export class NeteaseCookieRefresher {
    constructor(deps = {}) {
        this.store = deps.store || store
        this.requestFn = deps.request || request
        this.validateFn = deps.validate || validateCookie
        this.now = deps.now || Date.now
        this.intervalMs = deps.intervalMs || DEFAULT_INTERVAL_MS
        this.timer = null
        this.running = false
        this.lastRunAt = null
        this.lastSummary = null
    }

    start(intervalMs = this.intervalMs) {
        if (this.timer) return
        this.intervalMs = intervalMs
        this.timer = setInterval(() => {
            this.refreshAll().catch((error) => {
                console.error('[CookieRefresh] 执行失败:', error.message)
            })
        }, this.intervalMs)
        this.timer.unref?.()
        console.log(`[CookieRefresh] 已启动，每 ${Math.round(this.intervalMs / 3600000)} 小时尝试续签网易云 Cookie`)
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    async refreshAll() {
        if (this.running) return { skipped: true }
        this.running = true
        const summary = { checked: 0, refreshed: 0, failed: 0 }
        try {
            for (const cookie of this.store.getCookies('netease')) {
                if (!cookie.isActive) continue
                summary.checked++
                try {
                    const changed = await this.refreshOne(cookie)
                    if (changed) summary.refreshed++
                } catch (error) {
                    summary.failed++
                    console.warn('[CookieRefresh] 续签失败:', cookie.note || cookie.id, error.message)
                }
            }
        } finally {
            this.running = false
            this.lastRunAt = this.now()
            this.lastSummary = summary
        }
        if (summary.refreshed > 0) {
            console.log(`[CookieRefresh] 续签完成：${summary.refreshed}/${summary.checked}`)
        }
        return summary
    }

    async refreshOne(cookie) {
        if (!cookie?.cookie || !cookie.cookie.includes('MUSIC_U')) return false

        const result = await this.requestFn('POST', REFRESH_URL, {}, {
            crypto: 'weapi',
            cookie: cookie.cookie,
            returnHeaders: true,
        })
        const data = result?.data || result
        if (Number(data?.code) !== 200) return false

        const pairs = pairsFromSetCookie(result?.setCookie)
        if (!pairs.MUSIC_U) return false

        const merged = mergeCookiePairs(cookie.cookie, pairs)
        if (isSameCookie(merged, cookie.cookie)) return false

        const validation = await this.validateFn('netease', merged)
        if (!validation.valid) {
            console.warn('[CookieRefresh] 新 Cookie 校验未通过，保留原值:', cookie.note || cookie.id)
            return false
        }

        const updated = await this.store.updateCookie(cookie.id, {
            cookie: merged,
            isValid: true,
            validatedAt: this.now(),
            userInfo: validation.userInfo || null,
            validationError: null,
        }, 'refresh', true)
        return Boolean(updated?.success)
    }
}

const refresher = new NeteaseCookieRefresher()

export default refresher

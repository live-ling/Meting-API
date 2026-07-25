#!/usr/bin/env node
/**
 * Cookie 定时刷新脚本
 * 用于自动化任务：每个工作日 10:00 AM 验证所有活跃 Cookie 是否有效
 *
 * 使用方式:
 *   node scripts/refresh-cookies.js
 *
 * Linux cron 设置 (每个工作日 10:00):
 *   0 10 * * 1-5 cd /path/to/Meting-API && /usr/bin/node scripts/refresh-cookies.js >> logs/cookie-refresh.log 2>&1
 */

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 切换到项目根目录，确保 store 读取正确的 data 目录
process.chdir(resolve(__dirname, '..'))

import store from '../src/admin/store.js'
import { validateCookie } from '../src/admin/cookie-validator.js'

const platformNames = { netease: '网易云音乐', tencent: 'QQ音乐' }

function log(msg) {
    console.log(`[${new Date().toLocaleString('zh-CN')}] ${msg}`)
}

async function main() {
    log('=== Cookie 定时检查开始 ===')

    const cookies = store.getCookies()
    const activeCookies = cookies.filter(c => c.isActive)

    if (activeCookies.length === 0) {
        log('⚠ 没有活跃的 Cookie，跳过检查。')
        return
    }

    log(`找到 ${activeCookies.length} 个活跃 Cookie，开始逐一验证...\n`)

    let validCount = 0
    let invalidCount = 0
    let vipLostCount = 0

    for (const cookie of activeCookies) {
        const platformName = platformNames[cookie.platform] || cookie.platform
        const name = cookie.note || cookie.id

        process.stdout.write(`  [检查] ${platformName} - ${name} ... `)

        try {
            const result = await validateCookie(cookie.platform, cookie.cookie)
            const wasValid = cookie.isValid
            const nowValid = result.valid
            const wasCanPlayVip = cookie.userInfo?.canPlayVip
            const nowCanPlayVip = result.userInfo?.canPlayVip

            // 更新 cookie 状态到本地存储
            await store.updateCookie(cookie.id, {
                isValid: nowValid,
                validatedAt: Date.now(),
                userInfo: result.userInfo || null,
                validationError: result.error || null
            }, 'cron', true)

            if (nowValid) {
                validCount++
                const status = []
                if (wasValid === false) status.push('已恢复')
                if (nowCanPlayVip === false && wasCanPlayVip === true) {
                    status.push('VIP播放能力丢失,已自动删除')
                    vipLostCount++
                    await store.deleteCookie(cookie.id, 'cron', true)
                } else if (nowCanPlayVip === false && !wasCanPlayVip) {
                    status.push('无法播放VIP')
                }
                console.log(status.length > 0 ? `✅ ${status.join('; ')}` : '✅ 正常')
            } else {
                invalidCount++
                console.log(`❌ 失效 - ${result.error || '未知原因'}`)

                // 记录监控日志
                await store.addMonitorLog({
                    type: 'cookie_invalid',
                    cookieId: cookie.id,
                    platform: cookie.platform,
                    platformName: platformName,
                    note: cookie.note,
                    reason: result.error || 'Cookie已失效'
                })
            }
        } catch (error) {
            invalidCount++
            console.log(`❌ 验证出错 - ${error.message}`)
        }
    }

    console.log('')
    log(`=== 检查完成 | 有效: ${validCount} | 失效: ${invalidCount} | VIP丢失: ${vipLostCount} ===`)
}

main().catch(err => {
    console.error(`[${new Date().toLocaleString('zh-CN')}] 脚本执行失败:`, err)
    process.exit(1)
})

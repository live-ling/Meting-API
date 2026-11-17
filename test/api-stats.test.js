/**
 * 累计调用统计的回归用例（不联网）
 *
 * 背景：仪表盘「总调用数」此前直接取 logs.length，明细一到上限就不再增长，
 * 清空明细后更是归零。现在改为独立累加计数器，本文件把这三件事钉住：
 *   1. 每次 addLog 都让累计数 +1；
 *   2. 清空明细（clearLogs）不影响累计数；
 *   3. 累计数带按状态码 / 按日分解，并落盘。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

let apiLogger

beforeAll(async () => {
    apiLogger = (await import('../src/service/api-logger.js')).default
})

const addOne = (overrides = {}) => {
    apiLogger.addLog({
        ip: '203.0.113.7',
        server: 'netease',
        type: 'url',
        requestId: '347230',
        status: 'success',
        statusCode: 302,
        durationMs: 5,
        ...overrides,
    })
}

describe('累计调用统计', () => {
    it('每次 addLog 都让累计数 +1，且与明细条数解耦', () => {
        const before = apiLogger.getStats()
        addOne()
        addOne({ status: 'error', statusCode: 429, error: 'rate limited' })
        const after = apiLogger.getStats()

        expect(after.total).toBe(before.total + 2)
        expect(after.totals.calls).toBe(before.totals.calls + 2)
        expect(after.totals.success).toBe(before.totals.success + 1)
        expect(after.totals.error).toBe(before.totals.error + 1)
        expect(after.totals.byCode['429']).toBeGreaterThan(0)
        expect(after.retained).toBe(before.retained + 2)
    })

    it('清空明细不影响累计数（清日志 ≠ 抹掉历史）', () => {
        const before = apiLogger.getStats()
        expect(before.retained).toBeGreaterThan(0)
        apiLogger.clearLogs()

        const after = apiLogger.getStats()
        expect(after.retained).toBe(0)
        expect(after.total).toBe(before.total)
        expect(after.totals.calls).toBe(before.totals.calls)

        // 清空之后新来的调用继续累加，而不是从 0 重新数
        addOne()
        expect(apiLogger.getStats().total).toBe(before.total + 1)
    })

    it('累计数带按日分解，且落盘到 api_stats.json', () => {
        const stats = apiLogger.getStats()
        const today = new Date()
        const key = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
        expect(stats.totals.byDay[key]).toBeGreaterThan(0)

        apiLogger.resetTotals() // 立即写盘
        const dataDir = globalThis?.process?.env?.DATA_DIR || './data'
        expect(fs.existsSync(path.join(dataDir, 'api_stats.json'))).toBe(true)
        expect(apiLogger.getStats().total).toBe(0)
    })
})

describe('明细文件不可用时先另存，不静默覆盖', () => {
    it('顶层不是数组 → 生成 api_logs.corrupt-* 副本，且以空明细启动', async () => {
        const os = await import('node:os')
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-logs-'))
        fs.writeFileSync(path.join(tmp, 'api_logs.json'), '{"logs":[{"id":"x"}]}')

        const prev = process.env.DATA_DIR
        process.env.DATA_DIR = tmp
        try {
            vi.resetModules() // DATA_DIR 在模块初始化时读取，必须重新求值
            const mod = await import('../src/service/api-logger.js')
            expect(mod.default.getStats().retained).toBe(0)
            const quarantined = fs.readdirSync(tmp).filter((name) => name.startsWith('api_logs.corrupt-'))
            expect(quarantined.length).toBe(1)
            // 原始字节被完整保留，不是被截断后的空数组
            const kept = fs.readFileSync(path.join(tmp, quarantined[0]), 'utf-8')
            expect(kept).toBe('{"logs":[{"id":"x"}]}')
        } finally {
            if (prev === undefined) delete process.env.DATA_DIR
            else process.env.DATA_DIR = prev
        }
    })
})

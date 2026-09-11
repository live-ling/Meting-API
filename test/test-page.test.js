import { describe, expect, it, vi } from 'vitest'
import { createTestCore } from '../src/test-page/core.js'

const core = createTestCore()

describe('test page offline helpers', () => {
  it('parses repeated timestamps, offsets and translation-safe groups', () => {
    const parsed = core.parseLRC('[offset:500]\n[00:01.00][00:01.50]hello\n[00:01.00]译文')
    expect(parsed.lines).toEqual([{ time: 1.5, text: 'hello\n译文' }, { time: 2, text: 'hello' }])
    expect(core.lyricIndex(parsed.lines, 1.8)).toBe(0)
  })
  it('serializes requests with a minimum 1500ms gap and caches bounded responses', async () => {
    let now = 0; const waits = []; const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: 1 }) }))
    const scheduler = core.createScheduler({ fetcher, now: () => now, sleep: async ms => { waits.push(ms); now += ms }, gap: 1, limit: 1 })
    await Promise.all([scheduler.request('/a'), scheduler.request('/a')])
    expect(fetcher).toHaveBeenCalledTimes(1)
    await scheduler.request('/b')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(waits[0]).toBe(1500)
    expect(scheduler.cacheSize).toBe(1)
  })
  it('persists Retry-After cooldown without retrying', async () => {
    let now = 1000; const storage = { values: {}, getItem(k) { return this.values[k] }, setItem(k, v) { this.values[k] = v } }
    const fetcher = vi.fn(async () => ({ ok: false, status: 429, headers: { get: () => '2' } }))
    const scheduler = core.createScheduler({ fetcher, now: () => now, sleep: async ms => { now += ms }, storage })
    await expect(scheduler.request('/limited')).rejects.toThrow('冷却')
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(scheduler.request('/again')).rejects.toThrow('冷却')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('normalizes only exact same-host API self-links and validates media URLs', () => {
    expect(core.safeURL('/api?type=url', 'https://example.test/test')).toBe('https://example.test/api?type=url')
    expect(core.safeURL('javascript:alert(1)', 'https://example.test/test')).toBe('')
    expect(core.song({ title: '安全', author: '歌手', url: '/api?type=url', lrc: '@inline' }, 'https://example.test/test')).toMatchObject({ name: '安全', artist: '歌手', lrc: '@inline' })
  })
})

/**
 * 首页（/）：只做组装 —— 基础地址 → 能力矩阵 → 提示词 → 区块 → 页面骨架。
 * 具体内容都在 src/pages/home/ 下按职责拆分。
 */

import { get_url } from './util.js'
import { readCapabilities } from './pages/home/capabilities.js'
import { buildPrompt } from './pages/home/prompt.js'
import { homeClientScript } from './pages/home/client.js'
import { renderLayout } from './pages/home/layout.js'
import { heroSection, statsSection, quickStartSection, featureSection } from './pages/home/sections.js'
import { capabilitySection, contractSection, promptSection } from './pages/home/sections.js'

/** 站点根地址：去掉 get_url 带出来的尾部斜杠；缺少完整 Context 时退回 req.url 的 origin */
const homeBase = (c) => {
    try {
        return get_url(c).replace(/\/+$/, '')
    } catch {
        try { return new URL(c.req.url).origin } catch { return '' }
    }
}

export function homePage(c) {
    const base = homeBase(c)
    const capabilities = readCapabilities()
    const prompt = buildPrompt({ base, capabilities })
    const main = [
        heroSection({ base }),
        statsSection(),
        featureSection(),
        capabilitySection(capabilities),
        quickStartSection({ base, capabilities }),
        contractSection(),
        promptSection({ prompt }),
    ].join('\n')

    return c.html(renderLayout({ main, script: homeClientScript(), base }))
}

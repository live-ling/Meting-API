/**
 * 首页（/）：只做组装 —— 基础地址 → 能力矩阵 → 提示词 → 区块 → 页面骨架。
 * 具体内容都在 src/pages/home/ 下按职责拆分。
 */

import { get_public_base } from './util.js'
import { readCapabilities } from './pages/home/capabilities.js'
import { buildPrompt } from './pages/home/prompt.js'
import { homeClientScript } from './pages/home/client.js'
import { renderLayout } from './pages/home/layout.js'
import { heroSection, statsSection, quickStartSection, featureSection } from './pages/home/sections.js'
import { capabilitySection, contractSection, promptSection } from './pages/home/sections.js'

export function homePage(c) {
    // 唯一入口：首页与提示词永远展示同一个地址，不跟随访问域名
    const base = get_public_base()
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

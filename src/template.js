/**
 * /test 试听实验室页面 —— 组装层。
 *
 * 只做三件事：读示例配置 → 渲染静态骨架 → 把「核心 + 交互」两个纯函数内联进 <script>。
 * 版式在 pages/test/layout.js，结构在 markup.js，样式在 styles.js，逻辑在 core.js / client.js。
 */
import example from './example.js'
import { createTestCore } from './pages/test/core.js'
import { mountTestPage } from './pages/test/client.js'
import { renderSections } from './pages/test/markup.js'
import { testPageStyles } from './pages/test/styles.js'
import { renderTestPage } from './pages/test/layout.js'

const html = renderTestPage({
    sections: renderSections(example),
    styles: testPageStyles,
    mount: mountTestPage,
    create: createTestCore,
})

/** Hono 路由处理器：GET /test */
export const handler = c => c.html(html)

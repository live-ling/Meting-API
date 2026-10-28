/**
 * 站点元信息路由
 *
 * 访问日志里 `/robots.txt` 和 `/sitemap.xml` 长期 404（30 天 387 次），
 * 而搜索引擎其实只需要知道「别抓 /api」。这里补两份静态产物：
 * - robots.txt：只禁止 /api，**不写后台路径**（隐藏路径不能公开）
 * - sitemap.xml：只列出两个真正的页面
 */
import { get_url } from '../util.js'

const TEXT_HEADERS = {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'public, max-age=86400',
}

const XML_HEADERS = {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=86400',
}

/** 站点根地址：去掉 `/api`、`/robots.txt` 之类的路径后缀 */
const siteOrigin = (c) => {
    const base = get_url(c)
    try {
        return new URL(base).origin
    } catch {
        return base.replace(/\/+$/, '')
    }
}

export const robotsHandler = (c) => {
    const origin = siteOrigin(c)
    // 注意：后台路径是用户设置的隐藏路径，绝不能写进 robots.txt，
    // 否则等于把入口公开给扫描器。后台的不可收录由响应头 X-Robots-Tag 保证。
    const body = [
        '# Meting-API',
        '# /api 是给播放器/站点调用的数据接口，抓取无意义且会消耗上游配额',
        'User-agent: *',
        'Disallow: /api',
        'Allow: /$',
        'Allow: /test',
        '',
        `Sitemap: ${origin}/sitemap.xml`,
        '',
    ].join('\n')

    return c.body(body, 200, TEXT_HEADERS)
}

export const sitemapHandler = (c) => {
    const origin = siteOrigin(c)
    const today = new Date().toISOString().slice(0, 10)
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${origin}/test</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
</urlset>
`
    return c.body(body, 200, XML_HEADERS)
}

export default { robotsHandler, sitemapHandler }

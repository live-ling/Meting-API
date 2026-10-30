// unknown 共享配额冒烟测试（手工运行：node test/unknown-quota-smoke.mjs）
import mod from '../src/middleware/abuse-detector.js'

const mk = (xff, type, path = '/api') => ({
    req: {
        path,
        url: `http://x${path}${path === '/api' ? `?server=netease&type=${type}&id=a` : ''}`,
        method: 'GET',
        header: (h) =>
            h === 'X-Forwarded-For' ? xff
                : h === 'User-Agent' ? 'Mozilla/5.0'
                    : undefined,
    },
    set: function (k, v) { if (k === 'clientIP') this.__clientIP = v },
    json: (body, status) => ({ status, body }),
    text: (t, status) => ({ status }),
    body: (t, status) => ({ status }),
    status: () => {},
})

// 1) unknown search 共享桶：200 次后 429
let blocked = 0
for (let i = 0; i < 210; i++) {
    const r = await mod(mk('10.0.0.1, 192.168.1.1', 'search'), async () => 'next')
    if (r !== 'next' && r.status === 429) blocked++
}
console.log(`1) unknown search shared quota: ${blocked}/210 blocked (expect 10)`,
    blocked === 10 ? 'PASS' : 'FAIL')

// 2) 公网访客 search 用自己的 300 额度，不受 unknown 桶影响。
// 中间件对放行请求返回 undefined（await next() 的返回值），以 clientIP 是否
// 正确解析为该公网 IP 作为通过标准。
const c2ctx = mk('203.0.113.9, 103.151.172.5', 'search')
await mod(c2ctx, async () => 'next')
const c2pass = c2ctx.__clientIP === '203.0.113.9'
console.log('2) public visitor search:', c2pass ? 'PASS' : 'FAIL',
    `(clientIP=${c2ctx.__clientIP})`)

// 3) unknown 非 search（playlist/lrc/url）不受共享配额限制
const c3 = await mod(mk('192.168.1.1', 'playlist'), async () => 'next')
console.log('3) unknown non-search api:', c3 === 'next' ? 'PASS' : `FAIL ${JSON.stringify(c3)}`)

// 4) unknown 访问页面
const c4 = await mod(mk('10.1.2.3', 'search', '/'), async () => 'next')
console.log('4) unknown page:', c4 === 'next' ? 'PASS' : `FAIL ${JSON.stringify(c4)}`)

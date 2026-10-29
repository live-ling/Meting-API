/**
 * IP 归属地通道注册表。
 *
 * 每个通道只负责「发请求 + 把响应摊平成统一字段」，归一化、缓存、
 * 并发队列与失败回退统一放在 geo.js。后台可以自由启用多个通道并调整顺序。
 *
 * 约定：
 * - needsKey 为 true 的通道没有密钥时自动跳过；
 * - supportsIPv6 为 false 的通道遇到 IPv6 自动跳过（例如 ShowAPI）；
 * - 所有通道失败时才向调用方抛错，错误里带上每个通道的失败原因。
 */

const REQUEST_TIMEOUT = 6000

const SHOWAPI_URL = 'https://route.showapi.com/20-1'
const IPWHOIS_URL = 'https://ipwho.is/'
const IPAPI_URL = 'https://ipapi.co/'
const IPSB_URL = 'https://api.ip.sb/geoip/'

/**
 * @typedef {Object} GeoProviderDef
 * @property {string} id
 * @property {string} label
 * @property {boolean} needsKey
 * @property {boolean} supportsIPv4
 * @property {boolean} supportsIPv6
 * @property {boolean} defaultEnabled
 * @property {number} defaultOrder
 * @property {string} docsUrl
 * @property {string} docsLabel
 * @property {string} note
 */

/** @type {GeoProviderDef[]} */
export const GEO_PROVIDER_DEFS = [
    {
        id: 'showapi',
        label: 'ShowAPI',
        needsKey: true,
        supportsIPv4: true,
        supportsIPv6: false,
        defaultEnabled: true,
        defaultOrder: 10,
        docsUrl: 'https://www.showapi.com/console#/myApp',
        docsLabel: 'ShowAPI 控制台',
        note: '全球 IP 地址查询（20-1），按次计费；仅支持 IPv4，遇到 IPv6 会自动跳过。',
    },
    {
        id: 'ipwhois',
        label: 'ipwho.is',
        needsKey: false,
        supportsIPv4: true,
        supportsIPv6: true,
        defaultEnabled: true,
        defaultOrder: 20,
        docsUrl: 'https://ipwho.is/',
        docsLabel: 'ipwho.is 文档',
        note: '无需密钥，支持 IPv4 / IPv6；默认作为 ShowAPI 的备用通道。',
    },
    {
        id: 'ipapi',
        label: 'ipapi.co',
        needsKey: false,
        supportsIPv4: true,
        supportsIPv6: true,
        defaultEnabled: false,
        defaultOrder: 30,
        docsUrl: 'https://ipapi.co/api/',
        docsLabel: 'ipapi.co 文档',
        note: '无需密钥，免费额度约 1000 次/天；支持 IPv4 / IPv6，字段为英文。',
    },
    {
        id: 'ipsb',
        label: 'ip.sb',
        needsKey: false,
        supportsIPv4: true,
        supportsIPv6: true,
        defaultEnabled: false,
        defaultOrder: 40,
        docsUrl: 'https://ip.sb/api/',
        docsLabel: 'ip.sb API',
        note: '无需密钥，支持 IPv4 / IPv6；公共接口偶发限流。',
    },
]

export const GEO_PROVIDER_MAP = new Map(GEO_PROVIDER_DEFS.map((def) => [def.id, def]))
export const GEO_PROVIDER_IDS = GEO_PROVIDER_DEFS.map((def) => def.id)

const fetchJson = async (url, options = {}, label = '归属地接口', timeoutMs = REQUEST_TIMEOUT) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(url, { ...options, signal: controller.signal })
        if (!response.ok) throw new Error(`${label} HTTP ${response.status}`)
        return await response.json()
    } catch (e) {
        if (e?.name === 'AbortError') throw new Error(`${label} 查询超时`)
        throw e
    } finally {
        clearTimeout(timer)
    }
}

const str = (value) => (value === null || value === undefined ? '' : String(value))
const JSON_HEADERS = {
    accept: 'application/json',
    'user-agent': 'Meting-API/geo (+https://github.com/live-ling/Meting-API)',
}

const requestShowAPI = async (ip, { key, timeoutMs } = {}) => {
    if (!key) throw new Error('未配置 appKey')
    const payload = await fetchJson(
        `${SHOWAPI_URL}?appKey=${encodeURIComponent(key)}`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ ip }).toString(),
        },
        'ShowAPI',
        timeoutMs
    )
    const code = Number(payload?.showapi_res_code)
    if (code !== 0) {
        throw new Error(payload?.showapi_res_error || `ShowAPI 返回错误 ${payload?.showapi_res_code}`)
    }
    const body = payload?.showapi_res_body || {}
    if (body.ret_code !== undefined && Number(body.ret_code) !== 0) {
        throw new Error(`IP 查询失败（ret_code=${body.ret_code}）`)
    }
    if (!body.country && !body.region && !body.city) {
        throw new Error('IP 查询结果为空')
    }
    return {
        country: body.country || body.en_name || '',
        countryCode: body.en_name_short || body.country_code || '',
        region: body.region || '',
        city: body.city || '',
        county: body.county || '',
        isp: body.isp || '',
        continents: body.continents || '',
        cityCode: body.city_code || '',
        lat: str(body.lat),
        lng: str(body.lnt),
        enName: body.en_name || '',
        enNameShort: body.en_name_short || '',
        remark: body.remark || '',
    }
}

const requestIpWhois = async (ip, providerConfig = {}) => {
    const body = await fetchJson(
        `${IPWHOIS_URL}${encodeURIComponent(ip)}`,
        { headers: JSON_HEADERS },
        'ipwho.is',
        providerConfig.timeoutMs
    )
    if (body?.success === false) throw new Error(body?.message || 'ipwho.is 查询失败')
    if (!body?.country && !body?.region && !body?.city) throw new Error('ipwho.is 查询结果为空')
    return {
        country: body.country || '',
        countryCode: body.country_code || '',
        region: body.region || '',
        city: body.city || '',
        county: '',
        isp: body.connection?.isp || body.connection?.org || '',
        continents: body.continent || '',
        cityCode: '',
        lat: str(body.latitude),
        lng: str(body.longitude),
        enName: body.country || '',
        enNameShort: body.country_code || '',
        remark: body.connection?.org && body.connection.org !== body.connection.isp ? body.connection.org : '',
    }
}

const requestIpApi = async (ip, providerConfig = {}) => {
    const body = await fetchJson(
        `${IPAPI_URL}${encodeURIComponent(ip)}/json/`,
        { headers: JSON_HEADERS },
        'ipapi.co',
        providerConfig.timeoutMs
    )
    if (body?.error) throw new Error(body?.reason || 'ipapi.co 查询失败')
    if (!body?.country_name && !body?.region && !body?.city) throw new Error('ipapi.co 查询结果为空')
    return {
        country: body.country_name || '',
        countryCode: body.country_code || '',
        region: body.region || '',
        city: body.city || '',
        county: '',
        isp: body.org || '',
        continents: body.continent_code || '',
        cityCode: '',
        lat: str(body.latitude),
        lng: str(body.longitude),
        enName: body.country_name || '',
        enNameShort: body.country_code || '',
        remark: body.org || '',
    }
}

const requestIpSb = async (ip, providerConfig = {}) => {
    const body = await fetchJson(
        `${IPSB_URL}${encodeURIComponent(ip)}`,
        { headers: JSON_HEADERS },
        'ip.sb',
        providerConfig.timeoutMs
    )
    if (!body?.country && !body?.region && !body?.city) throw new Error('ip.sb 查询结果为空')
    return {
        country: body.country || '',
        countryCode: body.country_code || '',
        region: body.region || '',
        city: body.city || '',
        county: '',
        isp: body.isp || body.organization || '',
        continents: body.continent_code || '',
        cityCode: '',
        lat: str(body.latitude),
        lng: str(body.longitude),
        enName: body.country || '',
        enNameShort: body.country_code || '',
        remark: body.organization && body.organization !== body.isp ? body.organization : '',
    }
}

const REQUESTERS = {
    showapi: requestShowAPI,
    ipwhois: requestIpWhois,
    ipapi: requestIpApi,
    ipsb: requestIpSb,
}

/** 默认通道配置：ShowAPI 主通道 + ipwho.is 备用，其余关闭但可手动启用。 */
export const defaultGeoProviderConfig = () => {
    const out = {}
    for (const def of GEO_PROVIDER_DEFS) {
        out[def.id] = { enabled: def.defaultEnabled, order: def.defaultOrder, key: '' }
    }
    return out
}

/**
 * 把磁盘上的旧配置/稀疏配置补成完整结构。
 * 兼容数组形式 `[{id, enabled, ...}]`。
 */
export const normalizeGeoProviderConfig = (raw) => {
    const out = defaultGeoProviderConfig()
    if (!raw || typeof raw !== 'object') return out
    const source = Array.isArray(raw)
        ? Object.fromEntries(raw.filter((item) => item && item.id).map((item) => [item.id, item]))
        : raw
    for (const def of GEO_PROVIDER_DEFS) {
        const item = source[def.id]
        if (!item || typeof item !== 'object') continue
        if (item.enabled !== undefined) out[def.id].enabled = !!item.enabled
        if (typeof item.key === 'string') out[def.id].key = item.key.trim()
        const order = Number(item.order)
        if (Number.isFinite(order)) out[def.id].order = order
    }
    return out
}

/**
 * 在已有配置上合并一组临时覆盖（后台“保存前先测试”用），
 * 只认已知通道，未提供的字段保持原值。
 */
export const mergeGeoProviderOverrides = (base, overrides) => {
    const out = normalizeGeoProviderConfig(base)
    if (!overrides || typeof overrides !== 'object') return out
    const list = Array.isArray(overrides)
        ? overrides
        : Object.entries(overrides).map(([id, item]) => ({ id, ...(item || {}) }))
    for (const item of list) {
        if (!item || !item.id) continue
        const def = GEO_PROVIDER_MAP.get(item.id)
        if (!def) continue
        if (item.enabled !== undefined) out[def.id].enabled = !!item.enabled
        if (item.order !== undefined) {
            const order = Number(item.order)
            if (Number.isFinite(order)) out[def.id].order = order
        }
        if (item.clearKey) {
            out[def.id].key = ''
        } else if (typeof item.key === 'string' && item.key.trim()) {
            out[def.id].key = item.key.trim()
        }
    }
    return out
}

/** 返回按 order 排序、且已启用的通道（不检查密钥/IPv6）。 */
export const resolveGeoProviders = (config = {}) => {
    const providers = normalizeGeoProviderConfig(config?.providers)
    return GEO_PROVIDER_DEFS
        .map((def) => ({ ...def, ...providers[def.id] }))
        .filter((provider) => provider.enabled)
        .sort((a, b) => a.order - b.order || a.defaultOrder - b.defaultOrder)
}

/** 当前 IP 能否使用该通道：IPv6 兼容性 + 密钥是否齐全。 */
export const isGeoProviderUsable = (provider, ip) => {
    if (!provider) return false
    const isIPv6 = String(ip || '').includes(':')
    if (isIPv6 && !provider.supportsIPv6) return false
    if (!isIPv6 && provider.supportsIPv4 === false) return false
    if (provider.needsKey && !provider.key) return false
    return true
}

/** 真正发起一次通道查询，返回摊平后的字段（不含 ip/source/updatedAt）。 */
export const requestGeoProvider = (id, ip, providerConfig = {}) => {
    const fn = REQUESTERS[id]
    if (!fn) throw new Error(`未知归属地通道: ${id}`)
    return fn(ip, providerConfig)
}

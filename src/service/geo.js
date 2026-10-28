/**
 * IP 归属地。
 *
 * 两级策略：
 * 1. 离线国家库（ip3country）：同步、零成本，日志写入时先用它兜底；
 * 2. ShowAPI 全球 IP 归属地（https://www.showapi.com/openapi/market/20.json）：
 *    异步补齐省/市/运营商，按 IP 缓存到 data/ip_geo_cache.json，重复 IP 只查一次。
 *
 * 在线查询永远不阻塞 /api 响应：api-logger 先写日志，再在后台补全并回填。
 */
import fs from 'fs'
import path from 'path'
import ip3country from 'ip3country'

const DATA_DIR = globalThis?.process?.env?.DATA_DIR || './data'
const CACHE_FILE = 'ip_geo_cache.json'
const SHOWAPI_URL = 'https://route.showapi.com/20-1'
// ShowAPI 的 IPv4 库不支持 IPv6（ret_code=-1, "ip格式不正确"）。
// IPv6 与 ShowAPI 失败时回退到 ipwho.is：无需 key，字段结构化，支持 IPv6。
const IPWHOIS_URL = 'https://ipwho.is/'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000
const NEGATIVE_TTL = 10 * 60 * 1000
const MAX_CACHE = 5000
const MAX_PENDING = 200
const MAX_CONCURRENT = 2
const REQUEST_TIMEOUT = 6000

let ready = false
try {
  ip3country.init()
  ready = true
} catch {
  ready = false
}

/** @type {Map<string, {country:string,countryCode:string,region:string,city:string,isp:string,source:string,updatedAt:number}>} */
const cache = new Map()
/** @type {Map<string, {message:string,at:number}>} */
const negativeCache = new Map()
/** @type {Map<string, Promise<any>>} */
const inFlight = new Map()
const queue = []
let active = 0
let saveTimer = null

const ensureDir = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch (_) {}
}

const saveNow = () => {
  ensureDir()
  try {
    const data = Object.fromEntries(cache)
    fs.writeFileSync(path.join(DATA_DIR, CACHE_FILE), JSON.stringify(data, null, 2))
  } catch (e) {
    console.log('[Geo] 保存 IP 缓存失败:', e.message)
  }
}

const scheduleSave = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 2000)
}

const normalizeEntry = (entry) => ({
  ip: String(entry?.ip || ''),
  country: String(entry?.country || ''),
  countryCode: String(entry?.countryCode || '').toUpperCase(),
  region: String(entry?.region || ''),
  city: String(entry?.city || ''),
  county: String(entry?.county || ''),
  isp: String(entry?.isp || ''),
  continents: String(entry?.continents || ''),
  cityCode: String(entry?.cityCode || ''),
  lat: String(entry?.lat || ''),
  lng: String(entry?.lng || ''),
  enName: String(entry?.enName || ''),
  enNameShort: String(entry?.enNameShort || ''),
  remark: String(entry?.remark || ''),
  source: String(entry?.source || 'showapi'),
  updatedAt: Number(entry?.updatedAt) || 0,
})

const loadCache = () => {
  ensureDir()
  const filePath = path.join(DATA_DIR, CACHE_FILE)
  try {
    if (!fs.existsSync(filePath)) return
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const now = Date.now()
    for (const [ip, entry] of Object.entries(raw || {})) {
      if (!entry || typeof entry !== 'object') continue
      const normalized = normalizeEntry(entry)
      if (!normalized.updatedAt || now - normalized.updatedAt > CACHE_TTL) continue
      cache.set(ip, normalized)
    }
  } catch (e) {
    console.log('[Geo] 加载 IP 缓存失败:', e.message)
  }
}

const pruneCache = () => {
  if (cache.size <= MAX_CACHE) return
  const sorted = [...cache.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)
  const removeCount = cache.size - MAX_CACHE
  for (let i = 0; i < removeCount; i++) cache.delete(sorted[i][0])
}

/** @param {string} ip @returns {string} 两位国家代码，如 CN / US；未知返回 '' */
export const geoCountry = (ip) => {
  if (!ready || !ip || ip === 'unknown') return ''
  try {
    return ip3country.lookupStr(ip) || ''
  } catch {
    return ''
  }
}

export const geoAvailable = () => ready

const normalizeIP = (ip) => {
  if (!ip || typeof ip !== 'string') return ''
  let value = ip.trim()
  if (value.startsWith('::ffff:') && value.includes('.')) value = value.slice(7)
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
  return value
}

const isIPv4 = (ip) => {
  const parts = ip.split('.')
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

const isPrivateIPv4 = (ip) => {
  const [a, b, c] = ip.split('.').map(Number)
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 198 && b === 51 && c === 100) return true
  if (a === 203 && b === 0 && c === 113) return true
  if (a >= 224) return true
  return false
}

export const isPublicIP = (ip) => {
  if (!ip) return false
  if (isIPv4(ip)) return !isPrivateIPv4(ip)
  if (!ip.includes(':')) return false
  const lower = ip.toLowerCase()
  if (lower === '::' || lower === '::1') return false
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return false
  if (lower.startsWith('2001:db8')) return false
  return /^[0-9a-f:]+$/.test(lower)
}

const countryCodeFrom = (body, ip) => {
  const raw = String(body?.en_name_short || body?.country_code || '').trim().toUpperCase()
  if (raw && raw.length <= 3) return raw
  return geoCountry(ip)
}

const requestShowAPI = async (ip, key) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(`${SHOWAPI_URL}?appKey=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ip }).toString(),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`ShowAPI HTTP ${response.status}`)
    const payload = await response.json()
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
    return normalizeEntry({
      ip,
      country: body.country || body.en_name || '',
      countryCode: countryCodeFrom(body, ip),
      region: body.region || '',
      city: body.city || '',
      county: body.county || '',
      isp: body.isp || '',
      continents: body.continents || '',
      cityCode: body.city_code || '',
      lat: body.lat || '',
      lng: body.lnt || '',
      enName: body.en_name || '',
      enNameShort: body.en_name_short || '',
      remark: body.remark || '',
      source: 'showapi',
      updatedAt: Date.now(),
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('IP 查询超时')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** IPv6 / ShowAPI 失败时的备用归属地查询：ipwho.is，无需 key。 */
const requestIpWhois = async (ip) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(`${IPWHOIS_URL}${encodeURIComponent(ip)}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`ipwho.is HTTP ${response.status}`)
    const body = await response.json()
    if (body?.success === false) throw new Error(body?.message || 'ipwho.is 查询失败')
    if (!body?.country && !body?.region && !body?.city) throw new Error('ipwho.is 查询结果为空')
    return normalizeEntry({
      ip,
      country: body.country || '',
      countryCode: body.country_code || '',
      region: body.region || '',
      city: body.city || '',
      county: '',
      isp: body.connection?.isp || body.connection?.org || '',
      continents: body.continent || '',
      cityCode: '',
      lat: body.latitude != null ? String(body.latitude) : '',
      lng: body.longitude != null ? String(body.longitude) : '',
      enName: body.country || '',
      enNameShort: body.country_code || '',
      remark: body.connection?.org && body.connection.org !== body.connection.isp ? body.connection.org : '',
      source: 'ipwhois',
      updatedAt: Date.now(),
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('备用 IP 查询超时')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** 先走 ShowAPI；IPv6 直接走备用接口，IPv4 失败也回退。 */
const requestGeo = async (ip, key) => {
  if (ip.includes(':')) return requestIpWhois(ip)
  try {
    return await requestShowAPI(ip, key)
  } catch (primary) {
    try {
      const fallback = await requestIpWhois(ip)
      console.log('[Geo] ShowAPI 失败，已回退 ipwho.is:', primary.message)
      return fallback
    } catch (fallbackError) {
      throw new Error(`${primary.message}；备用接口失败：${fallbackError.message}`)
    }
  }
}

const pumpQueue = () => {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()
    active++
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        active--
        pumpQueue()
      })
  }
}

const enqueue = (task) => new Promise((resolve, reject) => {
  if (queue.length >= MAX_PENDING) {
    reject(new Error('IP 查询队列已满'))
    return
  }
  queue.push({ task, resolve, reject })
  pumpQueue()
})

/** 读取仍在有效期内的缓存；过期条目会被顺手删除。 */
export const getCachedGeo = (ip) => {
  const normalized = normalizeIP(ip)
  if (!normalized) return null
  const entry = cache.get(normalized)
  if (!entry) return null
  if (Date.now() - entry.updatedAt > CACHE_TTL) {
    cache.delete(normalized)
    scheduleSave()
    return null
  }
  return entry
}

/** 把省/市拼成一行；没有省市时退回国家名。 */
export const geoLabel = (entry) => {
  if (!entry) return ''
  const parts = [entry.region, entry.city].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return entry.country || entry.countryCode || ''
}

/**
 * 查询一个 IP（带本地缓存 + 并发队列）。未配置密钥或被禁用时直接返回 null。
 * @param {string} ip
 * @param {{enabled?:boolean,key?:string}} config
 */
export const lookupGeo = (ip, config = {}) => {
  const normalized = normalizeIP(ip)
  if (!normalized || config.enabled === false) return Promise.resolve(null)
  // IPv6 不需要 ShowAPI key（走 ipwho.is）；IPv4 没 key 时保持关闭在线查询
  if (!config.key && !normalized.includes(':')) return Promise.resolve(null)
  if (!isPublicIP(normalized)) return Promise.resolve(null)

  const cached = getCachedGeo(normalized)
  if (cached) return Promise.resolve(cached)

  const negative = negativeCache.get(normalized)
  if (negative && Date.now() - negative.at < NEGATIVE_TTL) return Promise.resolve(null)
  if (inFlight.has(normalized)) return inFlight.get(normalized)

  const key = config.key ? String(config.key).trim() : ''
  const promise = enqueue(() => requestGeo(normalized, key))
    .then((entry) => {
      cache.set(normalized, entry)
      negativeCache.delete(normalized)
      pruneCache()
      scheduleSave()
      return entry
    })
    .catch((e) => {
      negativeCache.set(normalized, { message: e?.message || '查询失败', at: Date.now() })
      throw e
    })
    .finally(() => inFlight.delete(normalized))

  inFlight.set(normalized, promise)
  return promise
}

/** 后台设置页的“测试查询”：绕过缓存；IPv4 用 ShowAPI，IPv6 用 ipwho.is。 */
export const queryShowAPI = async (ip, key) => {
  const normalized = normalizeIP(ip)
  const hasKey = key && String(key).trim()
  if (!hasKey && normalized && !normalized.includes(':')) return { success: false, error: '请先填写 ShowAPI appKey' }
  if (!normalized || !isPublicIP(normalized)) {
    return { success: false, error: '请输入公网 IPv4 / IPv6 地址' }
  }
  try {
    const data = await requestGeo(normalized, hasKey ? String(key).trim() : '')
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e?.message || '查询失败' }
  }
}

export const getGeoCacheStats = () => ({
  size: cache.size,
  ttlDays: Math.round(CACHE_TTL / (24 * 60 * 60 * 1000)),
})

export const clearGeoCache = () => {
  cache.clear()
  negativeCache.clear()
  if (saveTimer) clearTimeout(saveTimer)
  saveNow()
  return true
}

loadCache()

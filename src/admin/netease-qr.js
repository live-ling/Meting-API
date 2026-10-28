/**
 * 网易云扫码登录会话管理
 *
 * 走的是新版桌面端扫码接口：`interface.music.163.com/api/login/qrcode/*`，
 * 明文表单 `type=3`。老的 `music.163.com/weapi` + `type=1` 现在会被风控拦截，
 * 表现为扫码确认后返回 8821 / -462（「请切换其他登录方式或升级新版本再试」），
 * 前端看起来就是「授权后没反应」。
 *
 * 设计要点：
 *   1. unikey 只活在服务端内存里，绝不回传给浏览器。
 *   2. 浏览器只拿到 sessionId + 已渲染好的二维码图片（data URL）。
 *   3. 会话绑定发起人，TTL 180 秒，一次性；803 成功后先校验再入库。
 *   4. 整个会话复用同一份 Cookie（_ntes_nuid / NMTID）与真实出口 IP，
 *      不伪造 X-Forwarded-For，身份稳定。
 *   5. 8821 / -462 明确报错，不再静默空转。
 *
 * 依赖全部可注入，方便单测里替换掉真实网络与 store。
 */

import { request } from '../providers/netease/util.js'
import { validateCookie } from './cookie-validator.js'
import store from './store.js'
import { pairsFromSetCookie, pairsFromCookieString, mergeCookiePairs } from './netease-cookie.js'

export const QR_SESSION_TTL_MS = 180 * 1000
export const QR_EXPIRED_CODE = 800
export const QR_WAITING_CODE = 801
export const QR_SCANNED_CODE = 802
export const QR_CONFIRMED_CODE = 803
/** 风控：要求行为验证 / 请换登录方式 */
export const QR_RISK_CODES = [8821, -462]

/** 新版桌面端扫码登录的类型 */
const QR_TYPE = 3
const UNIKEY_URL = 'https://interface.music.163.com/api/login/qrcode/unikey'
const CHECK_URL = 'https://interface.music.163.com/api/login/qrcode/client/login'
const LOGIN_PAGE = 'https://music.163.com/login?codekey='

export class QrLoginError extends Error {
    constructor(message, status = 502, code = 'qr_error') {
        super(message)
        this.name = 'QrLoginError'
        this.status = status
        this.code = code
    }
}

const randomId = () => (
    globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2)
)

const randomDeviceId = () => randomId().replace(/-/g, '')

const toCookieHeader = (jar) => Object.entries(jar)
    .map(([name, value]) => name + '=' + value)
    .join('; ')

const defaultQrEncode = async (text) => {
    const QRCode = (await import('qrcode')).default
    return QRCode.toDataURL(text, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: 'M',
    })
}

export const createQrLoginManager = (deps = {}) => {
    const requestFn = deps.request || request
    const validateFn = deps.validate || validateCookie
    const storeRef = deps.store || store
    const qrEncode = deps.qrEncode || defaultQrEncode
    const now = deps.now || Date.now
    const ttl = deps.ttl || QR_SESSION_TTL_MS

    const sessions = new Map()
    const userIndex = new Map()

    const drop = (id) => {
        const session = sessions.get(id)
        if (!session) return
        sessions.delete(id)
        if (userIndex.get(session.username) === id) userIndex.delete(session.username)
    }

    const purge = () => {
        for (const session of sessions.values()) {
            if (session.expiresAt <= now()) drop(session.id)
        }
    }

    const view = (session) => ({
        sessionId: session.id,
        qrDataUrl: session.qrDataUrl,
        status: session.status,
        expiresIn: Math.max(0, Math.ceil((session.expiresAt - now()) / 1000)),
    })

    const persist = async (username, cookieString, userInfo) => {
        const userId = userInfo?.userId
        const existing = storeRef.getCookies('netease').find((item) => (
            userId != null &&
            item.userInfo?.userId != null &&
            String(item.userInfo.userId) === String(userId)
        ))

        if (existing) {
            const result = await storeRef.updateCookie(existing.id, {
                cookie: cookieString,
                isActive: true,
                isValid: true,
                validatedAt: now(),
                userInfo: userInfo || null,
                validationError: null,
            }, username, true)
            if (!result?.success) throw new QrLoginError(result?.error || '保存 Cookie 失败', 500)
            return existing.id
        }

        const created = await storeRef.addCookie('netease', cookieString, '扫码添加', username, true)
        if (!created?.success) throw new QrLoginError(created?.error || '保存 Cookie 失败', 500)
        await storeRef.updateCookie(created.data.id, {
            isValid: true,
            validatedAt: now(),
            userInfo: userInfo || null,
            validationError: null,
        }, username, true)
        return created.data.id
    }

    const create = async (username) => {
        if (!username) throw new QrLoginError('缺少用户身份', 401)

        purge()
        const currentId = userIndex.get(username)
        const current = currentId ? sessions.get(currentId) : null
        if (current && (current.status === 'waiting' || current.status === 'scanned')) {
            return view(current)
        }
        if (current) drop(current.id)

        // 固定客户端身份：整个会话复用同一个 _ntes_nuid，并带上接口下发的 NMTID
        const cookieSeed = { _ntes_nuid: randomDeviceId() }
        let result
        try {
            result = await requestFn('POST', UNIKEY_URL, { type: QR_TYPE }, {
                cookie: toCookieHeader(cookieSeed),
                spoofIp: false,
                returnHeaders: true,
            })
        } catch (error) {
            throw new QrLoginError('连接网易云失败，请稍后重试')
        }
        const data = result?.data || result
        if (!data?.unikey) throw new QrLoginError('获取二维码失败，请稍后重试')

        const qrDataUrl = await qrEncode(LOGIN_PAGE + data.unikey)
        const session = {
            id: randomId(),
            username,
            unikey: data.unikey,
            qrDataUrl,
            status: 'waiting',
            createdAt: now(),
            expiresAt: now() + ttl,
            userInfo: null,
            cookieId: null,
            error: null,
            cookies: { ...cookieSeed, ...pairsFromSetCookie(result?.setCookie) },
            lastCode: null,
        }
        sessions.set(session.id, session)
        userIndex.set(username, session.id)
        return view(session)
    }

    const pollOnce = async (session) => {
        const result = await requestFn('POST', CHECK_URL, { key: session.unikey, type: QR_TYPE }, {
            cookie: toCookieHeader(session.cookies),
            spoofIp: false,
            returnHeaders: true,
        })
        const data = result?.data || result
        // NMTID 这类会话 Cookie 每次都可能刷新，持续带上
        Object.assign(session.cookies, pairsFromSetCookie(result?.setCookie))
        return { result, data, code: Number(data?.code) }
    }

    const logCode = (session, code) => {
        if (session.lastCode === code) return
        console.log(`[NeteaseQR] 扫码状态 ${session.lastCode ?? '-'} -> ${code}`)
        session.lastCode = code
    }

    const check = async (sessionId, username) => {
        const session = sessions.get(sessionId)
        if (!session || session.username !== username) {
            throw new QrLoginError('二维码会话不存在或已过期', 404)
        }
        if (session.status === 'confirmed') {
            return { status: 'confirmed', userInfo: session.userInfo, cookieId: session.cookieId, code: QR_CONFIRMED_CODE }
        }
        if (session.status === 'failed') {
            return { status: 'failed', error: session.error, code: session.lastCode }
        }
        if (session.expiresAt <= now()) {
            drop(session.id)
            return { status: 'expired', code: QR_EXPIRED_CODE }
        }

        let polled
        try {
            polled = await pollOnce(session)
        } catch (error) {
            throw new QrLoginError('查询扫码状态失败，请稍后重试')
        }
        const { result, data, code } = polled
        logCode(session, code)

        if (QR_RISK_CODES.includes(code)) {
            session.status = 'failed'
            session.error = '网易云要求完成行为验证（' + code + '），请稍后重试，或改用网页登录后在「手动添加」里粘贴 Cookie'
            return { status: 'failed', error: session.error, code }
        }
        if (code === QR_EXPIRED_CODE) {
            drop(session.id)
            return { status: 'expired', code }
        }
        if (code === QR_SCANNED_CODE) {
            session.status = 'scanned'
            return { status: 'scanned', code }
        }
        if (code !== QR_CONFIRMED_CODE) {
            return { status: 'waiting', code }
        }

        // 803 的凭据可能出现在 Set-Cookie，也可能在 body.cookie 字段
        const pairs = {
            ...pairsFromSetCookie(result?.setCookie),
            ...pairsFromCookieString(data?.cookie),
        }
        if (!pairs.MUSIC_U) {
            const names = (result?.setCookie || []).map((item) => String(item).split('=')[0]).join(',')
            console.warn('[NeteaseQR] 803 但未解析到 MUSIC_U，Set-Cookie 字段:', names || '(空)')
            session.status = 'failed'
            session.error = '登录成功但未取到 MUSIC_U，请重新扫码'
            return { status: 'failed', error: session.error, code }
        }

        session.cookies = { ...session.cookies, ...pairs }
        const cookieString = mergeCookiePairs('', pairs)
        const validation = await validateFn('netease', cookieString)
        if (!validation.valid) {
            session.status = 'failed'
            session.error = validation.error || 'Cookie 校验未通过'
            return { status: 'failed', error: session.error, code }
        }

        const cookieId = await persist(session.username, cookieString, validation.userInfo)
        session.status = 'confirmed'
        session.userInfo = validation.userInfo
        session.cookieId = cookieId
        return { status: 'confirmed', userInfo: validation.userInfo, cookieId, code }
    }

    const cancel = (sessionId, username) => {
        const session = sessions.get(sessionId)
        if (session && session.username === username) drop(sessionId)
        return { success: true }
    }

    return {
        create,
        check,
        cancel,
        purge,
        // 仅供测试观察内部状态
        _sessions: sessions,
    }
}

const manager = createQrLoginManager()

if (typeof setInterval === 'function') {
    const timer = setInterval(() => manager.purge(), 60 * 1000)
    timer.unref?.()
}

export default manager

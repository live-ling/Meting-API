import { get_runtime } from '../util.js'
import { validateCookie as validateCookieOnline } from './cookie-validator.js'
import {
    DEFAULT_LOGIN_BG_API,
    DEFAULT_LOGIN_BG_TTL_HOURS,
    LOGIN_BG_TTL_MIN_HOURS,
    LOGIN_BG_TTL_MAX_HOURS,
    LOGIN_BG_URL_MAX_LENGTH,
} from './login-bg-config.js'
import {
    CACHE_TYPES,
    CACHE_TTL_MIN_SECONDS,
    CACHE_TTL_MAX_SECONDS,
    CACHE_MAX_ENTRIES_MIN,
    CACHE_MAX_ENTRIES_MAX,
} from '../service/cache-config.js'

const runtime = get_runtime()

const isServerRuntime = ['node', 'deno', 'bun'].includes(runtime)

let fs, path, nodeCrypto

if (isServerRuntime && runtime === 'node') {
    fs = await import('fs')
    path = await import('path')
    nodeCrypto = await import('crypto')
}

const DATA_DIR = globalThis?.process?.env?.DATA_DIR || './data'
const COOKIES_FILE = 'cookies.json'
const USERS_FILE = 'users.json'
const LOGS_FILE = 'logs.json'
const SECURITY_FILE = 'security.json'
const CONFIG_FILE = 'config.json'
const MONITOR_LOGS_FILE = 'monitor_logs.json'
const API_TOKENS_FILE = 'api_tokens.json'
const ABUSE_LOGS_FILE = 'abuse_logs.json'
const IP_BANS_FILE = 'ip_bans.json'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000

const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let secret = ''
    const bytes = nodeCrypto.randomBytes(20)
    for (let i = 0; i < 16; i++) {
        secret += chars[bytes[i] % chars.length]
    }
    return secret
}

const generateTOTP = (secret) => {
    const key = base32Decode(secret)
    const counter = Math.floor(Date.now() / 1000 / 30)
    const counterBytes = Buffer.alloc(8)
    counterBytes.writeUInt32BE(0, 0)
    counterBytes.writeUInt32BE(counter, 4)
    const hmac = nodeCrypto.createHmac('sha1', key).update(counterBytes).digest()
    const offset = hmac[hmac.length - 1] & 0x0f
    const binary = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    const otp = binary % 1000000
    return otp.toString().padStart(6, '0')
}

const generateTOTPForCounter = (secret, counter) => {
    const key = base32Decode(secret)
    const counterBytes = Buffer.alloc(8)
    counterBytes.writeUInt32BE(0, 0)
    counterBytes.writeUInt32BE(counter, 4)
    const hmac = nodeCrypto.createHmac('sha1', key).update(counterBytes).digest()
    const offset = hmac[hmac.length - 1] & 0x0f
    const binary = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    const otp = binary % 1000000
    return otp.toString().padStart(6, '0')
}

const base32Decode = (str) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    str = str.replace(/=+$/, '')
    const bytes = []
    let buffer = 0, bitsLeft = 0
    for (let i = 0; i < str.length; i++) {
        const val = alphabet.indexOf(str[i].toUpperCase())
        if (val === -1) continue
        buffer = (buffer << 5) | val
        bitsLeft += 5
        if (bitsLeft >= 8) {
            bitsLeft -= 8
            bytes.push((buffer >> bitsLeft) & 0xff)
        }
    }
    return Buffer.from(bytes)
}

class DataStore {
    constructor() {
        this.cookies = new Map()
        this.users = new Map()
        this.logs = []
        this.loginAttempts = new Map()
        this.lockedAccounts = new Map()
        this.config = {}
        this.monitorLogs = []
        this.apiTokens = new Map()
        this.abuseLogs = []
        this.ipBans = new Map()
        this.initialized = false
    }

    async init() {
        if (this.initialized) return
        
        if (isServerRuntime && runtime === 'node') {
            try {
                if (!fs.existsSync(DATA_DIR)) {
                    fs.mkdirSync(DATA_DIR, { recursive: true })
                }
                await this.loadFromFile()
            } catch (e) {
                console.log('DataStore init:', e.message)
            }
        }
        
        if (this.users.size === 0) {
            this.users.set('admin', {
                username: 'admin',
                password: this.hashPassword('admin123'),
                role: 'admin',
                createdAt: Date.now()
            })
            await this.saveToFile()
        }
        
        this.initialized = true
    }

    hashPassword(password, salt = null) {
        if (!salt) {
            salt = nodeCrypto.randomBytes(16).toString('hex')
        }
        const derivedKey = nodeCrypto.scryptSync(password, salt, 64).toString('hex')
        return `scrypt:${salt}:${derivedKey}`
    }

    verifyPassword(password, storedHash) {
        if (!storedHash) return false
        if (storedHash.startsWith('scrypt:')) {
            const parts = storedHash.split(':')
            if (parts.length !== 3) return false
            const newHash = this.hashPassword(password, parts[1])
            return newHash === storedHash
        }
        const legacyHash = ((password) => {
            let hash = 0
            for (let i = 0; i < password.length; i++) {
                const char = password.charCodeAt(i)
                hash = ((hash << 5) - hash) + char
                hash = hash & hash
            }
            return hash.toString(16)
        })(password)
        return legacyHash === storedHash
    }

    migratePasswordHash(username, password) {
        const user = this.users.get(username)
        if (user && user.password && !user.password.startsWith('scrypt:')) {
            user.password = this.hashPassword(password)
            this.users.set(username, user)
            this.saveToFile()
        }
    }

    async loadFromFile() {
        if (runtime !== 'node') return
        
        try {
            const cookiesPath = path.join(DATA_DIR, COOKIES_FILE)
            if (fs.existsSync(cookiesPath)) {
                const data = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'))
                this.cookies = new Map(Object.entries(data))
            }
            
            const usersPath = path.join(DATA_DIR, USERS_FILE)
            if (fs.existsSync(usersPath)) {
                const data = JSON.parse(fs.readFileSync(usersPath, 'utf-8'))
                this.users = new Map(Object.entries(data))
            }
            
            const logsPath = path.join(DATA_DIR, LOGS_FILE)
            if (fs.existsSync(logsPath)) {
                this.logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8'))
            }
            
            const securityPath = path.join(DATA_DIR, SECURITY_FILE)
            if (fs.existsSync(securityPath)) {
                const data = JSON.parse(fs.readFileSync(securityPath, 'utf-8'))
                this.loginAttempts = new Map(Object.entries(data.loginAttempts || {}))
                this.lockedAccounts = new Map(Object.entries(data.lockedAccounts || {}))
            }
            
            const configPath = path.join(DATA_DIR, CONFIG_FILE)
            if (fs.existsSync(configPath)) {
                this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            }
            
            const monitorLogsPath = path.join(DATA_DIR, MONITOR_LOGS_FILE)
            if (fs.existsSync(monitorLogsPath)) {
                this.monitorLogs = JSON.parse(fs.readFileSync(monitorLogsPath, 'utf-8'))
            }
            
            const apiTokensPath = path.join(DATA_DIR, API_TOKENS_FILE)
            if (fs.existsSync(apiTokensPath)) {
                const data = JSON.parse(fs.readFileSync(apiTokensPath, 'utf-8'))
                this.apiTokens = new Map(Object.entries(data))
            }

            const abuseLogsPath = path.join(DATA_DIR, ABUSE_LOGS_FILE)
            if (fs.existsSync(abuseLogsPath)) {
                this.abuseLogs = JSON.parse(fs.readFileSync(abuseLogsPath, 'utf-8'))
            }

            const ipBansPath = path.join(DATA_DIR, IP_BANS_FILE)
            if (fs.existsSync(ipBansPath)) {
                const data = JSON.parse(fs.readFileSync(ipBansPath, 'utf-8'))
                this.ipBans = new Map(Object.entries(data))
            }
        } catch (e) {
            console.error('Load data error:', e.message)
        }
    }

    async saveToFile() {
        if (runtime !== 'node') return
        
        try {
            const cookiesPath = path.join(DATA_DIR, COOKIES_FILE)
            fs.writeFileSync(cookiesPath, JSON.stringify(Object.fromEntries(this.cookies), null, 2))
            
            const usersPath = path.join(DATA_DIR, USERS_FILE)
            fs.writeFileSync(usersPath, JSON.stringify(Object.fromEntries(this.users), null, 2))
            
            const logsPath = path.join(DATA_DIR, LOGS_FILE)
            const recentLogs = this.logs.slice(-1000)
            fs.writeFileSync(logsPath, JSON.stringify(recentLogs, null, 2))
            
            const securityPath = path.join(DATA_DIR, SECURITY_FILE)
            const securityData = {
                loginAttempts: Object.fromEntries(this.loginAttempts),
                lockedAccounts: Object.fromEntries(this.lockedAccounts)
            }
            fs.writeFileSync(securityPath, JSON.stringify(securityData, null, 2))
            
            const configPath = path.join(DATA_DIR, CONFIG_FILE)
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2))
            
            const monitorLogsPath = path.join(DATA_DIR, MONITOR_LOGS_FILE)
            const recentMonitorLogs = this.monitorLogs.slice(-500)
            fs.writeFileSync(monitorLogsPath, JSON.stringify(recentMonitorLogs, null, 2))
            
            const apiTokensPath = path.join(DATA_DIR, API_TOKENS_FILE)
            fs.writeFileSync(apiTokensPath, JSON.stringify(Object.fromEntries(this.apiTokens), null, 2))

            const abuseLogsPath = path.join(DATA_DIR, ABUSE_LOGS_FILE)
            const recentAbuseLogs = this.abuseLogs.slice(-1000)
            fs.writeFileSync(abuseLogsPath, JSON.stringify(recentAbuseLogs, null, 2))

            const ipBansPath = path.join(DATA_DIR, IP_BANS_FILE)
            const banData = {}
            for (const [ip, ban] of this.ipBans) {
                banData[ip] = ban
            }
            fs.writeFileSync(ipBansPath, JSON.stringify(banData, null, 2))
        } catch (e) {
            console.error('Save data error:', e.message)
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
    }

    async addLog(action, details, username = 'system') {
        const log = {
            id: this.generateId(),
            action,
            details,
            username,
            timestamp: Date.now(),
            ip: ''
        }
        this.logs.push(log)
        
        if (this.logs.length % 10 === 0) {
            await this.saveToFile()
        }
        
        return log
    }

    getLogs(limit = 100, offset = 0) {
        return this.logs
            .slice()
            .reverse()
            .slice(offset, offset + limit)
    }

    async clearLogs() {
        const count = this.logs.length
        this.logs = []
        await this.saveToFile()
        return { success: true, data: { count } }
    }

    validateCookieFormat(platform, cookieData) {
        if (!platform || !['netease', 'tencent'].includes(platform)) {
            return { valid: false, error: '无效的平台类型' }
        }

        if (!cookieData || typeof cookieData !== 'string') {
            return { valid: false, error: 'Cookie数据不能为空' }
        }

        if (cookieData.length < 10) {
            return { valid: false, error: 'Cookie数据格式不正确' }
        }

        if (platform === 'netease') {
            if (!cookieData.includes('MUSIC_U') && !cookieData.includes('MUSIC_A')) {
                return { valid: false, error: '网易云音乐Cookie需要包含MUSIC_U或MUSIC_A' }
            }
        }

        if (platform === 'tencent') {
            if (!cookieData.includes('uin') && !cookieData.includes('qqmusic_key')) {
                return { valid: false, error: 'QQ音乐Cookie需要包含uin或qqmusic_key' }
            }
        }

        return { valid: true }
    }

    async addCookie(platform, cookieData, note = '', username = 'system', skipValidation = false) {
        const formatValidation = this.validateCookieFormat(platform, cookieData)
        if (!formatValidation.valid) {
            return { success: false, error: formatValidation.error }
        }

        if (note) {
            for (const [existingId, existingCookie] of this.cookies) {
                if (existingCookie.platform === platform && existingCookie.note === note) {
                    const updateResult = await this.updateCookie(existingId, { cookie: cookieData, note }, username, skipValidation)
                    if (updateResult.success) {
                        await this.addLog('cookie_update', `覆盖${platform} Cookie: ${note}`, username)
                    }
                    return updateResult
                }
            }
        }

        const id = this.generateId()
        const cookie = {
            id,
            platform,
            cookie: cookieData,
            note,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: username,
            isActive: true,
            isValid: null,
            validatedAt: null,
            userInfo: null,
            validationError: null
        }

        if (!skipValidation) {
            const onlineValidation = await validateCookieOnline(platform, cookieData)
            cookie.isValid = onlineValidation.valid
            cookie.validatedAt = Date.now()
            cookie.userInfo = onlineValidation.userInfo
            cookie.validationError = onlineValidation.error

            if (!onlineValidation.valid) {
                return { 
                    success: false, 
                    error: `Cookie验证失败: ${onlineValidation.error}`,
                    validationError: onlineValidation.error
                }
            }
        }
        
        this.cookies.set(id, cookie)
        await this.addLog('cookie_add', `添加${platform} Cookie: ${note || id}`, username)
        await this.saveToFile()
        
        return { success: true, data: cookie }
    }

    async verifyCookie(id, username = 'system') {
        const cookie = this.cookies.get(id)
        if (!cookie) {
            return { success: false, error: 'Cookie不存在' }
        }

        const validation = await validateCookieOnline(cookie.platform, cookie.cookie)
        
        cookie.isValid = validation.valid
        cookie.validatedAt = Date.now()
        cookie.userInfo = validation.userInfo
        cookie.validationError = validation.error
        cookie.updatedAt = Date.now()
        
        this.cookies.set(id, cookie)
        await this.addLog('cookie_verify', `验证${cookie.platform} Cookie: ${cookie.note || id} - ${validation.valid ? '有效' : '无效'}`, username)
        await this.saveToFile()
        
        return { 
            success: true, 
            data: {
                id: cookie.id,
                isValid: cookie.isValid,
                validatedAt: cookie.validatedAt,
                userInfo: cookie.userInfo,
                validationError: cookie.validationError
            }
        }
    }

    async updateCookie(id, updates, username = 'system', skipValidation = false) {
        const cookie = this.cookies.get(id)
        if (!cookie) {
            return { success: false, error: 'Cookie不存在' }
        }

        if (updates.cookie) {
            const formatValidation = this.validateCookieFormat(cookie.platform, updates.cookie)
            if (!formatValidation.valid) {
                return { success: false, error: formatValidation.error }
            }

            if (!skipValidation && updates.cookie !== cookie.cookie) {
                const onlineValidation = await validateCookieOnline(cookie.platform, updates.cookie)
                updates.isValid = onlineValidation.valid
                updates.validatedAt = Date.now()
                updates.userInfo = onlineValidation.userInfo
                updates.validationError = onlineValidation.error

                if (!onlineValidation.valid) {
                    return { 
                        success: false, 
                        error: `Cookie验证失败: ${onlineValidation.error}`,
                        validationError: onlineValidation.error
                    }
                }
            }
        }

        const updatedCookie = {
            ...cookie,
            ...updates,
            updatedAt: Date.now()
        }
        
        this.cookies.set(id, updatedCookie)
        await this.addLog('cookie_update', `更新${cookie.platform} Cookie: ${cookie.note || id}`, username)
        await this.saveToFile()
        
        return { success: true, data: updatedCookie }
    }

    async deleteCookie(id, username = 'system') {
        const cookie = this.cookies.get(id)
        if (!cookie) {
            return { success: false, error: 'Cookie不存在' }
        }

        this.cookies.delete(id)
        await this.addLog('cookie_delete', `删除${cookie.platform} Cookie: ${cookie.note || id}`, username)
        await this.saveToFile()
        
        return { success: true }
    }

    getCookie(id) {
        return this.cookies.get(id)
    }

    getCookies(platform = null) {
        let cookies = Array.from(this.cookies.values())
        if (platform) {
            cookies = cookies.filter(c => c.platform === platform)
        }
        return cookies.sort((a, b) => b.createdAt - a.createdAt)
    }

    getActiveCookie(platform) {
        const cookies = this.getCookies(platform).filter(c => c.isActive && c.isValid !== false)
        return cookies[0] || null
    }

    isAccountLocked(username) {
        const lockInfo = this.lockedAccounts.get(username)
        if (!lockInfo) return false
        
        if (Date.now() > lockInfo.lockedUntil) {
            this.lockedAccounts.delete(username)
            this.loginAttempts.delete(username)
            return false
        }
        return true
    }

    getLockRemainingTime(username) {
        const lockInfo = this.lockedAccounts.get(username)
        if (!lockInfo) return 0
        return Math.ceil((lockInfo.lockedUntil - Date.now()) / 1000 / 60)
    }

    recordFailedLogin(username) {
        const attempts = this.loginAttempts.get(username) || 0
        this.loginAttempts.set(username, attempts + 1)
        
        if (this.loginAttempts.get(username) >= MAX_LOGIN_ATTEMPTS) {
            this.lockedAccounts.set(username, {
                lockedAt: Date.now(),
                lockedUntil: Date.now() + LOCKOUT_DURATION,
                attempts: this.loginAttempts.get(username)
            })
        }
    }

    clearFailedLogins(username) {
        this.loginAttempts.delete(username)
        if (this.lockedAccounts.has(username)) {
            this.lockedAccounts.delete(username)
        }
    }

    async authenticateUser(username, password) {
        if (this.isAccountLocked(username)) {
            const remaining = this.getLockRemainingTime(username)
            return { 
                success: false, 
                error: `账户已被锁定，请在 ${remaining} 分钟后重试`,
                locked: true,
                remainingMinutes: remaining
            }
        }

        const user = this.users.get(username)
        if (!user) {
            this.recordFailedLogin(username)
            return { success: false, error: '用户不存在' }
        }

        if (!this.verifyPassword(password, user.password)) {
            this.recordFailedLogin(username)
            const attempts = this.loginAttempts.get(username) || 0
            const remaining = MAX_LOGIN_ATTEMPTS - attempts
            if (remaining > 0) {
                return { success: false, error: `密码错误，还剩 ${remaining} 次尝试机会` }
            } else {
                return { 
                    success: false, 
                    error: '登录失败次数过多，账户已被锁定 15 分钟',
                    locked: true 
                }
            }
        }

        this.clearFailedLogins(username)

        if (user.twoFactorEnabled) {
            return {
                success: true,
                require2FA: true,
                data: {
                    username: user.username,
                    role: user.role
                }
            }
        }

        const token = this.generateId()
        user.token = token
        user.tokenCreatedAt = Date.now()
        user.tokenExpiresAt = Date.now() + TOKEN_TTL
        user.lastLogin = Date.now()
        if (user.password && !user.password.startsWith('scrypt:')) {
            user.password = this.hashPassword(password)
        }
        this.users.set(username, user)
        
        await this.addLog('user_login', `用户登录: ${username}`, username)
        await this.saveToFile()
        
        return { 
            success: true, 
            data: { 
                username: user.username, 
                role: user.role,
                token 
            } 
        }
    }

    async verify2FALogin(username, code) {
        const user = this.users.get(username)
        if (!user || !user.twoFactorEnabled) {
            return { success: false, error: '2FA未启用' }
        }

        if (!this.verify2FACode(username, code)) {
            this.recordFailedLogin(username)
            return { success: false, error: '验证码错误' }
        }

        this.clearFailedLogins(username)

        const token = this.generateId()
        user.token = token
        user.tokenCreatedAt = Date.now()
        user.tokenExpiresAt = Date.now() + TOKEN_TTL
        user.lastLogin = Date.now()
        this.users.set(username, user)

        await this.addLog('user_login', `用户登录(2FA): ${username}`, username)
        await this.saveToFile()

        return {
            success: true,
            data: {
                username: user.username,
                role: user.role,
                token
            }
        }
    }

    setup2FA(username) {
        const user = this.users.get(username)
        if (!user) {
            return { success: false, error: '用户不存在' }
        }

        const secret = generateSecret()

        user.twoFactorTempSecret = secret
        this.users.set(username, user)

        const issuer = 'Meting-API'
        const accountName = username
        const otpAuthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`

        return {
            success: true,
            data: {
                secret,
                otpAuthUrl
            }
        }
    }

    async enable2FA(username, code) {
        const user = this.users.get(username)
        if (!user) {
            return { success: false, error: '用户不存在' }
        }

        if (!user.twoFactorTempSecret) {
            return { success: false, error: '请先获取2FA设置信息' }
        }

        const currentCode = generateTOTP(user.twoFactorTempSecret)
        if (code !== currentCode) {
            const prevCounter = Math.floor(Date.now() / 1000 / 30) - 1
            const prevCode = generateTOTPForCounter(user.twoFactorTempSecret, prevCounter)
            if (code !== prevCode) {
                return { success: false, error: '验证码错误，请重新输入' }
            }
        }

        user.twoFactorSecret = user.twoFactorTempSecret
        user.twoFactorEnabled = true
        delete user.twoFactorTempSecret
        this.users.set(username, user)

        await this.addLog('2fa_enable', `启用双因素认证: ${username}`, username)
        await this.saveToFile()

        return { success: true }
    }

    async disable2FA(username, password) {
        const user = this.users.get(username)
        if (!user) {
            return { success: false, error: '用户不存在' }
        }

        if (!this.verifyPassword(password, user.password)) {
            return { success: false, error: '密码错误' }
        }

        user.twoFactorEnabled = false
        delete user.twoFactorSecret
        delete user.twoFactorTempSecret
        this.users.set(username, user)

        await this.addLog('2fa_disable', `禁用双因素认证: ${username}`, username)
        await this.saveToFile()

        return { success: true }
    }

    verify2FACode(username, code) {
        const user = this.users.get(username)
        if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
            return false
        }

        const currentCode = generateTOTP(user.twoFactorSecret)
        if (code === currentCode) return true

        const prevCounter = Math.floor(Date.now() / 1000 / 30) - 1
        const prevCode = generateTOTPForCounter(user.twoFactorSecret, prevCounter)
        if (code === prevCode) return true

        return false
    }

    get2FAStatus(username) {
        const user = this.users.get(username)
        if (!user) {
            return { enabled: false }
        }
        return { enabled: user.twoFactorEnabled || false }
    }

    async logoutUser(username) {
        const user = this.users.get(username)
        if (user) {
            delete user.token
            this.users.set(username, user)
            await this.addLog('user_logout', `用户登出: ${username}`, username)
            await this.saveToFile()
        }
        return { success: true }
    }

    validateToken(username, token) {
        const user = this.users.get(username)
        if (!user || user.token !== token) return false
        if (user.tokenExpiresAt && Date.now() > user.tokenExpiresAt) {
            delete user.token
            delete user.tokenExpiresAt
            return false
        }
        return true
    }

    async addUser(userData, operator = 'system') {
        if (this.users.has(userData.username)) {
            return { success: false, error: '用户名已存在' }
        }

        const user = {
            username: userData.username,
            password: this.hashPassword(userData.password),
            role: userData.role || 'user',
            createdAt: Date.now(),
            createdBy: operator
        }
        
        this.users.set(userData.username, user)
        await this.addLog('user_add', `添加用户: ${userData.username}`, operator)
        await this.saveToFile()
        
        return { success: true, data: { username: user.username, role: user.role } }
    }

    async updateUser(username, updates, operator = 'system') {
        const user = this.users.get(username)
        if (!user) {
            return { success: false, error: '用户不存在' }
        }

        if (updates.newUsername && updates.newUsername !== username) {
            if (this.users.has(updates.newUsername)) {
                return { success: false, error: '新用户名已存在' }
            }
            
            const newUser = { ...user, username: updates.newUsername }
            this.users.delete(username)
            this.users.set(updates.newUsername, newUser)
            
            if (updates.password) {
                newUser.password = this.hashPassword(updates.password)
            }
            if (updates.role) {
                newUser.role = updates.role
            }
            
            await this.addLog('user_update', `更新用户: ${username} -> ${updates.newUsername}`, operator)
            await this.saveToFile()
            
            return { success: true, data: { username: updates.newUsername, role: newUser.role, renamed: true } }
        }

        if (updates.password) {
            user.password = this.hashPassword(updates.password)
        }
        if (updates.role) {
            user.role = updates.role
        }
        
        this.users.set(username, user)
        await this.addLog('user_update', `更新用户: ${username}`, operator)
        await this.saveToFile()
        
        return { success: true, data: { username: user.username, role: user.role } }
    }

    async deleteUser(username, operator = 'system') {
        if (username === 'admin') {
            return { success: false, error: '不能删除管理员账户' }
        }

        if (!this.users.has(username)) {
            return { success: false, error: '用户不存在' }
        }

        this.users.delete(username)
        await this.addLog('user_delete', `删除用户: ${username}`, operator)
        await this.saveToFile()
        
        return { success: true }
    }

    getUsers() {
        return Array.from(this.users.values()).map(u => ({
            username: u.username,
            role: u.role,
            createdAt: u.createdAt,
            lastLogin: u.lastLogin
        }))
    }

    getAdminPath() {
        return this.config.adminPath || null
    }

    async setAdminPath(newPath, operator = 'system') {
        if (!newPath || typeof newPath !== 'string') {
            return { success: false, error: '路径不能为空' }
        }

        const sanitizedPath = newPath.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_-]/g, '')
        
        if (sanitizedPath.length < 3) {
            return { success: false, error: '路径长度至少为3个字符' }
        }

        if (sanitizedPath === 'api' || sanitizedPath === 'test') {
            return { success: false, error: '不能使用保留路径' }
        }

        this.config.adminPath = sanitizedPath
        await this.addLog('config_update', `修改管理后台路径: ${sanitizedPath}`, operator)
        await this.saveToFile()
        
        return { success: true, data: { adminPath: sanitizedPath } }
    }

    getConfig() {
        return {
            adminPath: this.config.adminPath || null,
            webhookUrl: this.config.webhookUrl || null,
            monitorEnabled: this.config.monitorEnabled || false,
            monitorInterval: this.config.monitorInterval || 60
        }
    }

    getWebhookConfig() {
        return {
            url: this.config.webhookUrl || null,
            enabled: this.config.webhookEnabled || false,
            contentType: this.config.webhookContentType || 'application/json',
            headers: this.config.webhookHeaders || {},
            bodyTemplate: this.config.webhookBodyTemplate || null
        }
    }

    async setWebhookConfig(config, operator = 'system') {
        if (config.url !== undefined) {
            if (config.url && !this.isValidWebhookUrl(config.url)) {
                return { success: false, error: '无效的Webhook URL格式' }
            }
            this.config.webhookUrl = config.url || null
        }
        if (config.enabled !== undefined) {
            this.config.webhookEnabled = config.enabled
        }
        if (config.contentType !== undefined) {
            this.config.webhookContentType = config.contentType || 'application/json'
        }
        if (config.headers !== undefined) {
            if (typeof config.headers === 'string') {
                try {
                    this.config.webhookHeaders = JSON.parse(config.headers)
                } catch {
                    return { success: false, error: 'Headers JSON格式无效' }
                }
            } else {
                this.config.webhookHeaders = config.headers
            }
        }
        if (config.bodyTemplate !== undefined) {
            if (typeof config.bodyTemplate === 'string') {
                try {
                    JSON.parse(config.bodyTemplate)
                    this.config.webhookBodyTemplate = config.bodyTemplate
                } catch {
                    return { success: false, error: 'Body模板JSON格式无效' }
                }
            } else {
                this.config.webhookBodyTemplate = config.bodyTemplate ? JSON.stringify(config.bodyTemplate) : null
            }
        }
        
        await this.addLog('webhook_update', `更新Webhook配置`, operator)
        await this.saveToFile()
        
        return { success: true, data: this.getWebhookConfig() }
    }

    getSmtpConfig() {
        return {
            enabled: this.config.smtpEnabled || false,
            host: this.config.smtpHost || '',
            port: this.config.smtpPort || 465,
            secure: this.config.smtpSecure !== false,
            user: this.config.smtpUser || '',
            pass: this.config.smtpPass || '',
            from: this.config.smtpFrom || '',
            to: this.config.smtpTo || ''
        }
    }

    async setSmtpConfig(config, operator = 'system') {
        const allowedKeys = ['enabled', 'host', 'port', 'secure', 'user', 'pass', 'from', 'to']
        for (const key of allowedKeys) {
            if (config[key] !== undefined) {
                this.config['smtp' + key.charAt(0).toUpperCase() + key.slice(1)] = config[key]
            }
        }
        await this.addLog('smtp_update', '更新SMTP邮件配置', operator)
        await this.saveToFile()
        return { success: true, data: this.getSmtpConfig() }
    }

    isValidWebhookUrl(url) {
        try {
            const parsed = new URL(url)
            if (!['http:', 'https:'].includes(parsed.protocol)) return false
            const hostname = parsed.hostname.toLowerCase()
            if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
            const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
            if (ipMatch) {
                const [a, b] = [parseInt(ipMatch[1]), parseInt(ipMatch[2])]
                if (a === 10) return false
                if (a === 127) return false
                if (a === 0) return false
                if (a === 169 && b === 254) return false
                if (a === 172 && b >= 16 && b <= 31) return false
                if (a === 192 && b === 168) return false
                if (a >= 224) return false
            }
            if (hostname === '::1' || hostname === '::' || hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd')) return false
            if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false
            return true
        } catch {
            return false
        }
    }

    getGeoConfig() {
        return {
            enabled: this.config.geoApiEnabled !== false,
            key: this.config.geoApiKey || '',
            cacheTtlDays: Number(this.config.geoApiCacheTtlDays) || 30
        }
    }

    async setGeoConfig(config = {}, operator = 'system') {
        if (config.enabled !== undefined) {
            this.config.geoApiEnabled = !!config.enabled
        }
        if (config.clearKey) {
            delete this.config.geoApiKey
        } else if (typeof config.key === 'string' && config.key.trim()) {
            const key = config.key.trim()
            if (key.length < 8 || key.length > 128 || /\s/.test(key)) {
                return { success: false, error: 'appKey 格式不正确' }
            }
            this.config.geoApiKey = key
        }
        await this.addLog('geo_api_update', `更新 IP 归属地接口配置: ${this.config.geoApiKey ? '已配置密钥' : '未配置密钥'}`, operator)
        await this.saveToFile()
        return {
            success: true,
            data: {
                enabled: this.getGeoConfig().enabled,
                hasKey: !!this.config.geoApiKey
            }
        }
    }

    getLoginBgConfig() {
        const ttl = Number(this.config.loginBgTtlHours)
        return {
            enabled: this.config.loginBgEnabled !== false,
            apiUrl: this.config.loginBgApiUrl || DEFAULT_LOGIN_BG_API,
            ttlHours: Number.isFinite(ttl) && ttl >= LOGIN_BG_TTL_MIN_HOURS && ttl <= LOGIN_BG_TTL_MAX_HOURS
                ? ttl
                : DEFAULT_LOGIN_BG_TTL_HOURS
        }
    }

    async setLoginBgConfig(config = {}, operator = 'system') {
        if (config.enabled !== undefined) {
            this.config.loginBgEnabled = !!config.enabled
        }
        if (config.apiUrl !== undefined) {
            const url = String(config.apiUrl || '').trim()
            if (!url) {
                return { success: false, error: '图片接口地址不能为空' }
            }
            if (url.length > LOGIN_BG_URL_MAX_LENGTH) {
                return { success: false, error: `图片接口地址不能超过 ${LOGIN_BG_URL_MAX_LENGTH} 个字符` }
            }
            if (!this.isValidWebhookUrl(url)) {
                return { success: false, error: '图片接口地址无效：需要公网 http/https 地址' }
            }
            this.config.loginBgApiUrl = url
        }
        if (config.ttlHours !== undefined) {
            const ttl = Number(config.ttlHours)
            if (!Number.isInteger(ttl) || ttl < LOGIN_BG_TTL_MIN_HOURS || ttl > LOGIN_BG_TTL_MAX_HOURS) {
                return {
                    success: false,
                    error: `缓存有效期需为 ${LOGIN_BG_TTL_MIN_HOURS}~${LOGIN_BG_TTL_MAX_HOURS} 之间的整数小时`,
                }
            }
            this.config.loginBgTtlHours = ttl
        }

        await this.addLog(
            'login_bg_update',
            `更新登录页背景图: ${this.getLoginBgConfig().enabled ? '启用' : '关闭'}, TTL=${this.getLoginBgConfig().ttlHours}小时`,
            operator
        )
        await this.saveToFile()
        return { success: true, data: this.getLoginBgConfig() }
    }

    /** 原始缓存配置；null 表示从未保存过，由 api-cache 用环境变量/默认值解析。 */
    getCacheConfig() {
        return this.config.cacheConfig || null
    }

    async setCacheConfig(config = {}, operator = 'system') {
        const next = { ...(this.config.cacheConfig || {}) }

        if (config.enabled !== undefined) {
            next.enabled = !!config.enabled
        }

        if (config.maxEntries !== undefined) {
            const maxEntries = Number(config.maxEntries)
            if (!Number.isInteger(maxEntries) || maxEntries < CACHE_MAX_ENTRIES_MIN || maxEntries > CACHE_MAX_ENTRIES_MAX) {
                return {
                    success: false,
                    error: `最大缓存条目需为 ${CACHE_MAX_ENTRIES_MIN}~${CACHE_MAX_ENTRIES_MAX} 之间的整数`,
                }
            }
            next.maxEntries = maxEntries
        }

        if (config.ttlByType !== undefined) {
            if (!config.ttlByType || typeof config.ttlByType !== 'object' || Array.isArray(config.ttlByType)) {
                return { success: false, error: 'TTL 配置格式不正确' }
            }
            const ttlByType = { ...(next.ttlByType || {}) }
            for (const [type, value] of Object.entries(config.ttlByType)) {
                if (!CACHE_TYPES.includes(type)) {
                    return { success: false, error: `未知的缓存类型: ${type}` }
                }
                const seconds = Number(value)
                if (!Number.isInteger(seconds) || seconds < CACHE_TTL_MIN_SECONDS || seconds > CACHE_TTL_MAX_SECONDS) {
                    return {
                        success: false,
                        error: `${type} 的 TTL 需为 ${CACHE_TTL_MIN_SECONDS / 60}~${CACHE_TTL_MAX_SECONDS / 60} 分钟之间的整数`,
                    }
                }
                ttlByType[type] = seconds
            }
            next.ttlByType = ttlByType
        }

        this.config.cacheConfig = next
        await this.addLog(
            'cache_config_update',
            `更新响应缓存: ${next.enabled === false ? '关闭' : '启用'}, 最大条目=${next.maxEntries ?? '默认'}`,
            operator
        )
        await this.saveToFile()
        return { success: true, data: next }
    }

    getMonitorConfig() {
        return {
            enabled: this.config.monitorEnabled || false,
            interval: this.config.monitorInterval || 60
        }
    }

    async setMonitorConfig(config, operator = 'system') {
        if (config.enabled !== undefined) {
            this.config.monitorEnabled = config.enabled
        }
        if (config.interval !== undefined) {
            const interval = parseInt(config.interval)
            if (isNaN(interval) || interval < 5) {
                return { success: false, error: '监测间隔不能小于5分钟' }
            }
            if (interval > 1440) {
                return { success: false, error: '监测间隔不能超过1440分钟(24小时)' }
            }
            this.config.monitorInterval = interval
        }
        
        await this.addLog('monitor_update', `更新监测配置: 启用=${this.config.monitorEnabled}, 间隔=${this.config.monitorInterval}分钟`, operator)
        await this.saveToFile()
        
        return { success: true, data: this.getMonitorConfig() }
    }

    async addMonitorLog(logData) {
        const log = {
            id: this.generateId(),
            timestamp: Date.now(),
            ...logData
        }
        
        this.monitorLogs.push(log)
        
        if (this.monitorLogs.length % 10 === 0) {
            await this.saveToFile()
        }
        
        return log
    }

    getMonitorLogs(limit = 100, offset = 0) {
        return this.monitorLogs
            .slice()
            .reverse()
            .slice(offset, offset + limit)
    }

    generateApiToken() {
        const bytes = nodeCrypto.randomBytes(32)
        return 'mapi_' + bytes.toString('base64url')
    }

    async createApiToken(name, permissions = [], operator = 'system') {
        const id = this.generateId()
        const token = this.generateApiToken()
        
        const tokenData = {
            id,
            name,
            token,
            permissions,
            createdAt: Date.now(),
            createdBy: operator,
            lastUsedAt: null,
            usageCount: 0
        }
        
        this.apiTokens.set(id, tokenData)
        await this.addLog('api_token_create', `创建API Token: ${name}`, operator)
        await this.saveToFile()
        
        return { success: true, data: tokenData }
    }

    getApiTokens() {
        return Array.from(this.apiTokens.values())
            .map(t => ({
                id: t.id,
                name: t.name,
                permissions: t.permissions,
                createdAt: t.createdAt,
                createdBy: t.createdBy,
                lastUsedAt: t.lastUsedAt,
                usageCount: t.usageCount
            }))
            .sort((a, b) => b.createdAt - a.createdAt)
    }

    getApiToken(id) {
        return this.apiTokens.get(id) || null
    }

    validateApiToken(token) {
        for (const [id, tokenData] of this.apiTokens) {
            if (tokenData.token === token) {
                tokenData.lastUsedAt = Date.now()
                tokenData.usageCount = (tokenData.usageCount || 0) + 1
                this.apiTokens.set(id, tokenData)
                return { valid: true, tokenData }
            }
        }
        return { valid: false }
    }

    async deleteApiToken(id, operator = 'system') {
        const tokenData = this.apiTokens.get(id)
        if (!tokenData) {
            return { success: false, error: 'Token不存在' }
        }
        
        this.apiTokens.delete(id)
        await this.addLog('api_token_delete', `删除API Token: ${tokenData.name}`, operator)
        await this.saveToFile()
        
        return { success: true }
    }

    async updateApiToken(id, updates, operator = 'system') {
        const tokenData = this.apiTokens.get(id)
        if (!tokenData) {
            return { success: false, error: 'Token不存在' }
        }

        if (updates.name) {
            tokenData.name = updates.name
        }
        if (updates.permissions !== undefined) {
            tokenData.permissions = updates.permissions
        }

        this.apiTokens.set(id, tokenData)
        await this.addLog('api_token_update', `更新API Token: ${tokenData.name}`, operator)
        await this.saveToFile()

        return { success: true, data: tokenData }
    }

    // ============ 滥用检测与防护 ============

    getAbuseConfig() {
        return this.config.abuseConfig || null
    }

    async setAbuseConfig(config, operator = 'system') {
        this.config.abuseConfig = {
            ...this.config.abuseConfig,
            ...config,
        }
        await this.addLog('abuse_config_update', '更新滥用防护配置', operator)
        await this.saveToFile()
        return { success: true, data: this.config.abuseConfig }
    }

    async addAbuseLog(logData) {
        const log = {
            id: this.generateId(),
            ip: logData.ip || 'unknown',
            path: logData.path || '',
            method: logData.method || 'GET',
            level: logData.level || 'low',
            reason: logData.reason || '',
            violations: logData.violations || [],
            userAgent: logData.userAgent || '',
            blocked: logData.blocked || false,
            hitCount: logData.hitCount || 1,
            timestamp: Date.now(),
        }
        this.abuseLogs.push(log)
        if (this.abuseLogs.length > 1000) {
            this.abuseLogs = this.abuseLogs.slice(-1000)
        }
        if (this.abuseLogs.length % 5 === 0) {
            await this.saveToFile()
        }
        return log
    }

    getAbuseLogs(limit = 100, offset = 0, filters = {}) {
        let logs = this.abuseLogs.slice().reverse()
        if (filters.keyword) {
            const kw = filters.keyword.toLowerCase()
            logs = logs.filter(l =>
                l.ip.includes(kw) ||
                l.path.toLowerCase().includes(kw) ||
                l.reason.toLowerCase().includes(kw)
            )
        }
        if (filters.ip) {
            logs = logs.filter(l => l.ip === filters.ip)
        }
        if (filters.level) {
            logs = logs.filter(l => l.level === filters.level)
        }
        if (filters.blocked !== undefined) {
            logs = logs.filter(l => l.blocked === filters.blocked)
        }
        return logs.slice(offset, offset + limit)
    }

    getAbuseLogTotalCount(filters = {}) {
        let logs = this.abuseLogs
        if (filters.keyword) {
            const kw = filters.keyword.toLowerCase()
            logs = logs.filter(l =>
                l.ip.includes(kw) ||
                l.path.toLowerCase().includes(kw) ||
                l.reason.toLowerCase().includes(kw)
            )
        }
        if (filters.ip) {
            logs = logs.filter(l => l.ip === filters.ip)
        }
        if (filters.level) {
            logs = logs.filter(l => l.level === filters.level)
        }
        if (filters.blocked !== undefined) {
            logs = logs.filter(l => l.blocked === filters.blocked)
        }
        return logs.length
    }

    async clearAbuseLogs(operator = 'system') {
        this.abuseLogs = []
        await this.addLog('abuse_logs_clear', '清空滥用日志', operator)
        await this.saveToFile()
        return { success: true }
    }

    getIpBans() {
        const result = []
        const now = Date.now()
        for (const [ip, ban] of this.ipBans) {
            if (ban.expiresAt && now > ban.expiresAt) continue
            result.push({ ip, ...ban })
        }
        return result
    }

    async addIpBan(ip, reason, duration, violations = [], permanent = false) {
        const now = Date.now()
        this.ipBans.set(ip, {
            reason: reason || 'auto_ban',
            violations,
            bannedAt: now,
            expiresAt: permanent ? 0 : (now + (duration || 3600000)),
        })
        await this.saveToFile()
    }

    // 滑动续期后同步到期时间（保留原封禁原因与违规记录）
    async extendIpBan(ip, expiresAt) {
        const ban = this.ipBans.get(ip)
        if (!ban) return
        ban.expiresAt = expiresAt
        await this.saveToFile()
    }

    async removeIpBan(ip, operator = 'system') {
        if (this.ipBans.has(ip)) {
            this.ipBans.delete(ip)
            await this.addLog('ip_unban', `解封IP: ${ip}`, operator)
            await this.saveToFile()
            return { success: true }
        }
        return { success: false, error: 'IP不在封禁列表' }
    }

    getAbuseStats() {
        const now = Date.now()
        let banned = 0
        let expired = 0
        for (const [, ban] of this.ipBans) {
            if (ban.expiresAt && now > ban.expiresAt) {
                expired++
            } else {
                banned++
            }
        }
        const recent = this.abuseLogs.slice(-100)
        const blocked = recent.filter(l => l.blocked).length
        const byLevel = {
            high: recent.filter(l => l.level === 'high').length,
            medium: recent.filter(l => l.level === 'medium').length,
            low: recent.filter(l => l.level === 'low').length,
            ban: recent.filter(l => l.level === 'ban').length,
        }
        return {
            totalLogs: this.abuseLogs.length,
            recentBlocked: blocked,
            activeBans: banned,
            expiredBans: expired,
            byLevel,
        }
    }
}

const store = new DataStore()
await store.init()

export default store

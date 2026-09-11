import store from '../admin/store.js'

const hasPermission = (tokenData, required) => {
    if (!tokenData) return false
    const perms = tokenData.permissions || []
    if (perms.includes('*') || perms.includes('admin')) return true
    return perms.includes(required)
}

export const authMiddleware = async (c, next) => {
    const username = c.req.header('X-Auth-Username')
    const token = c.req.header('X-Auth-Token')
    const authHeader = c.req.header('Authorization')

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiToken = authHeader.substring(7)
        const result = store.validateApiToken(apiToken)

        if (result.valid) {
            const creator = result.tokenData.createdBy || 'api'
            const creatorUser = store.users.get(creator)
            const creatorRole = creatorUser?.role || 'user'
            c.set('username', creator)
            c.set('isApiToken', true)
            c.set('tokenData', result.tokenData)
            c.set('creatorRole', creatorRole)
            return await next()
        }
    }

    if (!username || !token) {
        return c.json({ success: false, error: '未提供认证信息' }, 401)
    }

    if (!store.validateToken(username, token)) {
        return c.json({ success: false, error: '认证信息无效或已过期' }, 401)
    }

    c.set('username', username)
    await next()
}

export const adminMiddleware = async (c, next) => {
    const isApiToken = c.get('isApiToken')

    if (isApiToken) {
        const tokenData = c.get('tokenData')
        if (!hasPermission(tokenData, 'admin')) {
            return c.json({ success: false, error: 'API Token 权限不足' }, 403)
        }
        return await next()
    }

    const username = c.get('username')
    const user = store.users.get(username)

    if (!user || user.role !== 'admin') {
        return c.json({ success: false, error: '权限不足' }, 403)
    }

    await next()
}

// 供滥用检测等前置中间件判断请求是否携带有效凭据
// 会话 token：任意有效登录用户即可；API token：仅 admin/* 权限可豁免
export const isValidAuth = (c) => {
    const username = c.req.header('X-Auth-Username')
    const token = c.req.header('X-Auth-Token')
    if (username && token && store.validateToken(username, token)) return true

    const authHeader = c.req.header('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const result = store.validateApiToken(authHeader.substring(7))
        if (result.valid && hasPermission(result.tokenData, 'admin')) return true
    }
    return false
}

export const optionalAuth = async (c, next) => {
    const username = c.req.header('X-Auth-Username')
    const token = c.req.header('X-Auth-Token')
    const authHeader = c.req.header('Authorization')

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiToken = authHeader.substring(7)
        const result = store.validateApiToken(apiToken)

        if (result.valid) {
            const creator = result.tokenData.createdBy || 'api'
            c.set('username', creator)
            c.set('isApiToken', true)
            c.set('tokenData', result.tokenData)
            return await next()
        }
    }

    if (username && token && store.validateToken(username, token)) {
        c.set('username', username)
    }

    await next()
}

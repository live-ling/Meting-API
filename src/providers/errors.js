/**
 * Provider 层错误
 *
 * 之前 provider 抛出任何异常都会被 /api 统一转成 500 + 通用文案，
 * 结果「上游挂了」「这首歌没有版权」「平台需要 Cookie」在客户端看起来一模一样。
 * 用这个类把「可以告诉调用方的原因」与「内部异常」区分开：
 * /api 只对外暴露 UpstreamError 的 message，其他异常仍然是通用 500。
 */
export class UpstreamError extends Error {
    /**
     * @param {string} message 可以安全展示给调用方的说明
     * @param {number} status HTTP 状态码（默认 502：上游不可用）
     */
    constructor(message, status = 502) {
        super(message)
        this.name = 'UpstreamError'
        this.status = status
    }
}

export default UpstreamError

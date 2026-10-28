import tencent from "./tencent/index.js"
import netease from './netease/index.js'
import { createProvider } from './legacy/index.js'

/**
 * 平台注册表
 *
 * netease / tencent 是本仓库自研 provider；kugou / baidu / kuwo 通过
 * `providers/legacy`（基于 @meting/core）接入，与原始项目同一套上游。
 *
 * `status` 用于首页能力矩阵标注平台现状，不影响路由：
 * 请求哪个平台就打哪个平台，不做跨平台兜底。
 */
class Providers {

    constructor() {
        this.providers = {}

        tencent.register(this)
        netease.register(this)

        this.register('kugou', createProvider('kugou', {
            status: 'ok',
            note: 'type=url 需要 Cookie（t + KugooID），未提供时返回 404',
        }))
        this.register('baidu', createProvider('baidu', {
            status: 'down',
            note: '上游 musicapi.taihe.com 已无法解析（百度音乐接口下线），请求返回 502',
        }))
        this.register('kuwo', createProvider('kuwo', {
            status: 'down',
            note: '上游要求有效 kw_token，官网已不再下发（接口返回 request is illegal），请求返回 502',
        }))

    }

    register(provider_name, handle_obj) {
        this.providers[provider_name] = handle_obj
    }

    get(provider_name) {
        return this.providers[provider_name];
    }

    get_provider_list() {
        return Object.keys(this.providers)
    }
}

export default Providers

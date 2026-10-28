/**
 * `/test` 页面与 `providers.test.js` 共用的示例数据。
 *
 * 注意：`providers.test.js` 会对**所有**条目（含 show:false）发起真实请求并断言 2xx/3xx，
 * 所以这里只放当前确实能取到数据的组合。
 * 酷狗 `type=url` 需要 Cookie（t + KugooID），没有 cookie 会 404，故不列入。
 * 百度 / 酷我 上游已不可用（见 providers/index.js 的状态说明），也不列入。
 */
export default {
    "tencent": {
        "playlist": { "show": true, "value": "7326220405" },
        "song": { "show": true, "value": "002Rnpvi058Qdm" },
        "album": { "show": true, "value": "000MkMni19ClKG" },
        "lrc": { "show": false, "value": "000i26Sh1ZyiNU" },
        "pic": { "show": false, "value": "002Rnpvi058Qdm" },
        "url": { "show": false, "value": "002Rnpvi058Qdm" },
    },
    "netease": {
        "playlist": { "show": true, "value": "2877205781" },
        "song": { "show": true, "value": "473403185" },
        "album": { "show": true, "value": "34720827" },
        "artist": { "show": true, "value": "12441107" },
        "lrc": { "show": false, "value": "2015217630" },
        "url": { "show": false, "value": "473403185" },
        "search": { "show": true, "value": "KN33S0XXX" },
    },
    "kugou": {
        "playlist": { "show": true, "value": "2601984" },
        "song": { "show": true, "value": "b3a52a7a958bf0aed0ebfba2e9a818b7" },
        "album": { "show": true, "value": "966846" },
        "search": { "show": true, "value": "晴天" },
        "artist": { "show": false, "value": "3520" },
        "lrc": { "show": false, "value": "b3a52a7a958bf0aed0ebfba2e9a818b7" },
        "pic": { "show": false, "value": "b3a52a7a958bf0aed0ebfba2e9a818b7" },
    }
}

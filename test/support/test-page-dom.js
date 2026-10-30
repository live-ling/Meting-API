/**
 * /test 试听页交互测试用的最小假 DOM。
 *
 * client.js 被 toString() 内联进 HTML，没有真实浏览器环境时没法直接调用；
 * 这里提供一个只实现 client.js 实际用到的那部分 DOM/Audio API 的假实现，
 * 供 test/test-page-client.test.js 复用。
 */

class ClassList {
    constructor(el) { this.el = el }
    _set() { return new Set(String(this.el.className || '').split(/\s+/).filter(Boolean)) }
    add(...c) { const s = this._set(); c.forEach(x => s.add(x)); this.el.className = [...s].join(' ') }
    remove(...c) { const s = this._set(); c.forEach(x => s.delete(x)); this.el.className = [...s].join(' ') }
    contains(c) { return this._set().has(c) }
    toggle(c, force) {
        const has = this.contains(c)
        const on = force === undefined ? !has : !!force
        if (on) this.add(c); else this.remove(c)
        return on
    }
}

class El {
    constructor(tag, ownerDocument) {
        this.tagName = String(tag).toUpperCase()
        this.ownerDocument = ownerDocument
        this.children = []
        this.parentNode = null
        this.dataset = {}
        this._attrs = {}
        this.className = ''
        this.classList = new ClassList(this)
        this.style = { setProperty() {}, removeProperty() {} }
        this._listeners = {}
        this.textContent = ''
        this.value = ''
        this.checked = false
        this.disabled = false
        this.hidden = false
        this.scrollTop = 0
        this.offsetTop = 0
        this.clientHeight = 0
        this.clientWidth = 0
    }
    get parentElement() { return this.parentNode }
    setAttribute(k, v) {
        this._attrs[k] = String(v)
        if (k.startsWith('data-')) {
            this.dataset[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = String(v)
        }
    }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null }
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) }
    removeAttribute(k) { delete this._attrs[k] }
    append(...nodes) { for (const n of nodes) { if (n == null) continue; n.parentNode = this; this.children.push(n) } }
    appendChild(n) { this.append(n); return n }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes) }
    remove() {
        if (this.parentNode) {
            this.parentNode.children = this.parentNode.children.filter(x => x !== this)
            this.parentNode = null
        }
    }
    addEventListener(t, f) { (this._listeners[t] ||= []).push(f) }
    removeEventListener() {}
    dispatch(t, ev) { for (const f of [...(this._listeners[t] || [])]) f(ev) }
    focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this }
    closest(sel) {
        let n = this
        while (n) { if (matches(n, sel)) return n; n = n.parentNode }
        return null
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null }
    querySelectorAll(sel) { return descendants(this).filter(n => matches(n, sel)) }
}

function matches(el, sel) {
    let rest = String(sel).trim()
    const tag = rest.match(/^[a-zA-Z][\w-]*/)
    if (tag && el.tagName !== tag[0].toUpperCase()) return false
    rest = rest.slice(tag ? tag[0].length : 0)
    const idm = rest.match(/#([\w-]+)/)
    if (idm && el._attrs.id !== idm[1]) return false
    rest = rest.replace(/#[\w-]+/g, '')
    for (const m of (rest.match(/\.([\w-]+)/g) || [])) {
        if (!el.classList.contains(m.slice(1))) return false
    }
    rest = rest.replace(/\.[\w-]+/g, '')
    for (const a of (rest.match(/\[[^\]]+\]/g) || [])) {
        const inner = a.slice(1, -1)
        const eq = inner.indexOf('=')
        if (eq === -1) { if (!el.hasAttribute(inner)) return false }
        else {
            const val = inner.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
            if (el.getAttribute(inner.slice(0, eq)) !== val) return false
        }
    }
    return true
}

function descendants(root) {
    const out = []
    const walk = (n) => { for (const c of n.children) { out.push(c); walk(c) } }
    walk(root)
    return out
}

export function makeDoc() {
    const doc = {
        activeElement: null,
        listeners: {},
        _root: null,
        createElement(tag) { return new El(tag, doc) },
        createTextNode(text) { const n = new El('#text', doc); n.textContent = text; return n },
        querySelector(sel) { return doc._root ? doc._root.querySelector(sel) : null },
        querySelectorAll(sel) { return doc._root ? doc._root.querySelectorAll(sel) : [] },
        addEventListener(t, f) { (doc.listeners[t] ||= []).push(f) },
        dispatch(t, ev) { for (const f of [...(doc.listeners[t] || [])]) f(ev) },
    }
    doc.activeElement = doc
    return doc
}

export function buildRoot(doc, { servers, types } = {}) {
    const root = doc.createElement('article')
    // client.js 通过 doc.querySelector('[data-server][data-type][data-id]') 找根元素，
    // 真 DOM 里 article 是 body 的后代；假 DOM 的 querySelector 只搜后代，
    // 所以把 article 挂到一个虚拟 body 下，避免「根元素匹配不到自己」。
    const body = doc.createElement('body')
    body.appendChild(root)
    root.setAttribute('data-server', 'netease')
    root.setAttribute('data-server-label', '网易云音乐')
    root.setAttribute('data-type', 'playlist')
    root.setAttribute('data-type-label', '歌单')
    root.setAttribute('data-id', '2877205781')
    root.setAttribute('data-drawer-tab', 'queue')
    const ui = {}
    for (const name of ['load', 'status', 'title', 'artist', 'cover', 'coverNote', 'play', 'prev', 'next', 'seek', 'time', 'list', 'lyrics']) {
        const el = doc.createElement('div')
        el.setAttribute('data-ui', name)
        root.appendChild(el)
        ui[name] = el
    }
    const src = {}
    for (const name of ['id', 'url', 'descriptor', 'trackCount', 'drawer', 'drawerOpen', 'drawerSource', 'drawerClose', 'drawerBackdrop']) {
        const el = doc.createElement('div')
        el.setAttribute('data-source-ui', name)
        root.appendChild(el)
        src[name] = el
    }
    src.id.value = '2877205781'   // 与 SSR 里 <input data-source-ui="id" value="2877205781"> 一致
    const serverList = (servers || [{ value: 'netease', support: 'song,playlist,album,artist,search', checked: true }])
        .map(s => {
            const input = doc.createElement('input')
            input.type = 'radio'
            input.value = s.value
            input.checked = !!s.checked
            input.disabled = !!s.disabled
            input.setAttribute('data-source-ui', 'server')
            input.setAttribute('data-support', s.support || '')
            const chip = doc.createElement('label')
            chip.className = 'chip'
            const text = doc.createElement('span')
            text.className = 'chip-text'
            text.textContent = s.label || s.value
            chip.appendChild(input)
            chip.appendChild(text)
            root.appendChild(chip)
            return input
        })
    const typeList = (types || [{ value: 'playlist', checked: true }])
        .map(t => {
            const input = doc.createElement('input')
            input.type = 'radio'
            input.value = t.value
            input.checked = !!t.checked
            input.disabled = !!t.disabled
            input.setAttribute('data-source-ui', 'type')
            const chip = doc.createElement('label')
            chip.className = 'chip'
            const text = doc.createElement('span')
            text.className = 'chip-text'
            text.textContent = t.label || t.value
            chip.appendChild(input)
            chip.appendChild(text)
            root.appendChild(chip)
            return input
        })
    for (const name of ['queue', 'source']) {
        const b = doc.createElement('button')
        b.setAttribute('data-drawer-tab-btn', name)
        root.appendChild(b)
    }
    const volume = doc.createElement('input')
    volume.id = 'volume'
    volume.value = '0.55'
    root.appendChild(volume)
    const mute = doc.createElement('button')
    mute.id = 'mute'
    root.appendChild(mute)
    const volumeValue = doc.createElement('output')
    volumeValue.id = 'volume-value'
    root.appendChild(volumeValue)

    doc._root = body
    return { root, body, ui, src, servers: serverList, types: typeList }
}

export function makeEnv(fetchImpl) {
    const env = {
        location: { origin: 'https://example.test' },
        sessionStorage: { _d: {}, getItem(k) { return this._d[k] }, setItem(k, v) { this._d[k] = v } },
        fetch: fetchImpl,
        setInterval: () => 0,
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
    }
    class Audio {
        constructor() {
            this.preload = ''
            this.paused = true
            this.duration = NaN
            this.currentTime = 0
            this.volume = 1
            this.muted = false
            this._src = ''
            this._listeners = {}
        }
        get src() { return this._src }
        set src(v) { this._src = String(v) }
        addEventListener(t, f) { (this._listeners[t] ||= []).push(f) }
        dispatch(t, ev) { for (const f of [...(this._listeners[t] || [])]) f(ev) }
        removeAttribute(k) { if (k === 'src') this._src = '' }
        getAttribute(k) { return k === 'src' ? this._src : null }
        setAttribute(k, v) { if (k === 'src') this._src = String(v) }
        load() {}
        play() { this.paused = false; this.dispatch('playing', {}); return Promise.resolve() }
        pause() { this.paused = true; this.dispatch('pause', {}) }
    }
    env.Audio = Audio
    return env
}

export const jsonResponse = (data, status = 200) => ({
    ok: status < 400,
    status,
    headers: { get: () => null },
    json: async () => data,
})

export const twoSongs = () => [
    { title: 'A', author: 'X', url: 'https://e.test/a.mp3' },
    { title: 'B', author: 'Y', url: 'https://e.test/b.mp3' },
]

export const flush = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)) }
export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

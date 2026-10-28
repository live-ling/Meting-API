/**
 * 首页浏览器端脚本（复制提示词 + 统计数字）
 *
 * 以源码字符串形式返回，由 layout.js 内联进 HTML：
 * 不引入任何构建步骤或外部脚本，保持首页单文件响应。
 * 注意：字符串里不要出现模板字符串的插值符号，避免被 String.raw 提前求值。
 */

const CLIENT_SOURCE = String.raw`
(function () {
    'use strict';

    var COPY_OK = '提示词已复制，直接粘给 AI 就行。';
    var COPY_BASE_OK = '地址已复制。';
    var COPY_BASE_WARN = '浏览器不让自动复制，手动选中地址复制一下。';
    var COPY_WARN = '浏览器不让自动复制，已经帮你选好了，按 Ctrl/Cmd+C 就行。';
    var DASH = '—';

    /* ---------- 复制提示词 ---------- */

    function setStatus(node, text, tone) {
        node.textContent = text;
        node.classList.remove('is-ok', 'is-warn');
        if (tone) node.classList.add(tone);
    }

    function selectField(field) {
        field.focus();
        field.select();
        try {
            field.setSelectionRange(0, field.value.length);
        } catch (error) {
            /* 某些浏览器不支持 setSelectionRange，select() 已足够 */
        }
    }

    function copyWithExecCommand(field) {
        selectField(field);
        try {
            return document.execCommand('copy') === true;
        } catch (error) {
            return false;
        }
    }

    function copyPrompt() {
        var button = document.getElementById('copy-prompt');
        var field = document.getElementById('ai-prompt');
        var status = document.getElementById('copy-status');
        if (!button || !field || !status) return;

        function finish(copied) {
            setStatus(status, copied ? COPY_OK : COPY_WARN, copied ? 'is-ok' : 'is-warn');
            if (!copied) selectField(field);
        }

        button.addEventListener('click', function () {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(field.value).then(function () {
                    finish(true);
                }, function () {
                    finish(copyWithExecCommand(field));
                });
                return;
            }
            finish(copyWithExecCommand(field));
        });
    }

    /* ---------- 复制基础地址 ---------- */

    /* 只读取页面上已展示的地址文本，不发起任何请求 */
    function copyBase() {
        var button = document.getElementById('copy-base');
        var field = document.getElementById('base-url');
        var status = document.getElementById('copy-base-status');
        if (!button || !field || !status) return;
        var text = (field.textContent || '').trim();
        button.addEventListener('click', function () {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(text).then(function () {
                    setStatus(status, COPY_BASE_OK, 'is-ok');
                }, function () {
                    setStatus(status, COPY_BASE_WARN, 'is-warn');
                });
                return;
            }
            setStatus(status, COPY_BASE_WARN, 'is-warn');
        });
    }

    /* ---------- 提示词弹窗（渐进增强：脚本就绪才收起） ---------- */

    function setupPromptDialog() {
        var modal = document.getElementById('prompt-modal');
        var open = document.getElementById('open-prompt');
        var close = document.getElementById('close-prompt');
        if (!modal || !open || !close) return;
        var lastFocus = null;

        function setOpen(next) {
            modal.hidden = !next;
            if (next) {
                lastFocus = document.activeElement;
                modal.focus();
            } else if (lastFocus && lastFocus.focus) {
                lastFocus.focus();
            }
        }

        modal.classList.add('is-dialog');
        modal.hidden = true;
        open.hidden = false;
        close.hidden = false;
        open.addEventListener('click', function () { setOpen(true); });
        close.addEventListener('click', function () { setOpen(false); });
        modal.addEventListener('click', function (event) {
            if (event.target === modal) setOpen(false);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !modal.hidden) setOpen(false);
        });
    }

    /* ---------- 统计数字 ---------- */

    /* 任何非 2xx、解析失败、字段缺失都回落到占位符，绝不显示空值或非法数字 */
    function formatCount(value) {
        var number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
        if (typeof number !== 'number' || !isFinite(number)) return DASH;
        try {
            return number.toLocaleString('zh-CN');
        } catch (error) {
            return String(number);
        }
    }

    function paintStats(data) {
        var stats = data && typeof data === 'object' ? data : {};
        var byStatus = stats.byStatus && typeof stats.byStatus === 'object' ? stats.byStatus : {};
        var cells = [
            ['stat-total', stats.total],
            ['stat-day', stats.last24h],
            ['stat-ips', stats.uniqueIPs24h],
            ['stat-success', byStatus.success]
        ];

        cells.forEach(function (cell) {
            var node = document.getElementById(cell[0]);
            if (node) node.textContent = formatCount(cell[1]);
        });
    }

    function loadStats() {
        fetch('/api/stats', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (payload) {
                if (!payload || payload.success !== true || !payload.data) throw new Error('payload');
                paintStats(payload.data);
            })
            .catch(function () {
                paintStats(null);
            });
    }

    copyPrompt();
    copyBase();
    setupPromptDialog();
    loadStats();
})();
`.trim()

export function homeClientScript() {
    return CLIENT_SOURCE
}

export default homeClientScript

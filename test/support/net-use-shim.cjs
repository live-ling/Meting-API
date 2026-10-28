/**
 * 仅用于 Windows 沙箱里跑测试
 *
 * Vite 启动时会执行 `net use` 探测网络驱动器（windowsSafeRealPathSync），
 * 而 DSH 沙箱禁止 child_process 管道（spawn EPERM），vitest 会在加载阶段直接失败。
 * 这里只把这一条命令短路成「没有网络驱动器」，其余调用原样透传，不改任何项目代码。
 *
 * 用法：NODE_OPTIONS="--require ./test/support/net-use-shim.cjs" node ./node_modules/vitest/vitest.mjs run
 */
const childProcess = require('node:child_process')
const { EventEmitter } = require('node:events')

const isNetUse = (command) => typeof command === 'string' && /^net(\.exe)?\s+use\b/i.test(command.trim())

if (!childProcess.__netUseShimmed) {
    childProcess.__netUseShimmed = true
    const originalExec = childProcess.exec

    childProcess.exec = function exec(command, options, callback) {
        if (!isNetUse(command)) return originalExec.apply(this, arguments)

        const done = typeof options === 'function' ? options : callback
        const child = new EventEmitter()
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()
        child.kill = () => true
        if (typeof done === 'function') process.nextTick(() => done(null, '', ''))
        return child
    }
}

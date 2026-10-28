import esbuild from 'esbuild';
import resolve from 'esbuild-plugin-resolve';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import textReplace from 'esbuild-plugin-text-replace'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const urlShimPath = path.join(here, 'src', 'polyfills', 'url.js').replace(/\\/g, '/')

/**
 * `@meting/core` 顶部写了 `import { URLSearchParams } from "url"`，
 * 但 NodeModulesPolyfillPlugin 的 url polyfill 并不导出 URLSearchParams，
 * edge 打包会直接失败（http/https polyfill 又依赖 url.parse，不能整体替换）。
 *
 * 所以只把「importer 是 @meting/core 的 url 引用」换成薄 shim，
 * 其余 url 引用继续走官方 polyfill，行为不变。
 */
const metingCoreUrlShim = {
    name: 'meting-core-url-shim',
    setup(build) {
        build.onResolve({ filter: /^url$/ }, (args) => {
            const importer = (args.importer || '').replace(/\\/g, '/')
            if (!importer.includes('@meting/core')) return null
            return { path: urlShimPath }
        })
    },
}

const sharedPlugins = () => [
    metingCoreUrlShim,
    resolve({
        crypto: 'crypto-browserify',
    }),
    NodeGlobalsPolyfillPlugin({
        process: true,
        buffer: true,
    }),
    NodeModulesPolyfillPlugin(),
]

await esbuild.build({
    entryPoints: ['./app.js'],
    bundle: true,
    format: 'esm',
    outfile: './dist/cloudflare-workers-min.js',
    external: [],
    plugins: sharedPlugins(),
    minify: true,
});

await esbuild.build({
    entryPoints: ['./app.js'],
    bundle: true,
    format: 'esm',
    outfile: './dist/cloudflare-workers.js',
    external: [],
    plugins: sharedPlugins(),
});

await esbuild.build({
    entryPoints: ['./deno.js'],
    bundle: true,
    format: 'esm',
    outfile: './dist/deno.js',
    external: [],
    plugins: [
        textReplace({
            include: new RegExp("src/providers/netease/crypto\.js"),
            pattern: [
                ["import crypto from 'crypto-browserify'", "import crypto from 'https://esm.sh/crypto-browserify@3.12.0'"],
                ["import { Buffer } from 'buffer/index.js'","import { Buffer } from 'https://esm.sh/buffer@6.0.3'"]
            ]
        }),
        ...sharedPlugins(),
    ],
    // minify: true,
});

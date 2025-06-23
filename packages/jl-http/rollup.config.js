import { fileURLToPath } from 'node:url'
import alias from '@rollup/plugin-alias'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import clear from 'rollup-plugin-clear'

export default defineConfig([
  /**
   * 主文件
   */
  {
    input: './src/index.ts',
    output: [
      outputFormat('dist/index.cjs', 'cjs'),
      outputFormat('dist/index.js', 'es'),
    ],
    plugins: createPlugins({
      needClear: true,
    }),
  },

  /**
   * Cli 打包
   */
  {
    input: './src/cli/index.ts',
    output: [
      outputFormat('cli/index.cjs', 'cjs'),
    ],
    plugins: createPlugins(),
  },
])

/**
 *
 * @param {CreatePluginsOpts} opts
 */
function createPlugins(opts = {}) {
  return [
    nodeResolve(), // 开启`node_modules`查找模块功能
    terser(),
    opts.needClear && clear({
      targets: ['dist'],
      watch: true,
    }),

    typescript({
      include: ['src/**/*.ts', 'src/**/*.d.ts'],
    }),

    alias({
      entries: [
        {
          find: '@',
          replacement: fileURLToPath(
            new URL('src', import.meta.url),
          ),
        },
      ],
    }),

    ...(opts.extraPlugins || []),

  ].filter(Boolean)
}

/**
 * @param {string} file 文件路径
 * @param {'amd' | 'cjs' | 'commonjs' | 'es' | 'esm' | 'iife' | 'module' | 'system' | 'systemjs' | 'umd'} format 打包格式
 * @param {string} name 全部暴露对象名称
 * @returns 格式化打包对象
 */
function outputFormat(file, format, name) {
  return {
    file,
    format,
    name,
  }
}

/**
 * @typedef CreatePluginsOpts
 * @property {boolean} needClear - 是否使用清除插件
 * @property {any} extraPlugins - 其他插件
 */

import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  /** 设置根目录为工作区根目录 */
  root: resolve(__dirname, '../../'),
  test: {
    /** 测试环境配置 */
    environment: 'jsdom',

    /** 全局设置 */
    globals: true,

    /** 测试文件匹配模式 */
    include: ['packages/test/test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],

    /** 测试超时设置 */
    testTimeout: 10000,
    hookTimeout: 10000,

    /** 覆盖率配置 */
    coverage: {
      provider: 'v8',
      enabled: true,
      clean: true,
      cleanOnRerun: true,

      /** 报告格式 */
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: 'packages/test/coverage',

      /** 覆盖率目标 - 相对于 root */
      include: [
        'packages/jl-http/src/**',
      ],
      exclude: [
        'packages/jl-http/src/**/*.d.ts',
        'packages/jl-http/src/**/*.test.{js,ts}',
        'packages/jl-http/src/**/*.spec.{js,ts}',
        'packages/jl-http/src/**/index.ts',
        'packages/jl-http/src/cli/**/*',
        'packages/jl-http/src/plugins/**/*',
      ],

      /** 覆盖率阈值 */
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },

      /** 忽略未覆盖的行 */
      skipFull: false,
    },

    /** 报告配置 */
    outputFile: {
      json: 'packages/test/test-results/results.json',
    },

    /** 设置别名以匹配项目配置 */
    alias: {
      '@': resolve(__dirname, '../jl-http/src'),
      '@jl-org/http': resolve(__dirname, '../jl-http/src'),
    },

    /** 失败时的行为 */
    bail: 0, // 不在第一个失败时停止

    /** 重试配置 */
    retry: 0,

    /** 设置文件 */
    setupFiles: ['packages/test/test/setup.ts'],
  },

  /** 解析配置 */
  resolve: {
    alias: {
      '@': resolve(__dirname, '../jl-http/src'),
      '@jl-org/http': resolve(__dirname, '../jl-http/src'),
    },
  },
})

import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    // 测试环境配置
    environment: 'jsdom',

    // 全局设置
    globals: true,

    // 测试文件匹配模式
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],

    // 测试超时设置
    testTimeout: 10000,
    hookTimeout: 10000,

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      enabled: true,
      clean: true,
      cleanOnRerun: true,

      // 报告格式
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',

      // 覆盖率目标
      include: [
        '../jl-http/src/**/*.{js,ts}',
        '../jl-http/src/**/*.{jsx,tsx}',
      ],
      exclude: [
        '../jl-http/src/**/*.d.ts',
        '../jl-http/src/**/*.test.{js,ts}',
        '../jl-http/src/**/*.spec.{js,ts}',
        '../jl-http/src/**/index.ts', // 通常只是导出文件
        '../jl-http/src/cli/**/*', // CLI 工具可以单独测试
        '../jl-http/src/plugins/**/*', // polyfill 插件
      ],

      // 覆盖率阈值
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // 针对核心模块的更高要求
        '../jl-http/src/core/**/*.ts': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        '../jl-http/src/tools/**/*.ts': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },

      // 忽略未覆盖的行
      skipFull: false,

      // 所有文件都要包含在覆盖率报告中，即使没有测试
      all: true,
    },

    // 报告配置
    outputFile: {
      json: './test-results/results.json',
    },

    // 设置别名以匹配项目配置
    alias: {
      '@': resolve(__dirname, '../jl-http/src'),
    },

    // 失败时的行为
    bail: 0, // 不在第一个失败时停止

    // 重试配置
    retry: 0,

    // 设置文件
    setupFiles: ['./test/setup.ts'],
  },

  // 解析配置
  resolve: {
    alias: {
      '@': resolve(__dirname, '../jl-http/src'),
    },
  },
})

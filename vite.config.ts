import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      clean: true,
      enabled: false,
      reporter: ['html'],
      reportsDirectory: './coverage',
      include: ['../src/**/*'],
    },
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@deb': fileURLToPath(new URL('./dist/index.js', import.meta.url)),
    },
  },
  // index.html 入口文件
  root: fileURLToPath(new URL('./test', import.meta.url)),
})

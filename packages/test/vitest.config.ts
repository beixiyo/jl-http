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
})

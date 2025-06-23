import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import { envParse } from 'vite-plugin-env-parse'
import { ssePlugin } from './plugins/sse-plugin'

export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    rollupOptions: {
      external: ['turndown']
    }
  },

  plugins: [
    react(),
    UnoCSS(),
    envParse(),
    AutoImport({
      imports: ['react', 'react-router-dom'],
      dts: './src/auto-imports.d.ts',
    }),
    codeInspectorPlugin({
      bundler: 'vite',
      editor: 'cursor',
    }),
    ssePlugin(),
  ],
})

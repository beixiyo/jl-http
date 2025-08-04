import type { Plugin } from 'vite'
import { connectionManager, sse } from './sse'
import { progress } from './progress'


/**
 * SSE 插件，为开发服务器提供模拟的 SSE 接口
 */
export function ssePlugin(): Plugin {
  return {
    name: 'sse-plugin',
    configureServer(server) {
      sse(server)
      progress(server)
    },
  }
}

// 进程退出时清理所有连接
process.on('SIGINT', () => {
  console.log('[SSE] 正在清理所有连接...')
  connectionManager.cleanup()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('[SSE] 正在清理所有连接...')
  connectionManager.cleanup()
  process.exit(0)
})
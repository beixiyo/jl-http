import type { ViteDevServer } from 'vite'

export function progress(server: ViteDevServer) {
  // 进度数据 Mock 接口 - 带 content-length 的分块传输
  server.middlewares.use('/api/mock/progress', (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const totalSize = parseInt(url.searchParams.get('size') || '10240') // 默认 10KB
    const chunkSize = parseInt(url.searchParams.get('chunkSize') || '1024') // 默认 1KB 每块
    const delay = parseInt(url.searchParams.get('delay') || '200') // 默认 200ms 延迟

    console.log(`[Mock Progress] 开始传输数据: ${totalSize} bytes, 块大小: ${chunkSize} bytes, 延迟: ${delay}ms`)

    // 生成要传输的数据
    const generateData = (size: number): string => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let result = ''
      for (let i = 0; i < size; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return result
    }

    const totalData = generateData(totalSize)

    // 设置响应头，包含 content-length
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': totalSize.toString(),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
      'Cache-Control': 'no-cache',
    })

    let sentBytes = 0

    const sendChunk = () => {
      if (sentBytes >= totalSize) {
        console.log(`[Mock Progress] 数据传输完成: ${sentBytes}/${totalSize} bytes`)
        res.end()
        return
      }

      const remainingBytes = totalSize - sentBytes
      const currentChunkSize = Math.min(chunkSize, remainingBytes)
      const chunk = totalData.slice(sentBytes, sentBytes + currentChunkSize)

      sentBytes += currentChunkSize
      const progress = Math.round((sentBytes / totalSize) * 100)

      console.log(`[Mock Progress] 发送数据块: ${currentChunkSize} bytes, 进度: ${progress}% (${sentBytes}/${totalSize})`)

      res.write(chunk)

      if (sentBytes < totalSize) {
        setTimeout(sendChunk, delay)
      }
      else {
        res.end()
      }
    }

    // 开始发送数据
    sendChunk()

    // 处理客户端断开连接
    req.on('close', () => {
      console.log(`[Mock Progress] 客户端断开连接，已传输: ${sentBytes}/${totalSize} bytes`)
    })

    req.on('error', (error) => {
      console.error(`[Mock Progress] 请求错误:`, error)
    })
  })
}
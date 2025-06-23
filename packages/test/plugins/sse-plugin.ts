import type { Plugin } from 'vite'

/**
 * SSE 插件，为开发服务器提供模拟的 SSE 接口
 */
export function ssePlugin(): Plugin {
  return {
    name: 'sse-plugin',
    configureServer(server) {
      // 基础 SSE 流接口
      server.middlewares.use('/api/sse/stream', (req, res) => {
        // 设置 SSE 响应头
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
        })

        let counter = 0
        const maxMessages = 10

        // 发送初始连接消息
        res.write('data: {"type": "connected", "message": "SSE 连接已建立"}\n\n')

        const interval = setInterval(() => {
          counter++

          if (counter <= maxMessages) {
            const data = {
              id: counter,
              type: 'message',
              content: `这是第 ${counter} 条消息`,
              timestamp: new Date().toISOString(),
              progress: counter / maxMessages,
            }

            res.write(`data: ${JSON.stringify(data)}\n\n`)
          }
          else {
            // 发送完成消息
            res.write('data: {"type": "complete", "message": "数据流传输完成"}\n\n')
            res.write('data: [DONE]\n\n')
            clearInterval(interval)
            res.end()
          }
        }, 1000) // 每秒发送一条消息

        // 处理客户端断开连接
        req.on('close', () => {
          clearInterval(interval)
          res.end()
        })
      })

      // 聊天模拟 SSE 接口
      server.middlewares.use('/api/sse/chat', (req, res) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => {
            body += chunk.toString()
          })

          req.on('end', () => {
            try {
              const requestData = JSON.parse(body)
              const message = requestData.message || '你好'

              // 设置 SSE 响应头
              res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
              })

              // 模拟 AI 回复的流式响应
              const response = `针对您的问题"${message}"，我来为您详细解答。这是一个模拟的 AI 助手回复，用于测试 SSE 流式数据传输功能。`
              const words = response.split('')
              let index = 0

              res.write('data: {"type": "start", "message": "开始生成回复"}\n\n')

              const interval = setInterval(() => {
                if (index < words.length) {
                  const char = words[index]
                  const data = {
                    type: 'delta',
                    content: char,
                    index: index,
                    total: words.length,
                    progress: (index + 1) / words.length,
                  }

                  res.write(`data: ${JSON.stringify(data)}\n\n`)
                  index++
                }
                else {
                  res.write('data: {"type": "finish", "message": "回复生成完成"}\n\n')
                  res.write('data: [DONE]\n\n')
                  clearInterval(interval)
                  res.end()
                }
              }, 50) // 每50ms发送一个字符

              req.on('close', () => {
                clearInterval(interval)
                res.end()
              })
            }
            catch (error) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: '请求体格式错误' }))
            }
          })
        }
        else {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '仅支持 POST 请求' }))
        }
      })

      // 数字计数器 SSE 接口
      server.middlewares.use('/api/sse/counter', (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const max = parseInt(url.searchParams.get('max') || '20')
        const interval_ms = parseInt(url.searchParams.get('interval') || '500')

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
        })

        let count = 0

        const interval = setInterval(() => {
          count++

          if (count <= max) {
            const data = {
              count,
              max,
              percentage: Math.round((count / max) * 100),
              timestamp: Date.now(),
            }

            res.write(`data: ${JSON.stringify(data)}\n\n`)
          }
          else {
            res.write('data: [DONE]\n\n')
            clearInterval(interval)
            res.end()
          }
        }, interval_ms)

        req.on('close', () => {
          clearInterval(interval)
          res.end()
        })
      })

      // 随机数据 SSE 接口
      server.middlewares.use('/api/sse/random', (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
        })

        let messageCount = 0
        const maxMessages = 15

        const interval = setInterval(() => {
          messageCount++

          if (messageCount <= maxMessages) {
            const data = {
              id: messageCount,
              value: Math.random(),
              temperature: Math.round(Math.random() * 40 + 10), // 10-50度
              humidity: Math.round(Math.random() * 60 + 30), // 30-90%
              timestamp: new Date().toISOString(),
              status: messageCount < maxMessages ? 'streaming' : 'complete',
            }

            res.write(`data: ${JSON.stringify(data)}\n\n`)
          }
          else {
            res.write('data: [DONE]\n\n')
            clearInterval(interval)
            res.end()
          }
        }, 800)

        req.on('close', () => {
          clearInterval(interval)
          res.end()
        })
      })

      // 处理 CORS 预检请求
      server.middlewares.use('/api/sse/*', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
            'Access-Control-Max-Age': '86400',
          })
          res.end()
        }
        else {
          next()
        }
      })
    },
  }
}

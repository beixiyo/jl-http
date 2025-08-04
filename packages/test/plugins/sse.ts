import type { ViteDevServer } from 'vite'
import type { ServerResponse, IncomingMessage } from 'http'
import { ConnectionManager } from './ConnectManager'

export const connectionManager = new ConnectionManager()

export function sse(server: ViteDevServer) {
  // 基础 SSE 流接口
  server.middlewares.use('/api/sse/stream', (req, res) => {
    // 设置 SSE 响应头
    writeSSEHeader(res)

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

        writeSSEData(res, data)
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

  // 聊天模拟 SSE 接口 - 改进版本
  server.middlewares.use('/api/sse/chat', async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      })
      res.end(JSON.stringify({ error: '仅支持 POST 请求' }))
      return
    }

    // 生成唯一连接ID
    const connectionId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    try {
      // 解析请求体
      const requestBody = await parseRequestBody(req)
      const { message = '', model = 'gpt-3.5-turbo', stream = true } = requestBody

      console.log(`[SSE Chat] 新的聊天请求: ${connectionId}`, { message, model, stream })

      // 设置 SSE 响应头
      writeSSEHeader(res)

      // 注册连接
      connectionManager.addConnection(connectionId, req, res)
      const connection = connectionManager.getConnection(connectionId)

      if (!connection) {
        throw new Error('连接注册失败')
      }

      // 发送连接确认
      if (!writeSSEData(res, {
        type: 'connection',
        message: '聊天连接已建立',
        connectionId,
        timestamp: Date.now()
      }, 'connection', connectionId)) {
        throw new Error('发送连接确认失败')
      }

      // 模拟聊天响应
      const chatResponse = generateChatResponse(message)
      let charIndex = 0
      let messageId = 1

      // 设置心跳定时器（每30秒）
      connection.heartbeatTimer = setInterval(() => {
        if (!sendHeartbeat(res)) {
          connectionManager.removeConnection(connectionId)
        }
      }, 30000)

      // 数据传输定时器
      connection.dataTimer = setInterval(() => {
        if (charIndex < chatResponse.length) {
          // 模拟逐字符流式输出
          const chunk = chatResponse.slice(charIndex, charIndex + Math.floor(Math.random() * 5) + 1)
          charIndex += chunk.length

          const success = writeSSEData(res, {
            id: messageId++,
            type: 'message',
            content: chunk,
            isComplete: false,
            progress: charIndex / chatResponse.length,
            timestamp: Date.now()
          }, 'message', `msg_${messageId}`)

          if (!success) {
            connectionManager.removeConnection(connectionId)
            return
          }

          // 更新连接活动时间
          connectionManager.updateActivity(connectionId)
        } else {
          // 发送完成消息
          writeSSEData(res, {
            id: messageId++,
            type: 'complete',
            content: '',
            isComplete: true,
            progress: 1,
            timestamp: Date.now()
          }, 'complete', `complete_${messageId}`)

          // 发送结束标记
          res.write('data: [DONE]\n\n')

          // 清理连接
          connectionManager.removeConnection(connectionId)
        }
      }, 50 + Math.random() * 100) // 50-150ms 随机间隔，模拟真实网络延迟

      // 处理客户端断开连接
      req.on('close', () => {
        console.log(`[SSE Chat] 客户端主动断开连接: ${connectionId}`)
        connectionManager.removeConnection(connectionId)
      })

      req.on('error', (error) => {
        console.error(`[SSE Chat] 请求错误: ${connectionId}`, error)
        connectionManager.removeConnection(connectionId)
      })

    } catch (error) {
      console.error(`[SSE Chat] 处理聊天请求时出错: ${connectionId}`, error)

      // 发送错误响应
      if (!res.headersSent) {
        writeSSEHeader(res)
      }

      writeSSEData(res, {
        type: 'error',
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: Date.now()
      }, 'error')

      // 清理连接
      connectionManager.removeConnection(connectionId)
    }
  })

  // 数字计数器 SSE 接口
  server.middlewares.use('/api/sse/counter', (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const max = parseInt(url.searchParams.get('max') || '20')
    const interval_ms = parseInt(url.searchParams.get('interval') || '500')

    writeSSEHeader(res)

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

        writeSSEData(res, data)
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
    writeSSEHeader(res)

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

        writeSSEData(res, data)
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
}

function writeSSEHeader(res: ServerResponse<IncomingMessage>) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Authorization',
    'Access-Control-Expose-Headers': 'Content-Type',
    'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
  })
}


// 标准化的 SSE 数据写入
function writeSSEData(res: ServerResponse<IncomingMessage>, data: any, event?: string, id?: string) {
  try {
    // 检查连接状态
    if (res.destroyed || res.writableEnded || !res.writable) {
      console.log('[SSE] 连接已关闭，跳过数据写入')
      return false
    }

    let message = ''

    if (id) {
      message += `id: ${id}\n`
    }

    if (event) {
      message += `event: ${event}\n`
    }

    message += `data: ${JSON.stringify(data)}\n\n`

    const success = res.write(message)
    if (!success) {
      console.log('[SSE] 写入缓冲区已满，连接可能有问题')
      return false
    }

    return true
  } catch (error) {
    console.error('[SSE] 写入数据时出错:', error)
    return false
  }
}

// 发送心跳
function sendHeartbeat(res: ServerResponse<IncomingMessage>) {
  return writeSSEData(res, { type: 'heartbeat', timestamp: Date.now() }, 'heartbeat')
}

// 解析请求体
function parseRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {}
        resolve(data)
      } catch (error) {
        reject(new Error('Invalid JSON in request body'))
      }
    })

    req.on('error', reject)

    // 超时处理
    setTimeout(() => {
      reject(new Error('Request body parsing timeout'))
    }, 5000)
  })
}

// 生成模拟聊天响应
function generateChatResponse(message: string): string {
  const responses = [
    `我理解您说的"${message}"。这是一个很有趣的话题。`,
    `关于"${message}"，我想分享一些见解...`,
    `您提到的"${message}"让我想到了几个相关的观点。`,
    `这是一个关于"${message}"的详细回答，希望对您有帮助。`,
  ]

  const baseResponse = responses[Math.floor(Math.random() * responses.length)]

  // 添加一些随机的详细内容
  const details = [
    '首先，我们需要考虑这个问题的多个方面。',
    '从技术角度来看，这涉及到几个关键要素。',
    '让我为您详细解释一下相关的概念和原理。',
    '这个话题确实值得深入探讨，让我们一步步分析。',
    '基于我的理解，我认为可以从以下几个维度来思考这个问题。',
  ]

  const randomDetails = details.slice(0, Math.floor(Math.random() * 3) + 1)

  return `${baseResponse}\n\n${randomDetails.join('\n\n')}\n\n希望这个回答对您有所帮助！如果您还有其他问题，请随时告诉我。`
}
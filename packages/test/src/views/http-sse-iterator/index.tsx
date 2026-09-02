import type { SSEStream } from '@jl-org/http'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { createHttpInstance } from '@/lib/test-modules'

const http = createHttpInstance({
  baseUrl: '',
  timeout: 30000,
})

const MAX_LOG_MESSAGES = 100

function normalizeError(error: unknown) {
  if (typeof Response !== 'undefined' && error instanceof Response) {
    const status = Number.isFinite(error.status)
      ? error.status
      : '未知状态码'
    const statusText = error.statusText || '无状态文本'
    return `HTTP ${status} ${statusText}`
  }

  if (error instanceof Error)
    return error.message || error.name || '未知错误'

  if (typeof error === 'string')
    return error

  if (error && typeof error === 'object') {
    const errorObject = error as { message?: unknown, status?: unknown, statusText?: unknown }
    if (errorObject.status !== undefined) {
      const status = errorObject.status || '未知状态码'
      const statusText = typeof errorObject.statusText === 'string' && errorObject.statusText
        ? errorObject.statusText
        : '无状态文本'
      return `HTTP ${status} ${statusText}`
    }

    if (typeof errorObject.message === 'string' && errorObject.message)
      return errorObject.message

    try {
      return JSON.stringify(error) || '未知错误'
    }
    catch {
      return '未知错误'
    }
  }

  return '未知错误'
}

export default function HttpSSEIteratorTest() {
  const [messages, setMessages] = useState<Array<{ id: number, content: string, timestamp: string }>>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [inputMessage, setInputMessage] = useState('')
  const currentStreamRef = useRef<SSEStream<unknown> | null>(null)
  const messageIdRef = useRef(0)
  const generationRef = useRef(0)
  const activeGenerationRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const addMessage = (content: string) => {
    if (!mountedRef.current)
      return

    const newMessage = {
      id: ++messageIdRef.current,
      content,
      timestamp: new Date().toLocaleTimeString(),
    }

    setMessages((prev) => {
      const next = [...prev, newMessage]
      return next.length > MAX_LOG_MESSAGES
        ? next.slice(-MAX_LOG_MESSAGES)
        : next
    })
  }

  const startIteratorTest = async () => {
    if (!mountedRef.current || activeGenerationRef.current !== null)
      return

    const generation = generationRef.current + 1
    generationRef.current = generation
    activeGenerationRef.current = generation
    currentStreamRef.current = null

    setIsStreaming(true)
    setMessages([])
    messageIdRef.current = 0

    const isCurrentGeneration = () => mountedRef.current
      && generationRef.current === generation
      && activeGenerationRef.current === generation

    let stream: SSEStream<unknown> | null = null

    try {
      addMessage('🚀 开始异步迭代器测试...')

      /** fetchSSE 直接返回增量异步迭代器 */
      stream = await http.fetchSSE('/api/sse/chat', {
        method: 'POST',
        body: { message: inputMessage || '测试异步迭代器功能' },
        doneSignal: '[DONE]',
      })

      if (!isCurrentGeneration()) {
        stream.cancel()
        return
      }

      currentStreamRef.current = stream

      addMessage('✅ 迭代器已创建，开始接收数据...')

      let chunkCount = 0
      let totalLength = 0
      for await (const message of stream) {
        chunkCount++
        totalLength += message.dataText.length
        addMessage(`📦 收到第 ${chunkCount} 个事件: ${message.dataText}`)
        addMessage(`📊 页面已处理: ${totalLength} 字符`)
      }

      if (!isCurrentGeneration())
        return

      addMessage('✅ 流结束，测试完成！')
    }
    catch (error: unknown) {
      if (!isCurrentGeneration())
        return

      addMessage(`❌ 错误: ${normalizeError(error)}`)
    }
    finally {
      if (currentStreamRef.current === stream)
        currentStreamRef.current = null

      if (activeGenerationRef.current === generation) {
        activeGenerationRef.current = null
        if (mountedRef.current)
          setIsStreaming(false)
      }
    }
  }

  const cancelIteratorTest = () => {
    const generation = activeGenerationRef.current
    if (generation === null)
      return

    const stream = currentStreamRef.current
    currentStreamRef.current = null
    activeGenerationRef.current = null

    try {
      stream?.cancel()
    }
    catch {
      /** 取消本身幂等；取消请求已经提交，忽略实现层同步异常 */
    }

    if (mountedRef.current) {
      setIsStreaming(false)
      addMessage('⏹️ 流已取消')
    }
  }

  const clearMessages = () => {
    setMessages([])
    messageIdRef.current = 0
  }

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      generationRef.current++
      activeGenerationRef.current = null

      const stream = currentStreamRef.current
      currentStreamRef.current = null
      try {
        stream?.cancel()
      }
      catch {
        /** 卸载时已提交取消请求，忽略实现层同步异常 */
      }
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center h-12 w-12 justify-center rounded-xl from-blue-500 to-purple-600 bg-linear-to-br text-white">
            <span className="text-2xl">🔄</span>
          </div>
          <div>
            <h1 className="to-purple-600 from-blue-600 bg-linear-to-r bg-clip-text text-3xl text-transparent font-bold">
              SSE 异步迭代器测试
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              使用 for await...of 语法测试流式数据接收
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="mb-4 text-xl font-semibold">测试控制</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">测试消息</label>
            <Input
              value={inputMessage}
              onChange={setInputMessage}
              placeholder="输入测试消息（可选）"
              disabled={isStreaming}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={startIteratorTest}
              disabled={isStreaming}
              className="flex-1"
            >
              { isStreaming
                ? '🔄 测试进行中...'
                : '🚀 开始迭代器测试' }
            </Button>
            <Button
              onClick={cancelIteratorTest}
              disabled={!isStreaming}
              designStyle="outlined"
              variant="danger"
            >
              取消流
            </Button>
            <Button
              onClick={clearMessages}
              disabled={isStreaming}
              designStyle="outlined"
            >
              清空消息
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">测试日志</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${isStreaming
              ? 'bg-green-500 animate-pulse'
              : 'bg-gray-300'}`}
            >
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              { isStreaming
                ? '运行中'
                : '就绪' }
            </span>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2">
          { messages.length === 0
            ? (
                <div className="flex items-center justify-center flex-col py-12 text-gray-500">
                  <div className="mb-3 text-4xl">📋</div>
                  <p className="text-sm">暂无测试日志</p>
                  <p className="mt-1 text-xs">点击"开始迭代器测试"开始</p>
                </div>
              )
            : (
                messages.map(message => (
                  <div
                    key={message.id}
                    className="border border-gray-200 rounded-lg bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <span className="flex-1 text-sm">{ message.content }</span>
                      <span className="text-xs text-gray-500 shrink-0">{ message.timestamp }</span>
                    </div>
                  </div>
                ))
              ) }
        </div>
      </Card>

      <Card className="p-6 mt-6">
        <h2 className="mb-4 text-xl font-semibold">代码示例</h2>
        <div className="rounded-lg overflow-x-auto bg-gray-900 p-4 text-gray-100">
          <pre className="text-sm">
            { `// fetchSSE 返回增量异步迭代器
const stream = await http.fetchSSE('/api/sse/chat', {
  method: 'POST',
  body: { message: '你好！' },
  doneSignal: '[DONE]',
})

// 使用 for await...of 遍历数据流
for await (const message of stream) {
  console.log('当前内容:', message.dataText)

  // 可以随时 break 停止
  if (message.dataText === 'stop') {
    break
  }
}`}
          </pre>
        </div>
      </Card>

      <Card className="mt-6 bg-linear-to-r p-6 border-blue-200 from-blue-50 to-purple-50 dark:border-blue-800 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
              迭代器模式的优势
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 dark:text-blue-200">
              <li>
                ✅
                <strong>更简洁的代码</strong>
                { ' ' }
                - 使用 for await...of 替代回调
              </li>
              <li>
                ✅
                <strong>更好的控制流</strong>
                { ' ' }
                - 可以使用 break/continue
              </li>
              <li>
                ✅
                <strong>自动资源管理</strong>
                { ' ' }
                - 支持提前终止和清理
              </li>
              <li>
                ✅
                <strong>符合标准</strong>
                { ' ' }
                - 使用 JavaScript 异步迭代器协议
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}

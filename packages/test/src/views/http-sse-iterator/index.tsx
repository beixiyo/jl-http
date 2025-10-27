import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { createHttpInstance } from '@/lib/test-modules'

const http = createHttpInstance({
  baseUrl: '',
  timeout: 30000,
})

export default function HttpSSEIteratorTest() {
  const [messages, setMessages] = useState<Array<{ id: number, content: string, timestamp: string }>>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [inputMessage, setInputMessage] = useState('')
  let currentId = 0

  const addMessage = (content: string) => {
    const newMessage = {
      id: ++currentId,
      content,
      timestamp: new Date().toLocaleTimeString(),
    }
    setMessages(prev => [...prev, newMessage])
  }

  const startIteratorTest = async () => {
    if (isStreaming)
      return

    setIsStreaming(true)
    setMessages([])
    currentId = 0

    try {
      addMessage('🚀 开始异步迭代器测试...')

      /** 使用异步迭代器 */
      const iterator = http.fetchSSEAsIterator('/api/sse/chat', {
        method: 'POST',
        body: { message: inputMessage || '测试异步迭代器功能', }
      })

      addMessage('✅ 迭代器已创建，开始接收数据...')

      let chunkCount = 0
      for await (const data of iterator) {
        chunkCount++
        addMessage(`📦 收到第 ${chunkCount} 个数据块: ${data.currentContent}`)
        addMessage(`📊 累积内容长度: ${data.allContent.length} 字符`)
      }

      addMessage('✅ 流结束，测试完成！')
    }
    catch (error: any) {
      addMessage(`❌ 错误: ${error.message}`)
    }
    finally {
      setIsStreaming(false)
    }
  }

  const clearMessages = () => {
    setMessages([])
    currentId = 0
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-12 w-12 flex items-center justify-center rounded-xl from-blue-500 to-purple-600 bg-gradient-to-br text-white">
            <span className="text-2xl">🔄</span>
          </div>
          <div>
            <h1 className="from-blue-600 to-purple-600 bg-gradient-to-r bg-clip-text text-3xl text-transparent font-bold">
              SSE 异步迭代器测试
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              使用 for await...of 语法测试流式数据接收
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">测试控制</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">测试消息</label>
            <Input
              value={ inputMessage }
              onChange={ setInputMessage }
              placeholder="输入测试消息（可选）"
              disabled={ isStreaming }
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={ startIteratorTest }
              disabled={ isStreaming }
              className="flex-1"
            >
              { isStreaming
                ? '🔄 测试进行中...'
                : '🚀 开始迭代器测试' }
            </Button>
            <Button
              onClick={ clearMessages }
              disabled={ isStreaming }
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
            <span className={ `h-2 w-2 rounded-full ${isStreaming
              ? 'bg-green-500 animate-pulse'
              : 'bg-gray-300'}` }></span>
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
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <div className="mb-3 text-4xl">📋</div>
                <p className="text-sm">暂无测试日志</p>
                <p className="mt-1 text-xs">点击"开始迭代器测试"开始</p>
              </div>
            )
            : (
              messages.map(message => (
                <div
                  key={ message.id }
                  className="border border-gray-200 rounded-lg bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex-1 text-sm">{ message.content }</span>
                    <span className="flex-shrink-0 text-xs text-gray-500">{ message.timestamp }</span>
                  </div>
                </div>
              ))
            ) }
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">代码示例</h2>
        <div className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-gray-100">
          <pre className="text-sm">
            { `// 使用异步迭代器接收 SSE 数据
const iterator = http.fetchSSEAsIterator('/api/sse/chat', {
  method: 'POST',
  body: JSON.stringify({ message: '你好！' }),
})

// 使用 for await...of 遍历数据流
for await (const data of iterator) {
  console.log('当前内容:', data.currentContent)
  console.log('累积内容:', data.allContent)

  // 可以随时 break 停止
  if (data.allContent.length > 1000) {
    break
  }
}`}
          </pre>
        </div>
      </Card>

      <Card className="mt-6 border-blue-200 from-blue-50 to-purple-50 bg-gradient-to-r p-6 dark:border-blue-800 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="mb-2 text-blue-900 font-semibold dark:text-blue-100">
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

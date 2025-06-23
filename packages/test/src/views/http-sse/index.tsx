import type { SSEData } from '@jl-org/http'
import { Http, type SSEOptions } from '@jl-org/http'
import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input, Textarea } from '@/components/Input'
import { Select } from '@/components/Select'
import { cn } from '@/utils'

/** 创建 HTTP 实例 */
const http = new Http({
  baseUrl: '', // 使用不同的 SSE 服务
  timeout: 30000,
  reqInterceptor: (config) => {
    console.log('SSE 请求拦截器:', config)
    return config
  },
  respErrInterceptor: (error) => {
    console.error('SSE 错误拦截器:', error)
  },
})

interface SSELog {
  id: number
  timestamp: string
  url: string
  method: string
  status: 'connecting' | 'streaming' | 'completed' | 'error' | 'cancelled'
  duration: number
  messageCount: number
  totalContent: string
  error?: string
  progress: number
}

interface SSEMessage {
  id: number
  timestamp: string
  content: string
  jsonData?: any
  isComplete?: boolean
}

export default function HttpSSETest() {
  const [logs, setLogs] = useState<SSELog[]>([])
  const [messages, setMessages] = useState<SSEMessage[]>([])
  const [currentConnection, setCurrentConnection] = useState<{ cancel: () => void } | null>(null)
  const [sseUrl, setSseUrl] = useState('/api/sse/stream')
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const [requestBody, setRequestBody] = useState('{"message": "Hello SSE"}')
  const [needParseData, setNeedParseData] = useState(true)
  const [needParseJSON, setNeedParseJSON] = useState(false)
  const [dataPrefix, setDataPrefix] = useState('data:')
  const [separator, setSeparator] = useState('\n\n')
  const [doneSignal, setDoneSignal] = useState('[DONE]')
  const logIdRef = useRef(0)
  const messageIdRef = useRef(0)

  const addLog = useCallback((log: Omit<SSELog, 'id' | 'timestamp'>) => {
    const newLog: SSELog = {
      ...log,
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLogs(prev => [newLog, ...prev])
    return newLog
  }, [])

  const updateLog = useCallback((id: number, updates: Partial<SSELog>) => {
    setLogs(prev => prev.map(log =>
      log.id === id
        ? { ...log, ...updates }
        : log,
    ))
  }, [])

  const addMessage = useCallback((content: string, jsonData?: any, isComplete = false) => {
    const newMessage: SSEMessage = {
      id: ++messageIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
      content,
      jsonData,
      isComplete,
    }
    setMessages(prev => [newMessage, ...prev])
  }, [])

  const startSSEConnection = useCallback(async () => {
    if (currentConnection) {
      currentConnection.cancel()
      setCurrentConnection(null)
    }

    setMessages([])
    const startTime = Date.now()

    const log = addLog({
      url: sseUrl,
      method,
      status: 'connecting',
      duration: 0,
      messageCount: 0,
      totalContent: '',
      progress: 0,
    })

    try {
      const config: SSEOptions = {
        method,
        needParseData,
        needParseJSON,
        dataPrefix,
        separator,
        doneSignal,
        ...(method === 'POST' && { body: JSON.parse(requestBody || '{}') }),
        onMessage: (data: SSEData) => {
          console.log('SSE onMessage 收到数据:', data)
          const duration = Date.now() - startTime
          updateLog(log.id, {
            status: 'streaming',
            duration,
            messageCount: data.allJson.length || data.allContent.split('\n').filter(Boolean).length,
            totalContent: data.allContent,
          })

          /** 添加新消息 */
          if (data.currentContent) {
            console.log('添加新消息:', data.currentContent)
            addMessage(
              data.currentContent,
              data.currentJson.length > 0
                ? data.currentJson
                : undefined,
            )
          }
        },
        onProgress: (progress: number) => {
          console.log('SSE onProgress:', progress)
          updateLog(log.id, {
            progress: progress > 0 && progress !== Infinity
              ? progress
              : 0,
          })
        },
        onError: (error: any) => {
          console.error('SSE onError:', error)
          const duration = Date.now() - startTime
          updateLog(log.id, {
            status: 'error',
            duration,
            error: error.message || '连接错误',
          })
        },
      }

      const { promise, cancel } = await http.fetchSSE(sseUrl, config)
      setCurrentConnection({ cancel })

      updateLog(log.id, { status: 'streaming' })

      const finalData = await promise
      const duration = Date.now() - startTime

      updateLog(log.id, {
        status: 'completed',
        duration,
        messageCount: finalData.allJson.length || finalData.allContent.split('\n').filter(Boolean).length,
        totalContent: finalData.allContent,
      })

      /** 添加完成标记 */
      addMessage('连接已完成', undefined, true)
      setCurrentConnection(null)
    }
    catch (err: any) {
      const duration = Date.now() - startTime
      if (err.name === 'AbortError' || err.message?.includes('cancel')) {
        updateLog(log.id, {
          status: 'cancelled',
          duration,
          error: '连接已取消',
        })
        addMessage('连接已取消', undefined, true)
      }
      else {
        updateLog(log.id, {
          status: 'error',
          duration,
          error: err.message || 'SSE 连接失败',
        })
        addMessage(`连接错误: ${err.message}`, undefined, true)
      }
      setCurrentConnection(null)
    }
  }, [
    currentConnection,
    sseUrl,
    method,
    needParseData,
    needParseJSON,
    dataPrefix,
    separator,
    doneSignal,
    requestBody,
    addLog,
    updateLog,
    addMessage,
  ])

  const cancelConnection = useCallback(() => {
    if (currentConnection) {
      currentConnection.cancel()
      setCurrentConnection(null)
    }
  }, [currentConnection])

  const clearLogs = useCallback(() => {
    cancelConnection()
    setLogs([])
    setMessages([])
    logIdRef.current = 0
    messageIdRef.current = 0
  }, [cancelConnection])

  const sseEndpoints = [
    {
      name: '基础数据流',
      url: '/api/sse/stream',
      method: 'GET' as const,
      parseData: true,
      parseJSON: true,
      description: '本地模拟的基础SSE数据流',
    },
    {
      name: '聊天对话流',
      url: '/api/sse/chat',
      method: 'POST' as const,
      parseData: true,
      parseJSON: true,
      description: '模拟AI聊天的流式回复',
    },
    {
      name: '计数器流',
      url: '/api/sse/counter?max=20&interval=500',
      method: 'GET' as const,
      parseData: true,
      parseJSON: true,
      description: '数字计数器数据流',
    },
    {
      name: '随机数据流',
      url: '/api/sse/random',
      method: 'GET' as const,
      parseData: true,
      parseJSON: true,
      description: '随机传感器数据流',
    },
    {
      name: '自定义端点',
      url: '',
      method: 'GET' as const,
      parseData: true,
      parseJSON: true,
      description: '输入自定义SSE端点',
    },
  ]

  const loadEndpoint = useCallback((endpoint: typeof sseEndpoints[0]) => {
    if (endpoint.url) {
      setSseUrl(endpoint.url)
    }
    setMethod(endpoint.method)
    setNeedParseData(endpoint.parseData)
    setNeedParseJSON(endpoint.parseJSON)
  }, [])

  const getStatusColor = (status: SSELog['status']) => {
    switch (status) {
      case 'connecting':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'streaming':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'completed':
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
      case 'cancelled':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
  }

  const getStatusText = (status: SSELog['status']) => {
    switch (status) {
      case 'connecting': return '连接中'
      case 'streaming': return '流式传输中'
      case 'completed': return '已完成'
      case 'cancelled': return '已取消'
      case 'error': return '错误'
      default: return '未知'
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">SSE 流式数据功能测试</h1>
        <p className="text-gray-600 dark:text-gray-400">
          测试 jl-http 的 SSE 流式数据处理功能，包括实时数据接收、数据解析、连接管理等特性
        </p>
        <div className="mt-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>提示</strong>: 本页面提供了多个本地模拟的 SSE 接口用于测试，无需依赖外部服务。
            你可以选择预设端点或输入自定义 URL 进行测试。
          </p>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-300">
            🌐 开发服务器: <code>{ window.location.origin }</code> |
            📡 SSE 接口: <code>/api/sse/*</code>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 配置面板 */ }
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">SSE 配置</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">SSE 端点 URL</label>
              <Input
                value={ sseUrl }
                onChange={ setSseUrl }
                placeholder="输入 SSE 端点 URL"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">请求方法</label>
              <Select
                value={ method }
                onChange={ value => setMethod(value as any) }
                options={ [
                  { label: 'GET', value: 'GET' },
                  { label: 'POST', value: 'POST' },
                ] }
              />
            </div>

            { method === 'POST' && (
              <div>
                <label className="mb-2 block text-sm font-medium">请求体 (JSON)</label>
                <Textarea
                  value={ requestBody }
                  onChange={ setRequestBody }
                  className="h-20 w-full resize-none border rounded-lg p-3 text-sm font-mono"
                  placeholder="输入 JSON 格式的请求体"
                />
              </div>
            ) }

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="needParseData"
                  checked={ needParseData }
                  onChange={ e => setNeedParseData(e.target.checked) }
                  className="rounded"
                />
                <label htmlFor="needParseData" className="text-sm">
                  解析 SSE 数据
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="needParseJSON"
                  checked={ needParseJSON }
                  onChange={ e => setNeedParseJSON(e.target.checked) }
                  className="rounded"
                />
                <label htmlFor="needParseJSON" className="text-sm">
                  解析 JSON
                </label>
              </div>
            </div>

            { needParseData && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium">数据前缀</label>
                  <Input
                    value={ dataPrefix }
                    onChange={ setDataPrefix }
                    placeholder="data:"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">分隔符</label>
                  <Input
                    value={ separator }
                    onChange={ setSeparator }
                    placeholder="\\n\\n"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">结束信号</label>
                  <Input
                    value={ doneSignal }
                    onChange={ setDoneSignal }
                    placeholder="[DONE]"
                  />
                </div>
              </>
            ) }

            <div className="flex gap-2">
              <Button
                onClick={ startSSEConnection }
                disabled={ !!currentConnection }
                className="flex-1"
              >
                { currentConnection
                  ? '连接中...'
                  : '开始连接' }
              </Button>
              { currentConnection && (
                <Button
                  onClick={ cancelConnection }
                  variant="primary"
                >
                  取消
                </Button>
              ) }
            </div>
          </div>
        </Card>

        {/* 实时消息 */ }
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">实时消息</h2>
            <Button onClick={ () => setMessages([]) } designStyle="outlined" size="sm">
              清空消息
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            { messages.length === 0
              ? (
                <p className="py-8 text-center text-gray-500">暂无消息</p>
              )
              : (
                messages.map(message => (
                  <div
                    key={ message.id }
                    className={ cn(
                      'p-3 rounded-lg border text-sm',
                      message.isComplete
                        ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                    ) }
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{ message.timestamp }</span>
                      { message.isComplete && (
                        <span className="rounded bg-gray-200 px-2 py-1 text-xs dark:bg-gray-700">
                          完成
                        </span>
                      ) }
                    </div>
                    <div className="break-all text-sm font-mono">
                      { message.content }
                    </div>
                    { message.jsonData && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500">
                          JSON 数据
                        </summary>
                        <pre className="mt-1 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">
                          { JSON.stringify(message.jsonData, null, 2) }
                        </pre>
                      </details>
                    ) }
                  </div>
                ))
              ) }
          </div>
        </Card>
      </div>

      {/* 连接日志 */ }
      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">连接日志</h2>
          <Button onClick={ clearLogs } designStyle="outlined" size="sm">
            清空日志
          </Button>
        </div>

        <div className="space-y-3">
          { logs.length === 0
            ? (
              <p className="py-8 text-center text-gray-500">暂无连接日志</p>
            )
            : (
              logs.map(log => (
                <div
                  key={ log.id }
                  className={ cn('p-4 rounded-lg border', getStatusColor(log.status)) }
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">
                      { log.method }
                      { ' ' }
                      { log.url }
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="rounded bg-white/50 px-2 py-1 dark:bg-black/20">
                        { getStatusText(log.status) }
                      </span>
                      <span>
                        耗时:
                        { log.duration }
                        ms
                      </span>
                    </div>
                  </div>

                  <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                    { log.timestamp }
                    { ' ' }
                    | 消息数:
                    { log.messageCount }
                    { log.progress > 0 && log.progress !== Infinity && ` | 进度: ${(log.progress * 100).toFixed(1)}%` }
                  </div>

                  { log.status === 'streaming' && (
                    <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                      <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-current"></div>
                      数据流传输中...
                    </div>
                  ) }

                  { log.error && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      错误:
                      { ' ' }
                      { log.error }
                    </div>
                  ) }
                </div>
              ))
            ) }
        </div>
      </Card>

      {/* 预设端点 */ }
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">预设 SSE 端点</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 md:grid-cols-2">
          { sseEndpoints.map((endpoint, index) => (
            <div key={ index } className="border rounded-lg p-4">
              <h3 className="mb-2 font-medium">{ endpoint.name }</h3>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                { endpoint.description }
              </p>
              <div className="mb-3 text-xs text-gray-500">
                { endpoint.method }
                { ' ' }
                | 解析:
                { endpoint.parseData
                  ? '是'
                  : '否' }
              </div>
              <Button
                onClick={ () => loadEndpoint(endpoint) }
                size="sm"
                className="w-full"
                designStyle="outlined"
              >
                加载配置
              </Button>
            </div>
          )) }
        </div>
      </Card>

      {/* 功能说明 */ }
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">SSE 功能说明</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ul>
            <li>
              <strong>实时数据流</strong>
              ：支持 Server-Sent Events 协议的实时数据接收
            </li>
            <li>
              <strong>数据解析</strong>
              ：自动解析 SSE 格式数据，支持自定义前缀和分隔符
            </li>
            <li>
              <strong>JSON 解析</strong>
              ：可选的 JSON 数据自动解析功能
            </li>
            <li>
              <strong>连接管理</strong>
              ：支持连接取消、错误处理、进度跟踪
            </li>
            <li>
              <strong>灵活配置</strong>
              ：支持 GET/POST 请求，自定义请求头和请求体
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

import type { SSEOptions, SSEStream } from '@jl-org/http'
import type { ChatMessage, SSEConnectionOptions, SSELog, SSEMessage } from './type'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { Textarea } from '@/components/Textarea'
import { createHttpInstance } from '@/lib/test-modules'
import { createIntegratedPageProps } from '@/lib/test-modules/integration'
import { cn } from '@/utils'

const http = createHttpInstance({
  baseUrl: '', // 使用不同的 SSE 服务
  timeout: 30000,
})

const MAX_LOG_ENTRIES = 50
const MAX_SSE_MESSAGES = 100
const MAX_CHAT_MESSAGES = 50

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function formatHttpError(status: number, statusText?: string): string {
  const parts = [`HTTP ${status}`]
  if (statusText)
    parts.push(statusText)
  return parts.join(' ')
}

function getSSEErrorMessage(error: unknown): string {
  if (typeof Response !== 'undefined' && error instanceof Response) {
    return formatHttpError(error.status, error.statusText)
  }

  if (error instanceof Error)
    return error.message || error.name || 'SSE 连接失败'

  if (typeof error === 'string' && error)
    return error

  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint')
    return String(error)

  if (isRecord(error) && typeof error.status === 'number') {
    let statusText: string | undefined
    if (typeof error.statusText === 'string')
      statusText = error.statusText
    return formatHttpError(error.status, statusText)
  }

  try {
    const serialized = JSON.stringify(error)
    if (serialized)
      return serialized
  }
  catch {
    /** 某些错误值无法序列化，继续使用统一的兜底文本 */
  }

  return '未知 SSE 错误'
}

function isSSECancellation(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted)
    return true

  if (error instanceof DOMException)
    return error.name === 'AbortError'

  return error instanceof Error
    && (error.name === 'AbortError' || error.message.toLowerCase().includes('cancel'))
}

export default function HttpSSETest() {
  const [showManualTest, setShowManualTest] = useState(true)

  if (!showManualTest) {
    return <AutoTestMode onSwitchToManual={ () => setShowManualTest(true) } />
  }

  return <ManualTestMode onBack={ () => setShowManualTest(false) } />
}

function AutoTestMode({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const props = createIntegratedPageProps('http-sse')

  return (
    <div className="mx-auto max-w-7xl p-6">
      <TestModuleRunner
        { ...props }
        onTestComplete={ (scenarioId, result) => {
          console.log(`SSE 测试完成: ${scenarioId}`, result)
        } }
      />

      {/* 切换到手动测试 */ }
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">手动测试模式</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              切换到手动测试模式，可以自定义 SSE 参数进行测试
            </p>
          </div>
          <Button onClick={ onSwitchToManual } designStyle="outlined">
            切换到手动测试
          </Button>
        </div>
      </Card>
    </div>
  )
}

function ManualTestMode({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<SSELog[]>([])
  const [messages, setMessages] = useState<SSEMessage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [currentConnection, setCurrentConnection] = useState<{ cancel: () => void } | null>(null)
  const [sseUrl, setSseUrl] = useState('/api/sse/chat')
  const [method, setMethod] = useState<'GET' | 'POST'>('POST')
  const [requestBody, setRequestBody] = useState('{"message": "你好，请介绍一下 SSE 技术的优势和应用场景"}')
  const [needParseJSON, setNeedParseJSON] = useState(true)
  const [dataPrefix, setDataPrefix] = useState('data:')
  const [doneSignal, setDoneSignal] = useState('[DONE]')
  const [currentChatMessage, setCurrentChatMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'advanced'>('chat')
  const logIdRef = useRef(0)
  const messageIdRef = useRef(0)
  const chatIdRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const activeStreamRef = useRef<SSEStream<unknown> | null>(null)
  const activeCancelRef = useRef<(() => void) | null>(null)
  const connectionGenerationRef = useRef(0)
  const mountedRef = useRef(true)

  const addLog = useCallback((log: Omit<SSELog, 'id' | 'timestamp'>) => {
    const newLog: SSELog = {
      ...log,
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLogs(prev => [newLog, ...prev].slice(0, MAX_LOG_ENTRIES))
    return newLog
  }, [])

  const updateLog = useCallback((id: number, updates: Partial<SSELog>) => {
    setLogs(prev => prev.map(log =>
      log.id === id
        ? { ...log, ...updates }
        : log,
    ))
  }, [])

  const addMessage = useCallback((content: string, jsonData?: unknown, isComplete = false, type?: SSEMessage['type']) => {
    const newMessage: SSEMessage = {
      id: ++messageIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
      content,
      jsonData,
      isComplete,
      type,
      progress: isRecord(jsonData) && typeof jsonData.progress === 'number'
        ? jsonData.progress
        : undefined,
    }
    setMessages(prev => [newMessage, ...prev].slice(0, MAX_SSE_MESSAGES))
  }, [])

  /** 聊天消息管理 */
  const addChatMessage = useCallback((role: 'user' | 'assistant', content: string, isStreaming = false) => {
    const newMessage: ChatMessage = {
      id: `chat_${++chatIdRef.current}`,
      role,
      content,
      timestamp: Date.now(),
      isStreaming,
    }
    setChatMessages(prev => [...prev, newMessage].slice(-MAX_CHAT_MESSAGES))
    return newMessage.id
  }, [])

  const updateChatMessage = useCallback((id: string, content: string | ((prev: string) => string), isStreaming = false, progress?: number) => {
    setChatMessages(prev => prev.map(msg =>
      msg.id === id
        ? {
            ...msg,
            content: typeof content === 'function'
              ? content(msg.content)
              : content,
            isStreaming,
            progress,
          }
        : msg,
    ))
  }, [])

  /** 滚动到底部 */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /** 只在新消息添加时滚动，不在内容更新时滚动 */
  const lastMessageCountRef = useRef(0)
  useEffect(() => {
    if (chatMessages.length > lastMessageCountRef.current) {
      scrollToBottom()
      lastMessageCountRef.current = chatMessages.length
    }
  }, [chatMessages.length, scrollToBottom])

  const cancelActiveConnection = useCallback(() => {
    activeCancelRef.current?.()
    activeCancelRef.current = null
    activeStreamRef.current = null
  }, [])

  const cancelConnection = useCallback(() => {
    connectionGenerationRef.current++
    cancelActiveConnection()
    setCurrentConnection(null)
  }, [cancelActiveConnection])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      connectionGenerationRef.current++
      cancelActiveConnection()
    }
  }, [cancelActiveConnection])

  const startSSEConnection = useCallback(async (options: SSEConnectionOptions = {}) => {
    cancelActiveConnection()
    const generation = ++connectionGenerationRef.current
    const connectionUrl = options.url ?? sseUrl
    const connectionMethod = options.method ?? method
    const connectionRequestBody = options.requestBody ?? requestBody
    const controller = new AbortController()
    const isCurrentConnection = () => mountedRef.current && connectionGenerationRef.current === generation

    activeCancelRef.current = () => {
      controller.abort()
      activeStreamRef.current?.cancel()
    }
    setCurrentConnection({ cancel: cancelConnection })
    setMessages([])
    const startTime = Date.now()
    let currentAssistantMessageId: string | null = null
    let streamError = false

    /** 如果是聊天模式，添加用户消息 */
    if (connectionUrl.includes('/api/sse/chat') && connectionMethod === 'POST') {
      try {
        const body = JSON.parse(connectionRequestBody || '{}') as { message?: unknown }
        const bodyMessage = typeof body.message === 'string'
          ? body.message
          : undefined
        const chatMessage = options.chatMessage ?? bodyMessage
        if (chatMessage)
          addChatMessage('user', chatMessage)
      }
      catch {
        if (options.chatMessage)
          addChatMessage('user', options.chatMessage)
      }
    }

    const log = addLog({
      url: connectionUrl,
      method: connectionMethod,
      status: 'connecting',
      duration: 0,
      messageCount: 0,
      dataLength: 0,
      progress: 0,
    })

    const finishAssistantMessage = (progress?: number) => {
      if (currentAssistantMessageId)
        updateChatMessage(currentAssistantMessageId, prev => prev, false, progress)
    }

    try {
      const config: SSEOptions<unknown> = {
        baseUrl: '',
        method: connectionMethod,
        signal: controller.signal,
        dataPrefix,
        doneSignal: doneSignal || undefined,
        parseData: needParseJSON
          ? JSON.parse
          : dataText => dataText,
        ...(connectionMethod === 'POST' && { body: JSON.parse(connectionRequestBody || '{}') }),
      }

      const stream = await http.fetchSSE(connectionUrl, config)
      if (!isCurrentConnection()) {
        stream.cancel()
        if (mountedRef.current && controller.signal.aborted) {
          updateLog(log.id, {
            status: 'cancelled',
            duration: Date.now() - startTime,
            error: '连接已取消',
          })
        }
        return
      }

      activeStreamRef.current = stream
      updateLog(log.id, { status: 'streaming' })

      let messageCount = 0
      let dataLength = 0
      for await (const event of stream) {
        if (!isCurrentConnection()) {
          stream.cancel()
          return
        }

        const duration = Date.now() - startTime
        const jsonData = needParseJSON && isRecord(event.data)
          ? event.data
          : undefined
        const messageType = typeof jsonData?.type === 'string'
          ? jsonData.type
          : undefined
        const progress = typeof jsonData?.progress === 'number'
          ? jsonData.progress
          : undefined
        const messageContent = typeof jsonData?.content === 'string'
          ? jsonData.content
          : event.dataText
        messageCount++
        dataLength += event.dataText.length

        updateLog(log.id, {
          status: 'streaming',
          duration,
          messageCount,
          dataLength,
          progress: progress ?? 0,
        })

        if (messageType === 'connection') {
          addMessage('🔗 连接已建立', jsonData, false, 'connection')
          if (connectionUrl.includes('/api/sse/chat'))
            currentAssistantMessageId = addChatMessage('assistant', '', true)
        }
        else if (messageType === 'message' && messageContent) {
          addMessage(messageContent, jsonData, false, 'message')
          if (currentAssistantMessageId && connectionUrl.includes('/api/sse/chat'))
            updateChatMessage(currentAssistantMessageId, prev => prev + messageContent, true, progress)
        }
        else if (messageType === 'complete') {
          addMessage('✅ 传输完成', jsonData, true, 'complete')
          finishAssistantMessage(1)
        }
        else if (messageType === 'heartbeat') {
          addMessage('💓 心跳', jsonData, false, 'heartbeat')
        }
        else if (messageType === 'error') {
          addMessage('❌ 错误', jsonData, true, 'error')
          streamError = true
          finishAssistantMessage()
        }
        else if (messageContent) {
          addMessage(messageContent, event.data)
        }
      }

      if (!isCurrentConnection()) {
        if (mountedRef.current && controller.signal.aborted) {
          finishAssistantMessage()
          updateLog(log.id, {
            status: 'cancelled',
            duration: Date.now() - startTime,
            error: '连接已取消',
          })
        }
        return
      }

      const duration = Date.now() - startTime
      finishAssistantMessage(streamError
        ? undefined
        : 1)

      updateLog(log.id, {
        status: streamError
          ? 'error'
          : 'completed',
        duration,
        messageCount,
        dataLength,
      })

      if (!streamError)
        addMessage('连接已完成', undefined, true)
    }
    catch (error: unknown) {
      const cancelled = isSSECancellation(error, controller.signal)
      if (!isCurrentConnection()) {
        if (mountedRef.current) {
          finishAssistantMessage()
          updateLog(log.id, {
            status: cancelled
              ? 'cancelled'
              : 'error',
            duration: Date.now() - startTime,
            error: cancelled
              ? '连接已取消'
              : getSSEErrorMessage(error),
          })
        }
        return
      }

      const duration = Date.now() - startTime
      finishAssistantMessage()
      if (cancelled) {
        updateLog(log.id, {
          status: 'cancelled',
          duration,
          error: '连接已取消',
        })
        addMessage('连接已取消', undefined, true)
      }
      else {
        const errorMessage = getSSEErrorMessage(error)
        updateLog(log.id, {
          status: 'error',
          duration,
          error: errorMessage,
        })
        addMessage(`连接错误: ${errorMessage}`, undefined, true, 'error')
      }
    }
    finally {
      if (isCurrentConnection()) {
        activeStreamRef.current = null
        activeCancelRef.current = null
        setCurrentConnection(null)
      }
    }
  }, [
    cancelActiveConnection,
    cancelConnection,
    sseUrl,
    method,
    needParseJSON,
    dataPrefix,
    doneSignal,
    requestBody,
    addLog,
    updateLog,
    addMessage,
  ])

  const clearLogs = useCallback(() => {
    cancelConnection()
    setLogs([])
    setMessages([])
  }, [cancelConnection])

  const sseEndpoints = [
    {
      name: '🚀 基础数据流',
      url: '/api/sse/stream',
      method: 'GET' as const,
      parseJSON: true,
      description: '体验基础的 SSE 数据流传输，包含连接状态和进度信息',
      icon: '🚀',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      name: '💬 AI 聊天对话',
      url: '/api/sse/chat',
      method: 'POST' as const,
      parseJSON: true,
      description: '模拟 AI 助手的智能对话，支持流式响应和进度跟踪',
      icon: '💬',
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: '🔢 计数器流',
      url: '/api/sse/counter?max=20&interval=500',
      method: 'GET' as const,
      parseJSON: true,
      description: '数字递增计数器，可自定义最大值和时间间隔',
      icon: '🔢',
      color: 'from-green-500 to-teal-500',
    },
    {
      name: '📊 随机数据流',
      url: '/api/sse/random',
      method: 'GET' as const,
      parseJSON: true,
      description: '模拟传感器数据，包含温度、湿度等随机指标',
      icon: '📊',
      color: 'from-orange-500 to-red-500',
    },
    {
      name: '🔧 自定义端点',
      url: '',
      method: 'GET' as const,
      parseJSON: true,
      description: '配置你自己的 SSE 端点进行测试',
      icon: '🔧',
      color: 'from-gray-500 to-slate-500',
    },
  ]

  const loadEndpoint = useCallback((endpoint: typeof sseEndpoints[0]) => {
    setSseUrl(endpoint.url)
    setMethod(endpoint.method)
    setNeedParseJSON(endpoint.parseJSON)
    setDataPrefix('data:')
    setDoneSignal('[DONE]')
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

  /** 发送聊天消息 */
  const sendChatMessage = useCallback(async () => {
    if (!currentChatMessage.trim() || activeCancelRef.current)
      return

    const message = currentChatMessage.trim()
    setCurrentChatMessage('')

    /** 更新请求体 */
    const rawRequestBody = JSON.stringify({ message, model: 'gpt-3.5-turbo', stream: true })
    setRequestBody(rawRequestBody)

    /** 启动连接 */
    await startSSEConnection({
      url: '/api/sse/chat',
      method: 'POST',
      requestBody: rawRequestBody,
      chatMessage: message,
    })
  }, [currentChatMessage, startSSEConnection])

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 flex items-center justify-center rounded-xl from-blue-500 to-purple-600 bg-linear-to-br text-white">
              <span className="text-2xl">🚀</span>
            </div>
            <div>
              <h1 className="from-blue-600 to-purple-600 bg-linear-to-r bg-clip-text text-3xl text-transparent font-bold">
                SSE 流式数据测试平台 - 手动模式
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                手动配置和体验实时流式数据传输的魅力 ✨
              </p>
            </div>
          </div>
          <Button
            onClick={ onBack }
            designStyle="outlined"
          >
            返回自动测试
          </Button>
        </div>

        {/* 标签页切换 */ }
        <div className="mb-6 flex rounded-xl bg-gray-100 p-1 space-x-1 dark:bg-gray-800">
          <button
            onClick={ () => setActiveTab('chat') }
            className={ cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              activeTab === 'chat'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
            ) }
          >
            💬 智能聊天
          </button>
          <button
            onClick={ () => setActiveTab('advanced') }
            className={ cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              activeTab === 'advanced'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
            ) }
          >
            🔧 高级配置
          </button>
        </div>
      </div>

      { activeTab === 'chat' ? (
        /** 聊天模式 */
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* SSE 聊天测试区域 */ }
          <div className="xl:col-span-2">
            <Card className="flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-500 text-white">
                    <span className="text-sm">💬</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">SSE 聊天流测试</h3>
                    <p className="text-xs text-gray-500">
                      测试流式数据接收 -
                      { ' ' }
                      { currentConnection
                        ? '🟢 连接中'
                        : '⚪ 未连接' }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  { currentConnection && (
                    <Button onClick={ cancelConnection } size="sm" designStyle="outlined">
                      停止连接
                    </Button>
                  ) }
                  <Button onClick={ () => setChatMessages([]) } size="sm" designStyle="outlined">
                    清空消息
                  </Button>
                </div>
              </div>

              {/* 消息显示区域 - 修复滚动问题 */ }
              <div className="h-96 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900/50">
                <div className="space-y-3">
                  { chatMessages.length === 0
                    ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                          <div className="mb-3 text-4xl">🧪</div>
                          <h3 className="mb-2 font-medium">SSE 流式测试</h3>
                          <p className="mb-4 text-center text-sm">
                            输入消息测试 SSE 流式数据传输
                          </p>
                          <div className="flex flex-wrap justify-center gap-2 text-xs">
                            { [
                              '介绍一下 SSE 技术',
                              '流式数据有什么优势？',
                              '测试长文本响应',
                            ].map((suggestion, index) => (
                              <button
                                key={ index }
                                onClick={ () => setCurrentChatMessage(suggestion) }
                                className="rounded bg-blue-100 px-2 py-1 text-blue-700 transition-colors dark:bg-blue-900/30 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-900/50"
                              >
                                { suggestion }
                              </button>
                            )) }
                          </div>
                        </div>
                      )
                    : (
                        chatMessages.map(message => (
                          <div
                            key={ message.id }
                            className={ cn(
                              'flex gap-2 mb-3',
                              message.role === 'user'
                                ? 'justify-end'
                                : 'justify-start',
                            ) }
                          >
                            { message.role === 'assistant' && (
                              <div className="mt-1 h-6 w-6 flex shrink-0 items-center justify-center rounded bg-blue-500 text-xs text-white">
                                🤖
                              </div>
                            ) }
                            <div
                              className={ cn(
                                'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                                message.role === 'user'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                              ) }
                            >
                              <div className="whitespace-pre-wrap wrap-break-word">
                                { message.content }
                                { message.isStreaming && (
                                  <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current align-middle"></span>
                                ) }
                              </div>
                              { message.progress !== undefined && message.progress < 1 && message.progress > 0 && (
                                <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                                  <div
                                    className="h-full bg-blue-500 transition-all duration-200"
                                    style={ { width: `${message.progress * 100}%` } }
                                  />
                                </div>
                              ) }
                              <div className="mt-1 text-xs text-gray-500">
                                { new Date(message.timestamp).toLocaleTimeString() }
                                { message.isStreaming && ' • 接收中...' }
                              </div>
                            </div>
                            { message.role === 'user' && (
                              <div className="mt-1 h-6 w-6 flex shrink-0 items-center justify-center rounded bg-green-500 text-xs text-white">
                                👤
                              </div>
                            ) }
                          </div>
                        ))
                      ) }
                  <div ref={ messagesEndRef } />
                </div>
              </div>

              {/* 测试输入区域 */ }
              <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={ currentChatMessage }
                      onChange={ setCurrentChatMessage }
                      placeholder="输入测试消息..."
                      className="flex-1"
                      onKeyDown={ (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendChatMessage()
                        }
                      } }
                      disabled={ !!currentConnection }
                    />
                    <Button
                      onClick={ sendChatMessage }
                      disabled={ !currentChatMessage.trim() || !!currentConnection }
                      className="px-4"
                    >
                      { currentConnection
                        ? '发送中...'
                        : '发送测试' }
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>
                        端点:
                        <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">/api/sse/chat</code>
                      </span>
                      <span>
                        方法:
                        <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">POST</code>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={ cn(
                        'h-2 w-2 rounded-full',
                        currentConnection
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-gray-300',
                      ) }></span>
                      <span>
                        { currentConnection
                          ? '连接中'
                          : '就绪' }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 测试状态和数据 */ }
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <span>📊</span>
                测试状态
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">连接状态:</span>
                      <span className={ cn(
                        'font-medium',
                        currentConnection
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-500',
                      ) }>
                        { currentConnection
                          ? '已连接'
                          : '未连接' }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">消息数:</span>
                      <span className="font-medium">{ chatMessages.length }</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">解析模式:</span>
                      <span className="font-medium">JSON</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">流式模式:</span>
                      <span className="text-green-600 font-medium dark:text-green-400">启用</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      端点:
                      <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">/api/sse/chat</code>
                    </div>
                    <div>
                      方法:
                      <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">POST</code>
                    </div>
                    <div>
                      格式:
                      <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">application/json</code>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <span>🔧</span>
                请求配置
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">请求体预览</label>
                  <div className="rounded bg-gray-50 p-2 text-xs font-mono dark:bg-gray-900">
                    <pre className="whitespace-pre-wrap break-all">
                      { JSON.stringify(
                        {
                          message: currentChatMessage || '测试消息',
                          model: 'gpt-3.5-turbo',
                          stream: true,
                        },
                        null,
                        2,
                      ) }
                    </pre>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <input type="checkbox" checked readOnly className="h-3 w-3" />
                    <span>解析 SSE 数据</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="checkbox" checked readOnly className="h-3 w-3" />
                    <span>解析 JSON</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /** 高级配置模式 */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 配置面板 */ }
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <span>🔧</span>
              SSE 高级配置
            </h2>

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
                  onChange={ (value) => {
                    setMethod(value === 'POST'
                      ? 'POST'
                      : 'GET')
                  } }
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

              <div>
                <label className="mb-2 block text-sm font-medium">数据前缀</label>
                <Input
                  value={ dataPrefix }
                  onChange={ setDataPrefix }
                  placeholder="data:"
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
                        { message.jsonData !== undefined && (
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
      ) }

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
                      { ' ' }
                      | 数据量:
                      { log.dataLength }
                      字符
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
        <div className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
            <span>🎯</span>
            预设 SSE 端点
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            选择预配置的端点快速开始测试，或配置自定义端点
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 md:grid-cols-2">
          { sseEndpoints.map((endpoint, index) => (
            <div
              key={ index }
              className="group relative overflow-hidden border border-gray-200 rounded-xl bg-white p-5 transition-all hover:scale-[1.02] dark:border-gray-700 dark:bg-gray-800 hover:shadow-lg"
            >
              {/* 背景渐变 */ }
              <div className={ cn(
                'absolute inset-0 bg-linear-to-br opacity-5 group-hover:opacity-10 transition-opacity',
                endpoint.color,
              ) } />

              {/* 内容 */ }
              <div className="relative">
                <div className="mb-3 flex items-start gap-3">
                  <div className={ cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br text-white text-lg',
                    endpoint.color,
                  ) }>
                    { endpoint.icon }
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 text-gray-900 font-semibold dark:text-gray-100">
                      { endpoint.name }
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={ cn(
                        'px-2 py-1 rounded-full font-medium',
                        endpoint.method === 'POST'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      ) }>
                        { endpoint.method }
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-500">
                        { endpoint.parseJSON
                          ? '🔄 JSON'
                          : '📝 文本' }
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mb-4 text-sm text-gray-600 leading-relaxed dark:text-gray-400">
                  { endpoint.description }
                </p>

                { endpoint.url && (
                  <div className="mb-4 rounded-lg bg-gray-50 p-2 dark:bg-gray-900/50">
                    <code className="break-all text-xs text-gray-600 dark:text-gray-400">
                      { endpoint.url }
                    </code>
                  </div>
                ) }

                <Button
                  onClick={ () => {
                    loadEndpoint(endpoint)
                    if (endpoint.url.includes('/chat')) {
                      setActiveTab('chat')
                    }
                    else {
                      setActiveTab('advanced')
                    }
                  } }
                  size="sm"
                  className="w-full"
                  designStyle="outlined"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>⚡</span>
                    { endpoint.url
                      ? '立即测试'
                      : '配置端点' }
                  </span>
                </Button>
              </div>
            </div>
          )) }
        </div>
      </Card>

      {/* 功能说明 */ }
      <Card className="mt-6 p-6">
        <div className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
            <span>📚</span>
            SSE 功能特性
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            了解 jl-http 库提供的强大 SSE 功能
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          { [
            {
              icon: '🌊',
              title: '实时数据流',
              description: '支持 Server-Sent Events 协议的实时数据接收，保持长连接传输流式数据',
              color: 'from-blue-500 to-cyan-500',
            },
            {
              icon: '🔧',
              title: '智能解析',
              description: '自动解析 SSE 格式数据，支持自定义前缀、分隔符和结束信号',
              color: 'from-purple-500 to-pink-500',
            },
            {
              icon: '📦',
              title: 'JSON 处理',
              description: '可选的 JSON 数据自动解析功能，轻松处理结构化数据',
              color: 'from-green-500 to-teal-500',
            },
            {
              icon: '🎛️',
              title: '连接管理',
              description: '完善的连接生命周期管理，支持取消、错误处理、进度跟踪',
              color: 'from-orange-500 to-red-500',
            },
            {
              icon: '⚙️',
              title: '灵活配置',
              description: '支持 GET/POST 请求，自定义请求头、请求体和各种参数',
              color: 'from-indigo-500 to-purple-500',
            },
            {
              icon: '🚀',
              title: '高性能',
              description: '优化的数据处理流程，支持大量并发连接和高频数据传输',
              color: 'from-pink-500 to-rose-500',
            },
          ].map((feature, index) => (
            <div key={ index } className="flex gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
              <div className={ cn(
                'flex h-12 w-12 items-center justify-center rounded-lg bg-linear-to-br text-white text-xl shrink-0',
                feature.color,
              ) }>
                { feature.icon }
              </div>
              <div>
                <h3 className="mb-1 text-gray-900 font-semibold dark:text-gray-100">
                  { feature.title }
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed dark:text-gray-400">
                  { feature.description }
                </p>
              </div>
            </div>
          )) }
        </div>

        <div className="mt-6 border border-blue-200 rounded-lg from-blue-50 to-purple-50 bg-linear-to-r p-4 dark:border-blue-800 dark:from-blue-900/20 dark:to-purple-900/20">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="mb-1 text-blue-900 font-semibold dark:text-blue-100">
                开发提示
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                SSE 非常适合实时通知、聊天应用、实时数据监控、进度更新等场景
                相比 WebSocket，SSE 更简单且自动支持断线重连
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

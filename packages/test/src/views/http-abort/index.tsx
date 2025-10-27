import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { NumberInput } from '@/components/Input/NumberInput'
import { Select } from '@/components/Select'
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { createHttpInstance } from '@/lib/test-modules'
import { createIntegratedPageProps } from '@/lib/test-modules/integration'
import { cn } from '@/utils'

interface AbortLog {
  id: number
  timestamp: string
  url: string
  method: string
  abortType: 'manual' | 'timeout' | 'signal' | 'none'
  duration: number
  status: 'pending' | 'completed' | 'aborted' | 'timeout' | 'error'
  result?: any
  error?: string
}

export default function HttpAbortTest() {
  const [showManualTest, setShowManualTest] = useState(false)

  if (!showManualTest) {
    return <AutoTestMode onSwitchToManual={ () => setShowManualTest(true) } />
  }

  return <ManualTestMode onBack={ () => setShowManualTest(false) } />
}

function AutoTestMode({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const props = createIntegratedPageProps('http-abort')

  return (
    <div className="mx-auto max-w-7xl p-6">
      <TestModuleRunner
        { ...props }
        onTestComplete={ (scenarioId, result) => {
          console.log(`中断测试完成: ${scenarioId}`, result)
        } }
      />

      {/* 切换到手动测试 */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">手动测试模式</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              切换到手动测试模式，可以自定义中断参数进行测试
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
  const [logs, setLogs] = useState<AbortLog[]>([])
  const [delay, setDelay] = useState(5) // 延迟秒数
  const [timeoutValue, setTimeoutValue] = useState(3000) // 超时时间
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const logIdRef = useRef(0)
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map())

  const addLog = (log: Omit<AbortLog, 'id' | 'timestamp'>) => {
    const newLog: AbortLog = {
      ...log,
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLogs(prev => [newLog, ...prev])
    return newLog
  }

  const updateLog = (id: number, updates: Partial<AbortLog>) => {
    setLogs(prev => prev.map(log =>
      log.id === id
        ? { ...log, ...updates }
        : log,
    ))
  }

  /** 基础请求方法 */
  const makeRequest = async (abortType: AbortLog['abortType'] = 'none') => {
    const startTime = Date.now()
    const url = `/delay/${delay}`

    const log = addLog({
      url,
      method,
      abortType,
      duration: 0,
      status: 'pending',
    })

    const abortController = new AbortController()
    abortControllersRef.current.set(log.id, abortController)

    /** 创建 HTTP 实例 */
    const http = createHttpInstance({
      baseUrl: 'https://httpbin.org', // 使用 httpbin.org 来模拟延迟请求
      timeout: 30000, // 设置较长的超时时间，便于测试中断
      reqInterceptor: (config) => {
        console.log('中断请求拦截器:', config)
        return config
      },
      respInterceptor: (response) => {
        console.log('中断响应拦截器:', response)
        return response.data
      },
      respErrInterceptor: (error) => {
        console.error('中断错误拦截器:', error)
      },
    })

    try {
      let response
      const config = {
        timeout: abortType === 'timeout'
          ? timeoutValue
          : 30000,
        signal: abortController.signal,
      }

      if (method === 'GET') {
        response = await http.get(url, config)
      }
      else {
        response = await http.post(url, { test: 'data' }, config)
      }

      const duration = Date.now() - startTime
      updateLog(log.id, {
        duration,
        status: 'completed',
        result: response,
      })
    }
    catch (err: any) {
      const duration = Date.now() - startTime
      const isAborted = err.name === 'AbortError' || err.message?.includes('aborted')
      const isTimeout = err.message?.includes('timeout') || err.message?.includes('Timeout')

      updateLog(log.id, {
        duration,
        status: isAborted
          ? 'aborted'
          : isTimeout
            ? 'timeout'
            : 'error',
        error: err.message || '请求失败',
      })
    }
    finally {
      abortControllersRef.current.delete(log.id)
    }
  }

  /** 手动中断请求 */
  const abortRequest = (logId: number) => {
    const controller = abortControllersRef.current.get(logId)
    if (controller) {
      controller.abort()
      updateLog(logId, { abortType: 'manual' })
    }
  }

  /** 中断所有进行中的请求 */
  const abortAllRequests = () => {
    abortControllersRef.current.forEach((controller, logId) => {
      controller.abort()
      updateLog(logId, { abortType: 'manual' })
    })
    abortControllersRef.current.clear()
  }

  const clearLogs = () => {
    abortAllRequests()
    setLogs([])
    logIdRef.current = 0
  }

  /** 测试场景 */
  const testScenarios = [
    {
      name: '正常请求',
      description: '发送正常请求，不中断',
      action: () => makeRequest('none'),
      delay: 2,
      timeout: 10000,
    },
    {
      name: '手动中断',
      description: '发送请求后手动中断',
      action: async () => {
        makeRequest('manual')
        // 2秒后自动中断
        setTimeout(() => {
          const lastLog = logs[0]
          if (lastLog && lastLog.status === 'pending') {
            abortRequest(lastLog.id)
          }
        }, 2000)
      },
      delay: 10,
      timeout: 30000,
    },
    {
      name: '超时中断',
      description: '设置短超时时间，测试超时中断',
      action: () => makeRequest('timeout'),
      delay: 10,
      timeout: 2000,
    },
    {
      name: '并发请求中断',
      description: '发送多个并发请求，然后全部中断',
      action: async () => {
        /** 发送3个并发请求 */
        for (let i = 0; i < 3; i++) {
          makeRequest('manual')
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        // 2秒后中断所有请求
        setTimeout(() => {
          abortAllRequests()
        }, 2000)
      },
      delay: 10,
      timeout: 30000,
    },
  ]

  const runTestScenario = async (scenario: typeof testScenarios[0]) => {
    setDelay(scenario.delay)
    setTimeoutValue(scenario.timeout)
    await new Promise(resolve => setTimeout(resolve, 100)) // 等待状态更新
    await scenario.action()
  }

  const getStatusColor = (status: AbortLog['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'completed':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'aborted':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'timeout':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
  }

  const getStatusText = (status: AbortLog['status']) => {
    switch (status) {
      case 'pending': return '进行中'
      case 'completed': return '已完成'
      case 'aborted': return '已中断'
      case 'timeout': return '超时'
      case 'error': return '错误'
      default: return '未知'
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">HTTP 请求中断功能测试 - 手动模式</h1>
          <p className="text-gray-600 dark:text-gray-400">
            手动配置和测试 jl-http 的请求中断功能，包括手动中断、超时中断、信号控制等特性
          </p>
        </div>
        <Button
          onClick={ onBack }
          designStyle="outlined"
        >
          返回自动测试
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 配置面板 */ }
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">中断配置</h2>

          <div className="space-y-4">
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

            <div>
              <label className="mb-2 block text-sm font-medium">延迟时间 (秒)</label>
              <NumberInput
                value={ delay }
                onChange={ setDelay }
                min={ 1 }
                max={ 30 }
                placeholder="延迟时间"
              />
              <p className="mt-1 text-xs text-gray-500">
                服务器响应延迟时间，用于测试中断功能
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">超时时间 (ms)</label>
              <NumberInput
                value={ timeoutValue }
                onChange={ setTimeoutValue }
                placeholder="超时时间"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={ () => makeRequest('none') }
                designStyle="outlined"
              >
                普通请求
              </Button>
              <Button
                onClick={ () => makeRequest('timeout') }
                designStyle="outlined"
              >
                超时测试
              </Button>
            </div>

            <Button
              onClick={ abortAllRequests }
              designStyle="outlined"
              className="w-full"
            >
              中断所有请求
            </Button>
          </div>
        </Card>

        {/* 请求日志 */ }
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">请求日志</h2>
            <Button onClick={ clearLogs } designStyle="outlined" size="sm">
              清空日志
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-3">
            { logs.length === 0
              ? (
                  <p className="py-8 text-center text-gray-500">暂无请求日志</p>
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
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-white/50 px-2 py-1 text-sm dark:bg-black/20">
                            { getStatusText(log.status) }
                          </span>
                          { log.status === 'pending' && (
                            <Button
                              size="sm"
                              designStyle="outlined"
                              onClick={ () => abortRequest(log.id) }
                            >
                              中断
                            </Button>
                          ) }
                        </div>
                      </div>

                      <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        { log.timestamp }
                        { ' ' }
                        | 耗时:
                        { log.duration }
                        ms
                      </div>

                      { log.abortType !== 'none' && (
                        <div className="mb-2 text-sm">
                          中断类型:
                          { ' ' }
                          {
                            log.abortType === 'manual'
                              ? '手动中断'
                              : log.abortType === 'timeout'
                                ? '超时中断'
                                : log.abortType === 'signal'
                                  ? '信号中断'
                                  : '无'
                          }
                        </div>
                      ) }

                      { log.status === 'pending' && (
                        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                          <div className="mr-2 h-4 w-4 animate-spin border-b-2 border-current rounded-full"></div>
                          请求进行中...
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
      </div>

      {/* 测试场景 */ }
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">中断测试场景</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 md:grid-cols-2">
          { testScenarios.map((scenario, index) => (
            <div key={ index } className="border rounded-lg p-4">
              <h3 className="mb-2 font-medium">{ scenario.name }</h3>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                { scenario.description }
              </p>
              <div className="mb-3 text-xs text-gray-500">
                延迟:
                { ' ' }
                { scenario.delay }
                s | 超时:
                { ' ' }
                { scenario.timeout }
                ms
              </div>
              <Button
                onClick={ () => runTestScenario(scenario) }
                size="sm"
                className="w-full"
              >
                测试
              </Button>
            </div>
          )) }
        </div>
      </Card>

      {/* 功能说明 */ }
      <Card className="mt-6 p-6">
        <h2 className="font-semibent mb-4 text-xl">中断功能说明</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ul>
            <li>
              <strong>手动中断</strong>
              ：通过 AbortController 手动中断请求
            </li>
            <li>
              <strong>超时中断</strong>
              ：设置超时时间，自动中断超时请求
            </li>
            <li>
              <strong>信号控制</strong>
              ：支持外部信号控制请求中断
            </li>
            <li>
              <strong>批量中断</strong>
              ：可以同时中断多个进行中的请求
            </li>
            <li>
              <strong>状态跟踪</strong>
              ：实时跟踪请求状态和中断原因
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

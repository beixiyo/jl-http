import { wait } from '@jl-org/http'
import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Select } from '@/components/Select'
import { cn } from '@/utils'
import { NumberInput } from '@/components/Input/NumberInput'
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { createIntegratedPageProps } from '@/lib/test-modules/integration'
import { createHttpInstance } from '@/lib/test-modules'


interface RetryLog {
  id: number
  timestamp: string
  url: string
  method: string
  retryCount: number
  maxRetries: number
  attempts: Array<{
    attempt: number
    timestamp: string
    success: boolean
    error?: string
    duration: number
  }>
  finalResult?: any
  finalError?: string
  totalDuration: number
}

export default function HttpRetryTest() {
  const [showManualTest, setShowManualTest] = useState(false)

  if (!showManualTest) {
    return <AutoTestMode onSwitchToManual={() => setShowManualTest(true)} />
  }

  return <ManualTestMode onBack={() => setShowManualTest(false)} />
}

function AutoTestMode({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const props = createIntegratedPageProps('http-retry')

  return (
    <div className="mx-auto max-w-7xl p-6">
      <TestModuleRunner
        {...props}
        onTestComplete={(scenarioId, result) => {
          console.log(`重试测试完成: ${scenarioId}`, result)
        }}
      />

      {/* 切换到手动测试 */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">手动测试模式</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              切换到手动测试模式，可以自定义重试参数进行测试
            </p>
          </div>
          <Button onClick={onSwitchToManual} designStyle="outlined">
            切换到手动测试
          </Button>
        </div>
      </Card>
    </div>
  )
}

function ManualTestMode({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<RetryLog[]>([])
  const [statusCode, setStatusCode] = useState('500') // 模拟服务器错误
  const [retryCount, setRetryCount] = useState(3)
  const [timeout, setTimeoutValue] = useState(3000)
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const logIdRef = useRef(0)

  const addLog = (log: Omit<RetryLog, 'id' | 'timestamp'>) => {
    const newLog: RetryLog = {
      ...log,
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLogs(prev => [newLog, ...prev])
    return newLog
  }

  const makeRetryRequest = async () => {
    setLoading(true)
    const startTime = Date.now()
    const url = `/${statusCode}`

    const log = addLog({
      url,
      method,
      retryCount,
      maxRetries: retryCount,
      attempts: [],
      totalDuration: 0,
    })

    /** 创建一个自定义的 HTTP 实例来跟踪重试过程 */
    const retryHttp = createHttpInstance({
      baseUrl: 'https://httpstat.us',
      timeout,
      retry: retryCount,
      reqInterceptor: (config) => {
        /** 记录每次尝试 */
        const attemptTime = Date.now()
        const attemptNumber = log.attempts.length + 1

        setLogs(prev => prev.map(l =>
          l.id === log.id
            ? {
              ...l,
              attempts: [
                ...l.attempts,
                {
                  attempt: attemptNumber,
                  timestamp: new Date().toLocaleTimeString(),
                  success: false,
                  duration: 0,
                },
              ],
            }
            : l,
        ))

        return config
      },
      respInterceptor: (response) => {
        /** 记录成功的尝试 */
        const duration = Date.now() - startTime
        setLogs(prev => prev.map(l =>
          l.id === log.id
            ? {
              ...l,
              attempts: l.attempts.map((attempt, index) =>
                index === l.attempts.length - 1
                  ? { ...attempt, success: true, duration }
                  : attempt,
              ),
            }
            : l,
        ))
        return response.data
      },
      respErrInterceptor: (error) => {
        /** 记录失败的尝试 */
        const duration = Date.now() - startTime
        setLogs(prev => prev.map(l =>
          l.id === log.id
            ? {
              ...l,
              attempts: l.attempts.map((attempt, index) =>
                index === l.attempts.length - 1
                  ? {
                    ...attempt,
                    success: false,
                    error: error.status || error.message || '请求失败',
                    duration,
                  }
                  : attempt,
              ),
            }
            : l,
        ))
      },
    })

    try {
      let response
      if (method === 'GET') {
        response = await retryHttp.get(url)
      }
      else {
        response = await retryHttp.post(url, {})
      }

      const totalDuration = Date.now() - startTime
      setLogs(prev => prev.map(l =>
        l.id === log.id
          ? { ...l, finalResult: response, totalDuration }
          : l,
      ))
    }
    catch (err: any) {
      const totalDuration = Date.now() - startTime
      setLogs(prev => prev.map(l =>
        l.id === log.id
          ? {
            ...l,
            finalError: err.message || '最终请求失败',
            totalDuration,
          }
          : l,
      ))
    }
    finally {
      setLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
    logIdRef.current = 0
  }

  const testScenarios = [
    {
      name: '服务器错误重试',
      description: '模拟 500 错误，测试重试机制',
      statusCode: '500',
      retries: 3,
    },
    {
      name: '网关超时重试',
      description: '模拟 504 网关超时，测试重试',
      statusCode: '504',
      retries: 2,
    },
    {
      name: '客户端错误不重试',
      description: '模拟 404 错误，验证不会重试',
      statusCode: '404',
      retries: 3,
    },
    {
      name: '成功请求',
      description: '模拟 200 成功响应',
      statusCode: '200',
      retries: 3,
    },
  ]

  const runTestScenario = async (scenario: typeof testScenarios[0]) => {
    setStatusCode(scenario.statusCode)
    setRetryCount(scenario.retries)
    await wait(100)
    await makeRetryRequest()
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">HTTP 重试功能测试 - 手动模式</h1>
          <p className="text-gray-600 dark:text-gray-400">
            手动配置和测试 jl-http 的请求重试功能，包括重试次数、重试策略、失败处理等特性
          </p>
        </div>
        <Button
          onClick={onBack}
          designStyle="outlined"
        >
          返回自动测试
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 配置面板 */ }
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">重试配置</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">HTTP 状态码</label>
              <Select
                value={ statusCode }
                onChange={ setStatusCode as any }
                options={ [
                  { label: '200 - 成功', value: '200' },
                  { label: '400 - 客户端错误', value: '400' },
                  { label: '404 - 未找到', value: '404' },
                  { label: '500 - 服务器错误', value: '500' },
                  { label: '502 - 网关错误', value: '502' },
                  { label: '503 - 服务不可用', value: '503' },
                  { label: '504 - 网关超时', value: '504' },
                ] }
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

            <div>
              <label className="mb-2 block text-sm font-medium">重试次数</label>
              <NumberInput
                value={ retryCount }
                onChange={ setRetryCount }
                min={ 0 }
                max={ 10 }
                placeholder="重试次数"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">超时时间 (ms)</label>
              <NumberInput
                value={ timeout }
                onChange={ setTimeoutValue }
                placeholder="超时时间"
              />
            </div>

            <Button
              onClick={ makeRetryRequest }
              loading={ loading }
              className="w-full"
            >
              发送重试请求
            </Button>
          </div>
        </Card>

        {/* 重试日志 */ }
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">重试日志</h2>
            <Button onClick={ clearLogs } designStyle="outlined" size="sm">
              清空日志
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-4">
            { logs.length === 0
              ? (
                <p className="py-8 text-center text-gray-500">暂无重试日志</p>
              )
              : (
                logs.map(log => (
                  <div
                    key={ log.id }
                    className={ cn(
                      'p-4 rounded-lg border',
                      log.finalResult
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : log.finalError
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                    ) }
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">
                        { log.method }
                        { ' ' }
                        { log.url }
                      </span>
                      <span className="text-sm text-gray-500">
                        { log.totalDuration }
                        ms
                      </span>
                    </div>

                    <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                      最大重试:
                      { ' ' }
                      { log.maxRetries }
                      { ' ' }
                      次 | 实际尝试:
                      { ' ' }
                      { log.attempts.length }
                      { ' ' }
                      次
                    </div>

                    {/* 尝试详情 */ }
                    <div className="space-y-1">
                      { log.attempts.map((attempt, index) => (
                        <div
                          key={ index }
                          className={ cn(
                            'text-xs p-2 rounded flex items-center justify-between',
                            attempt.success
                              ? 'bg-green-100 dark:bg-green-800/30 text-green-800 dark:text-green-200'
                              : 'bg-red-100 dark:bg-red-800/30 text-red-800 dark:text-red-200',
                          ) }
                        >
                          <span>
                            尝试
                            { ' ' }
                            { attempt.attempt }
                            :
                            { ' ' }
                            { attempt.success
                              ? '成功'
                              : '失败' }
                            { attempt.error && ` (${attempt.error})` }
                          </span>
                          <span>
                            { attempt.duration }
                            ms
                          </span>
                        </div>
                      )) }
                    </div>

                    { log.finalError && (
                      <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                        最终错误:
                        { ' ' }
                        { log.finalError }
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
        <h2 className="mb-4 text-xl font-semibold">重试测试场景</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 md:grid-cols-2">
          { testScenarios.map((scenario, index) => (
            <div key={ index } className="border rounded-lg p-4">
              <h3 className="mb-2 font-medium">{ scenario.name }</h3>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                { scenario.description }
              </p>
              <div className="mb-3 text-xs text-gray-500">
                状态码:
                { ' ' }
                { scenario.statusCode }
                { ' ' }
                | 重试:
                { ' ' }
                { scenario.retries }
              </div>
              <Button
                onClick={ () => runTestScenario(scenario) }
                loading={ loading }
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
        <h2 className="mb-4 text-xl font-semibold">重试功能说明</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ul>
            <li>
              <strong>智能重试</strong>
              ：只对可重试的错误（如网络错误、服务器错误）进行重试
            </li>
            <li>
              <strong>可配置重试次数</strong>
              ：支持全局和单次请求的重试次数配置
            </li>
            <li>
              <strong>重试策略</strong>
              ：内置重试逻辑，自动处理重试间隔
            </li>
            <li>
              <strong>详细日志</strong>
              ：记录每次重试的详细信息，便于调试
            </li>
            <li>
              <strong>错误分类</strong>
              ：区分客户端错误（不重试）和服务器错误（重试）
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input, Textarea } from '@/components/Input'
import { Select } from '@/components/Select'
import { cn } from '@/utils'
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { createIntegratedPageProps } from '@/lib/test-modules/integration'
import { createHttpInstance } from '@/lib/test-modules'

interface InterceptorLog {
  id: number
  timestamp: string
  type: 'request' | 'response' | 'error'
  phase: 'before' | 'after'
  data: any
  url?: string
  method?: string
}

export default function HttpInterceptorsTest() {
  const [showManualTest, setShowManualTest] = useState(false)

  if (!showManualTest) {
    return <AutoTestMode onSwitchToManual={() => setShowManualTest(true)} />
  }

  return <ManualTestMode onBack={() => setShowManualTest(false)} />
}

function AutoTestMode({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const props = createIntegratedPageProps('http-interceptors')

  return (
    <div className="mx-auto max-w-7xl p-6">
      <TestModuleRunner
        {...props}
        onTestComplete={(scenarioId, result) => {
          console.log(`拦截器测试完成: ${scenarioId}`, result)
        }}
      />

      {/* 切换到手动测试 */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">手动测试模式</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              切换到手动测试模式，可以自定义拦截器配置进行测试
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
  const [logs, setLogs] = useState<InterceptorLog[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [url, setUrl] = useState('/posts/1')
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET')
  const [requestBody, setRequestBody] = useState('{"title": "测试标题", "body": "测试内容", "userId": 1}')
  const [enableReqInterceptor, setEnableReqInterceptor] = useState(true)
  const [enableRespInterceptor, setEnableRespInterceptor] = useState(true)
  const [enableErrorInterceptor, setEnableErrorInterceptor] = useState(true)
  const [authToken, setAuthToken] = useState('Bearer test-token-123')
  const [simulateError, setSimulateError] = useState(false)
  const logIdRef = useRef(0)

  const addLog = (log: Omit<InterceptorLog, 'id' | 'timestamp'>) => {
    const newLog: InterceptorLog = {
      ...log,
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLogs(prev => [newLog, ...prev])
  }

  /** 创建带拦截器的 HTTP 实例 */
  const createInterceptorHttpInstance = () => {
    return createHttpInstance({
      baseUrl: simulateError
        ? 'https://invalid-domain-for-testing.com'
        : 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      reqInterceptor: enableReqInterceptor
        ? (config) => {
            addLog({
              type: 'request',
              phase: 'before',
              data: {
                url: config.url,
                method: config.method,
                headers: config.headers,
                body: config.body,
              },
              url: config.url,
              method: config.method,
            })

            /** 添加认证头 */
            if (authToken) {
              config.headers = {
                ...config.headers,
                Authorization: authToken,
              }
            }

            /** 添加自定义头 */
            config.headers = {
              ...config.headers,
              'X-Custom-Header': 'interceptor-test',
              'X-Request-Time': new Date().toISOString(),
            }

            addLog({
              type: 'request',
              phase: 'after',
              data: {
                url: config.url,
                method: config.method,
                headers: config.headers,
                body: config.body,
              },
              url: config.url,
              method: config.method,
            })

            return config
          }
        : undefined,
      respInterceptor: enableRespInterceptor
        ? (response) => {
            addLog({
              type: 'response',
              phase: 'before',
              data: {
                status: response.rawResp.status,
                statusText: response.rawResp.statusText,
                headers: Object.fromEntries(response.rawResp.headers.entries()),
                data: response.data,
              },
            })

            /** 响应数据处理 */
            let processedData = response.data

            /** 如果是对象，添加处理时间戳 */
            if (typeof processedData === 'object' && processedData !== null) {
              processedData = {
                ...processedData,
                __processed_at: new Date().toISOString(),
                __interceptor_processed: true,
              }
            }

            addLog({
              type: 'response',
              phase: 'after',
              data: {
                originalData: response.data,
                processedData,
                status: response.rawResp.status,
              },
            })

            return processedData
          }
        : undefined,
      respErrInterceptor: enableErrorInterceptor
        ? (error) => {
            addLog({
              type: 'error',
              phase: 'before',
              data: {
                message: error.message || '未知错误',
                status: error.status,
                name: error.name,
                stack: error.stack,
              },
            })

            /** 错误处理逻辑 */
            console.error('拦截器捕获错误:', error)

            addLog({
              type: 'error',
              phase: 'after',
              data: {
                message: '错误已被拦截器处理',
                originalError: error.message || '未知错误',
              },
            })
          }
        : undefined,
    })
  }

  const handleRequest = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    setLogs([])

    const http = createInterceptorHttpInstance()

    try {
      let response
      const config = {}

      switch (method) {
        case 'GET':
          response = await http.get(url, config)
          break
        case 'POST':
          response = await http.post(url, JSON.parse(requestBody || '{}'), config)
          break
        case 'PUT':
          response = await http.put(url, JSON.parse(requestBody || '{}'), config)
          break
        case 'DELETE':
          response = await http.delete(url, JSON.parse(requestBody || '{}'), config)
          break
      }

      setResult(response)
    }
    catch (err: any) {
      setError(err.message || '请求失败')
    }
    finally {
      setLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
    setResult(null)
    setError('')
    logIdRef.current = 0
  }

  const testScenarios = [
    {
      name: '成功请求拦截',
      description: '测试正常请求的拦截器流程',
      config: {
        url: '/posts/1',
        method: 'GET' as const,
        simulateError: false,
        enableAll: true,
      },
    },
    {
      name: '错误请求拦截',
      description: '测试错误请求的拦截器处理',
      config: {
        url: '/invalid-endpoint',
        method: 'GET' as const,
        simulateError: true,
        enableAll: true,
      },
    },
    {
      name: '仅请求拦截器',
      description: '只启用请求拦截器',
      config: {
        url: '/posts/1',
        method: 'GET' as const,
        simulateError: false,
        enableReq: true,
        enableResp: false,
        enableError: false,
      },
    },
    {
      name: 'POST 请求拦截',
      description: '测试 POST 请求的拦截器',
      config: {
        url: '/posts',
        method: 'POST' as const,
        simulateError: false,
        enableAll: true,
      },
    },
  ]

  const runTestScenario = async (scenario: typeof testScenarios[0]) => {
    setUrl(scenario.config.url)
    setMethod(scenario.config.method)
    setSimulateError(scenario.config.simulateError)

    if ('enableAll' in scenario.config && scenario.config.enableAll) {
      setEnableReqInterceptor(true)
      setEnableRespInterceptor(true)
      setEnableErrorInterceptor(true)
    }
    else {
      setEnableReqInterceptor(scenario.config.enableReq ?? true)
      setEnableRespInterceptor(scenario.config.enableResp ?? true)
      setEnableErrorInterceptor(scenario.config.enableError ?? true)
    }

    await new Promise(resolve => setTimeout(resolve, 100)) // 等待状态更新
    await handleRequest()
  }

  const getLogTypeColor = (type: InterceptorLog['type'], phase: InterceptorLog['phase']) => {
    if (type === 'request') {
      return phase === 'before'
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        : 'bg-blue-100 dark:bg-blue-800/30 border-blue-300 dark:border-blue-700'
    }
    else if (type === 'response') {
      return phase === 'before'
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : 'bg-green-100 dark:bg-green-800/30 border-green-300 dark:border-green-700'
    }
    else {
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }
  }

  const getLogTypeText = (type: InterceptorLog['type'], phase: InterceptorLog['phase']) => {
    if (type === 'request') {
      return phase === 'before'
        ? '请求前'
        : '请求后'
    }
    else if (type === 'response') {
      return phase === 'before'
        ? '响应前'
        : '响应后'
    }
    else {
      return '错误处理'
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">HTTP 拦截器功能测试 - 手动模式</h1>
          <p className="text-gray-600 dark:text-gray-400">
            手动配置和测试 jl-http 的请求和响应拦截器功能，包括请求预处理、响应后处理、错误拦截等特性
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
          <h2 className="mb-4 text-xl font-semibold">拦截器配置</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">请求方法</label>
              <Select
                value={ method }
                onChange={ value => setMethod(value as any) }
                options={ [
                  { label: 'GET', value: 'GET' },
                  { label: 'POST', value: 'POST' },
                  { label: 'PUT', value: 'PUT' },
                  { label: 'DELETE', value: 'DELETE' },
                ] }
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">请求 URL</label>
              <Input
                value={ url }
                onChange={ setUrl }
                placeholder="输入请求路径"
              />
            </div>

            { (method === 'POST' || method === 'PUT' || method === 'DELETE') && (
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

            <div>
              <label className="mb-2 block text-sm font-medium">认证令牌</label>
              <Input
                value={ authToken }
                onChange={ setAuthToken }
                placeholder="Bearer token"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableReqInterceptor"
                  checked={ enableReqInterceptor }
                  onChange={ e => setEnableReqInterceptor(e.target.checked) }
                  className="rounded"
                />
                <label htmlFor="enableReqInterceptor" className="text-sm">
                  启用请求拦截器
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableRespInterceptor"
                  checked={ enableRespInterceptor }
                  onChange={ e => setEnableRespInterceptor(e.target.checked) }
                  className="rounded"
                />
                <label htmlFor="enableRespInterceptor" className="text-sm">
                  启用响应拦截器
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableErrorInterceptor"
                  checked={ enableErrorInterceptor }
                  onChange={ e => setEnableErrorInterceptor(e.target.checked) }
                  className="rounded"
                />
                <label htmlFor="enableErrorInterceptor" className="text-sm">
                  启用错误拦截器
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="simulateError"
                  checked={ simulateError }
                  onChange={ e => setSimulateError(e.target.checked) }
                  className="rounded"
                />
                <label htmlFor="simulateError" className="text-sm">
                  模拟网络错误
                </label>
              </div>
            </div>

            <Button
              onClick={ handleRequest }
              loading={ loading }
              className="w-full"
            >
              发送请求
            </Button>
          </div>
        </Card>

        {/* 结果面板 */ }
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">请求结果</h2>

          <div className="space-y-4">
            { loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin border-b-2 border-blue-500 rounded-full"></div>
                <span className="ml-2">请求中...</span>
              </div>
            ) }

            { error && (
              <div className="border border-red-200 rounded-lg bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <h3 className="mb-2 text-red-800 font-medium dark:text-red-200">请求失败</h3>
                <p className="text-sm text-red-600 dark:text-red-300">{ error }</p>
              </div>
            ) }

            { result && (
              <div className="border border-green-200 rounded-lg bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <h3 className="mb-2 text-green-800 font-medium dark:text-green-200">请求成功</h3>
                <pre className="max-h-64 overflow-auto text-sm text-green-600 dark:text-green-300">
                  { JSON.stringify(result, null, 2) }
                </pre>
              </div>
            ) }
          </div>
        </Card>
      </div>

      {/* 拦截器日志 */ }
      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">拦截器执行日志</h2>
          <Button onClick={ clearLogs } designStyle="outlined" size="sm">
            清空日志
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2">
          { logs.length === 0
            ? (
                <p className="py-8 text-center text-gray-500">暂无拦截器日志</p>
              )
            : (
                logs.map(log => (
                  <div
                    key={ log.id }
                    className={ cn('p-3 rounded-lg border text-sm', getLogTypeColor(log.type, log.phase)) }
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          { getLogTypeText(log.type, log.phase) }
                        </span>
                        { log.url && (
                          <span className="text-gray-500">
                            { log.method }
                            { ' ' }
                            { log.url }
                          </span>
                        ) }
                      </div>
                      <span className="text-xs text-gray-500">
                        { log.timestamp }
                      </span>
                    </div>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-400">
                        查看详细数据
                      </summary>
                      <pre className="mt-2 overflow-auto rounded bg-white/50 p-2 text-xs dark:bg-black/20">
                        { JSON.stringify(log.data, null, 2) }
                      </pre>
                    </details>
                  </div>
                ))
              ) }
        </div>
      </Card>

      {/* 测试场景 */ }
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">拦截器测试场景</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 md:grid-cols-2">
          { testScenarios.map((scenario, index) => (
            <div key={ index } className="border rounded-lg p-4">
              <h3 className="mb-2 font-medium">{ scenario.name }</h3>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                { scenario.description }
              </p>
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
        <h2 className="mb-4 text-xl font-semibold">拦截器功能说明</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ul>
            <li>
              <strong>请求拦截器</strong>
              ：在请求发送前修改请求配置，如添加认证头、自定义头等
            </li>
            <li>
              <strong>响应拦截器</strong>
              ：在响应返回后处理响应数据，如数据转换、添加元信息等
            </li>
            <li>
              <strong>错误拦截器</strong>
              ：统一处理请求错误，如日志记录、错误上报等
            </li>
            <li>
              <strong>链式处理</strong>
              ：拦截器按顺序执行，支持数据传递和转换
            </li>
            <li>
              <strong>灵活配置</strong>
              ：可以选择性启用或禁用特定的拦截器
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

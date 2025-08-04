import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { cn } from '@/utils'
import { NumberInput } from '@/components/Input/NumberInput'
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { createIntegratedPageProps } from '@/lib/test-modules/integration'
import { createHttpInstance } from '@/lib/test-modules'
import { Textarea } from '@/components/Textarea'

export default function HttpCacheTest() {
  const [showManualTest, setShowManualTest] = useState(false)

  if (!showManualTest) {
    const props = createIntegratedPageProps('http-cache')
    return (
      <div className="mx-auto max-w-7xl p-6">
        <TestModuleRunner
          {...props}
          onTestComplete={(scenarioId, result) => {
            console.log(`缓存测试完成: ${scenarioId}`, result)
          }}
        />

        {/* 切换到手动测试 */}
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">手动测试模式</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                切换到手动测试模式，可以自定义缓存参数进行测试
              </p>
            </div>
            <Button
              onClick={() => setShowManualTest(true)}
              designStyle="outlined"
            >
              切换到手动测试
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return <ManualCacheTest onBack={() => setShowManualTest(false)} />
}

function ManualCacheTest({ onBack }: { onBack: () => void }) {

interface RequestLog {
  id: number
  timestamp: string
  url: string
  method: string
  cached: boolean
  duration: number
  result?: any
  error?: string
}

  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [cacheTimeout, setCacheTimeout] = useState(3000)
  const [url, setUrl] = useState('/posts/1')
  const [requestBody, setRequestBody] = useState('{"title": "缓存测试", "body": "测试内容", "userId": 1}')
  const logIdRef = useRef(0)

  const addLog = (log: Omit<RequestLog, 'id' | 'timestamp'>) => {
    const newLog: RequestLog = {
      ...log,
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLogs(prev => [newLog, ...prev])
    return newLog
  }

  const makeRequest = async (method: 'cacheGet' | 'cachePost' | 'cachePut', isCached = true) => {
    setLoading(true)
    const startTime = Date.now()

    const log = addLog({
      url,
      method: method.replace('cache', ''),
      cached: false,
      duration: 0,
    })

    try {
      const http = createHttpInstance({
        baseUrl: 'https://jsonplaceholder.typicode.com',
        cacheTimeout,
        timeout: 10000,
      })

      let response
      const config = { cacheTimeout }

      switch (method) {
        case 'cacheGet':
          response = await http.cacheGet(url, config)
          break
        case 'cachePost':
          response = await http.cachePost(url, JSON.parse(requestBody || '{}'), config)
          break
        case 'cachePut':
          response = await http.cachePut(url, JSON.parse(requestBody || '{}'), config)
          break
      }

      const duration = Date.now() - startTime

      /** 更新日志 */
      setLogs(prev => prev.map(l =>
        l.id === log.id
          ? { ...l, duration, result: response, cached: duration < 100 } // 如果响应时间很短，可能是缓存命中
          : l,
      ))
    }
    catch (err: any) {
      const duration = Date.now() - startTime
      setLogs(prev => prev.map(l =>
        l.id === log.id
          ? { ...l, duration, error: err.message || '请求失败' }
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

  const testCacheScenarios = [
    {
      name: '快速连续请求测试',
      description: '连续发送 3 个相同请求，观察缓存效果',
      action: async () => {
        for (let i = 0; i < 3; i++) {
          await makeRequest('cacheGet')
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      },
    },
    {
      name: '缓存超时测试',
      description: '发送请求后等待缓存超时，再次请求',
      action: async () => {
        await makeRequest('cacheGet')
        await new Promise(resolve => setTimeout(resolve, cacheTimeout + 1000))
        await makeRequest('cacheGet')
      },
    },
    {
      name: '不同参数测试',
      description: '使用不同参数发送请求，验证缓存隔离',
      action: async () => {
        const originalUrl = url
        setUrl('/posts/1')
        await makeRequest('cacheGet')
        setUrl('/posts/2')
        await makeRequest('cacheGet')
        setUrl(originalUrl)
      },
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">HTTP 缓存功能测试 - 手动模式</h1>
          <p className="text-gray-600 dark:text-gray-400">
            手动配置和测试 jl-http 的请求缓存功能
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
        {/* 配置面板 */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">缓存配置</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">请求 URL</label>
              <Input
                value={ url }
                onChange={ setUrl }
                placeholder="输入请求路径"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">缓存超时时间 (ms)</label>
              <NumberInput
                value={ cacheTimeout }
                onChange={ setCacheTimeout }
                placeholder="缓存超时时间"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">请求体 (JSON)</label>
              <Textarea
                value={ requestBody }
                onChange={ setRequestBody }
                className="h-20 w-full resize-none border rounded-lg p-3 text-sm font-mono"
                placeholder="输入 JSON 格式的请求体"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={ () => makeRequest('cacheGet') }
                loading={ loading }
                designStyle="outlined"
              >
                Cache GET
              </Button>
              <Button
                onClick={ () => makeRequest('cachePost') }
                loading={ loading }
                designStyle="outlined"
              >
                Cache POST
              </Button>
              <Button
                onClick={ () => makeRequest('cachePut') }
                loading={ loading }
                designStyle="outlined"
              >
                Cache PUT
              </Button>
            </div>
          </div>
        </Card>

        {/* 请求日志 */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">请求日志</h2>
            <Button onClick={ clearLogs } designStyle="outlined" size="sm">
              清空日志
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {logs.length === 0
              ? (
                  <p className="py-8 text-center text-gray-500">暂无请求日志</p>
                )
              : (
                  logs.map(log => (
                    <div
                      key={ log.id }
                      className={ cn(
                        'p-3 rounded-lg border text-sm',
                        log.cached
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : log.error
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                      ) }
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium">
                          {log.method}
                          {' '}
                          {log.url}
                        </span>
                        <div className="flex items-center gap-2">
                          {log.cached && (
                            <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-800 dark:text-green-200">
                              缓存命中
                            </span>
                          )}
                          <span className="text-gray-500">
                            {log.duration}
                            ms
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        {log.timestamp}
                      </div>
                      {log.error && (
                        <div className="mt-1 text-red-600 dark:text-red-400">
                          错误:
                          {' '}
                          {log.error}
                        </div>
                      )}
                    </div>
                  ))
                )}
          </div>
        </Card>
      </div>

      {/* 测试场景 */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">缓存测试场景</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {testCacheScenarios.map((scenario, index) => (
            <div key={ index } className="border rounded-lg p-4">
              <h3 className="mb-2 font-medium">{scenario.name}</h3>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                {scenario.description}
              </p>
              <Button
                onClick={ scenario.action }
                loading={ loading }
                size="sm"
                className="w-full"
              >
                开始测试
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* 功能说明 */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">缓存功能说明</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ul>
            <li>
              <strong>内存缓存</strong>
              ：缓存存储在内存中，页面刷新后失效
            </li>
            <li>
              <strong>参数隔离</strong>
              ：不同的 URL 和参数会分别缓存
            </li>
            <li>
              <strong>自动清理</strong>
              ：超时的缓存会自动清理
            </li>
            <li>
              <strong>缓存命中检测</strong>
              ：通过响应时间可以判断是否命中缓存
            </li>
            <li>
              <strong>灵活配置</strong>
              ：可以为每个请求单独设置缓存超时时间
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

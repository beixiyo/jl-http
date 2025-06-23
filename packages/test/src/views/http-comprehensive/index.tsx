import { concurrentTask, Http } from '@jl-org/http'
import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/utils'

/** 创建综合功能的 HTTP 实例 */
const http = new Http({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  timeout: 10000,
  retry: 2,
  cacheTimeout: 5000,
  reqInterceptor: (config) => {
    console.log('🚀 请求发送:', config.method, config.url)
    config.headers = {
      ...config.headers,
      'X-App-Version': '1.0.0',
      'X-Request-ID': Math.random().toString(36).substr(2, 9),
      'X-Timestamp': Date.now().toString(),
    }
    return config
  },
  respInterceptor: (response) => {
    console.log('✅ 响应接收:', response.rawResp.status, response.rawResp.url)
    return response.data
  },
  respErrInterceptor: (error) => {
    console.error('❌ 请求错误:', error)
  },
})

interface DemoScenario {
  id: string
  name: string
  description: string
  features: string[]
  action: () => Promise<void>
  status: 'idle' | 'running' | 'success' | 'error'
  result?: any
  error?: string
  duration?: number
}

export default function HttpComprehensiveTest() {
  const [scenarios, setScenarios] = useState<DemoScenario[]>([
    {
      id: 'basic-crud',
      name: '基础 CRUD 操作',
      description: '演示基本的增删改查操作，包含重试和拦截器',
      features: ['HTTP 方法', '重试机制', '拦截器', '错误处理'],
      action: async () => {},
      status: 'idle',
    },
    {
      id: 'cache-demo',
      name: '缓存机制演示',
      description: '展示请求缓存的效果，多次请求相同接口',
      features: ['请求缓存', '缓存命中', '缓存超时'],
      action: async () => {},
      status: 'idle',
    },
    {
      id: 'concurrent-requests',
      name: '并发请求处理',
      description: '同时发送多个请求，展示并发控制和结果聚合',
      features: ['并发控制', '结果聚合', '错误隔离'],
      action: async () => {},
      status: 'idle',
    },
    {
      id: 'abort-control',
      name: '请求中断控制',
      description: '演示请求中断功能，包括手动中断和超时中断',
      features: ['请求中断', '超时控制', '信号管理'],
      action: async () => {},
      status: 'idle',
    },
    {
      id: 'complex-workflow',
      name: '复杂业务流程',
      description: '模拟真实业务场景，组合使用多种功能',
      features: ['组合功能', '业务流程', '错误恢复'],
      action: async () => {},
      status: 'idle',
    },
  ])

  const [logs, setLogs] = useState<string[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev])
  }

  const updateScenario = (id: string, updates: Partial<DemoScenario>) => {
    setScenarios(prev => prev.map(scenario =>
      scenario.id === id
        ? { ...scenario, ...updates }
        : scenario,
    ))
  }

  /** 基础 CRUD 操作演示 */
  const runBasicCRUD = async () => {
    addLog('开始基础 CRUD 操作演示')

    try {
      // 1. 获取数据 (GET)
      addLog('📖 获取文章列表...')
      const posts = await http.get('/posts', { retry: 3 })
      addLog(`✅ 获取到 ${posts.length} 篇文章`)

      // 2. 创建数据 (POST)
      addLog('📝 创建新文章...')
      const newPost = await http.post('/posts', {
        title: '测试文章',
        body: '这是一篇测试文章',
        userId: 1,
      })
      addLog(`✅ 创建文章成功，ID: ${newPost.id}`)

      // 3. 更新数据 (PUT)
      addLog('✏️ 更新文章...')
      const updatedPost = await http.put('/posts/1', {
        id: 1,
        title: '更新的文章标题',
        body: '更新的文章内容',
        userId: 1,
      })
      addLog(`✅ 更新文章成功`)

      // 4. 删除数据 (DELETE)
      addLog('🗑️ 删除文章...')
      await http.delete('/posts/1')
      addLog(`✅ 删除文章成功`)

      return { posts: posts.slice(0, 3), newPost, updatedPost }
    }
    catch (error: any) {
      addLog(`❌ CRUD 操作失败: ${error.message}`)
      throw error
    }
  }

  /** 缓存机制演示 */
  const runCacheDemo = async () => {
    addLog('开始缓存机制演示')

    try {
      const results = []

      /** 第一次请求 */
      addLog('🔄 第一次请求 (无缓存)...')
      const start1 = Date.now()
      const result1 = await http.cacheGet('/posts/1', { cacheTimeout: 10000 })
      const duration1 = Date.now() - start1
      addLog(`✅ 第一次请求完成，耗时: ${duration1}ms`)
      results.push({ attempt: 1, duration: duration1, cached: false })

      /** 第二次请求 (应该命中缓存) */
      addLog('🔄 第二次请求 (应该命中缓存)...')
      const start2 = Date.now()
      const result2 = await http.cacheGet('/posts/1', { cacheTimeout: 10000 })
      const duration2 = Date.now() - start2
      addLog(`✅ 第二次请求完成，耗时: ${duration2}ms ${duration2 < 50
        ? '(缓存命中)'
        : '(未命中缓存)'}`)
      results.push({ attempt: 2, duration: duration2, cached: duration2 < 50 })

      /** 第三次请求 (仍应命中缓存) */
      addLog('🔄 第三次请求 (仍应命中缓存)...')
      const start3 = Date.now()
      const result3 = await http.cacheGet('/posts/1', { cacheTimeout: 10000 })
      const duration3 = Date.now() - start3
      addLog(`✅ 第三次请求完成，耗时: ${duration3}ms ${duration3 < 50
        ? '(缓存命中)'
        : '(未命中缓存)'}`)
      results.push({ attempt: 3, duration: duration3, cached: duration3 < 50 })

      return { results, data: result1 }
    }
    catch (error: any) {
      addLog(`❌ 缓存演示失败: ${error.message}`)
      throw error
    }
  }

  /** 并发请求演示 */
  const runConcurrentDemo = async () => {
    addLog('开始并发请求演示')

    try {
      /** 创建多个任务 */
      const tasks = [
        () => http.get('/posts/1'),
        () => http.get('/posts/2'),
        () => http.get('/posts/3'),
        () => http.get('/users/1'),
        () => http.get('/users/2'),
        () => http.get('/albums/1'),
      ]

      addLog(`🚀 开始执行 ${tasks.length} 个并发任务，最大并发数: 3`)
      const startTime = Date.now()

      const results = await concurrentTask(tasks, 3)
      const duration = Date.now() - startTime

      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length

      addLog(`✅ 并发任务完成，耗时: ${duration}ms`)
      addLog(`📊 成功: ${successCount}, 失败: ${failureCount}`)

      return { results, duration, successCount, failureCount }
    }
    catch (error: any) {
      addLog(`❌ 并发请求失败: ${error.message}`)
      throw error
    }
  }

  /** 请求中断演示 */
  const runAbortDemo = async () => {
    addLog('开始请求中断演示')

    try {
      const controller = new AbortController()
      abortControllersRef.current.set('abort-demo', controller)

      /** 启动一个长时间的请求 */
      addLog('🚀 启动长时间请求...')
      const requestPromise = http.get('/posts', {
        signal: controller.signal,
        timeout: 30000,
      })

      // 2秒后中断请求
      setTimeout(() => {
        addLog('⏰ 2秒后中断请求...')
        controller.abort()
      }, 2000)

      try {
        const result = await requestPromise
        addLog('✅ 请求完成 (未被中断)')
        return { result, aborted: false }
      }
      catch (error: any) {
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          addLog('🛑 请求已被中断')
          return { aborted: true }
        }
        else {
          throw error
        }
      }
    }
    catch (error: any) {
      addLog(`❌ 中断演示失败: ${error.message}`)
      throw error
    }
    finally {
      abortControllersRef.current.delete('abort-demo')
    }
  }

  /** 复杂业务流程演示 */
  const runComplexWorkflow = async () => {
    addLog('开始复杂业务流程演示')

    try {
      /** 模拟用户登录流程 */
      addLog('👤 模拟用户登录...')
      const user = await http.cacheGet('/users/1', { cacheTimeout: 30000 })
      addLog(`✅ 用户登录成功: ${user.name}`)

      /** 获取用户的文章列表 (使用缓存) */
      addLog('📚 获取用户文章列表...')
      const userPosts = await http.cacheGet(`/users/${user.id}/posts`, { cacheTimeout: 10000 })
      addLog(`✅ 获取到 ${userPosts.length} 篇文章`)

      /** 并发获取文章详情 */
      addLog('🔍 并发获取文章详情...')
      const postDetailTasks = userPosts.slice(0, 3).map((post: any) =>
        () => http.cacheGet(`/posts/${post.id}`, { cacheTimeout: 5000 }),
      )

      const postDetails = await concurrentTask(postDetailTasks, 2)
      const successfulPosts = postDetails.filter(r => r.status === 'fulfilled')
      addLog(`✅ 成功获取 ${successfulPosts.length} 篇文章详情`)

      /** 模拟创建新文章 (带重试) */
      addLog('📝 创建新文章 (带重试)...')
      const newPost = await http.post('/posts', {
        title: `${user.name}的新文章`,
        body: '这是通过复杂流程创建的文章',
        userId: user.id,
      }, { retry: 3 })
      addLog(`✅ 文章创建成功，ID: ${newPost.id}`)

      return {
        user,
        postsCount: userPosts.length,
        postDetails: successfulPosts.length,
        newPost,
      }
    }
    catch (error: any) {
      addLog(`❌ 复杂流程失败: ${error.message}`)
      throw error
    }
  }

  /** 执行场景 */
  const runScenario = async (scenarioId: string) => {
    if (globalLoading)
      return

    setGlobalLoading(true)
    updateScenario(scenarioId, { status: 'running' })

    const startTime = Date.now()

    try {
      let result

      switch (scenarioId) {
        case 'basic-crud':
          result = await runBasicCRUD()
          break
        case 'cache-demo':
          result = await runCacheDemo()
          break
        case 'concurrent-requests':
          result = await runConcurrentDemo()
          break
        case 'abort-control':
          result = await runAbortDemo()
          break
        case 'complex-workflow':
          result = await runComplexWorkflow()
          break
        default:
          throw new Error('未知的演示场景')
      }

      const duration = Date.now() - startTime
      updateScenario(scenarioId, {
        status: 'success',
        result,
        duration,
        error: undefined,
      })
      addLog(`🎉 场景 "${scenarios.find(s => s.id === scenarioId)?.name}" 执行成功`)
    }
    catch (error: any) {
      const duration = Date.now() - startTime
      updateScenario(scenarioId, {
        status: 'error',
        error: error.message,
        duration,
      })
      addLog(`💥 场景执行失败: ${error.message}`)
    }
    finally {
      setGlobalLoading(false)
    }
  }

  const runAllScenarios = async () => {
    addLog('🚀 开始执行所有演示场景')
    for (const scenario of scenarios) {
      if (scenario.status !== 'running') {
        await runScenario(scenario.id)
        /** 场景间稍作延迟 */
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    addLog('🏁 所有演示场景执行完成')
  }

  const clearAll = () => {
    /** 中断所有进行中的请求 */
    abortControllersRef.current.forEach(controller => controller.abort())
    abortControllersRef.current.clear()

    /** 重置状态 */
    setScenarios(prev => prev.map(scenario => ({
      ...scenario,
      status: 'idle',
      result: undefined,
      error: undefined,
      duration: undefined,
    })))
    setLogs([])
    setGlobalLoading(false)
  }

  const getStatusColor = (status: DemoScenario['status']) => {
    switch (status) {
      case 'running': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'error': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      default: return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
  }

  const getStatusIcon = (status: DemoScenario['status']) => {
    switch (status) {
      case 'running': return '🔄'
      case 'success': return '✅'
      case 'error': return '❌'
      default: return '⭕'
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">jl-http 综合功能演示</h1>
        <p className="text-gray-600 dark:text-gray-400">
          展示 jl-http 的各种功能组合使用场景，包括完整的业务流程演示
        </p>
      </div>

      {/* 控制面板 */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">演示控制</h2>
          <div className="flex gap-2">
            <Button
              onClick={ runAllScenarios }
              loading={ globalLoading }
              disabled={ globalLoading }
            >
              执行所有场景
            </Button>
            <Button
              onClick={ clearAll }
              variant="outline"
              disabled={ globalLoading }
            >
              清空重置
            </Button>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          点击单个场景卡片执行特定演示，或使用"执行所有场景"按钮依次运行所有演示
        </div>
      </Card>

      {/* 演示场景 */}
      <div className="grid grid-cols-1 mb-6 gap-6 lg:grid-cols-3 md:grid-cols-2">
        {scenarios.map(scenario => (
          <Card
            key={ scenario.id }
            className={ cn(
              'p-6 cursor-pointer transition-all hover:shadow-lg',
              getStatusColor(scenario.status),
              globalLoading && scenario.status !== 'running' && 'opacity-50 cursor-not-allowed',
            ) }
            onClick={ () => !globalLoading && runScenario(scenario.id) }
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{scenario.name}</h3>
              <span className="text-2xl">{getStatusIcon(scenario.status)}</span>
            </div>

            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              {scenario.description}
            </p>

            <div className="mb-3 flex flex-wrap gap-1">
              {scenario.features.map((feature, index) => (
                <span
                  key={ index }
                  className="rounded bg-white/50 px-2 py-1 text-xs dark:bg-black/20"
                >
                  {feature}
                </span>
              ))}
            </div>

            {scenario.duration && (
              <div className="text-xs text-gray-500">
                耗时:
                {' '}
                {scenario.duration}
                ms
              </div>
            )}

            {scenario.error && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                错误:
                {' '}
                {scenario.error}
              </div>
            )}

            {scenario.status === 'running' && (
              <div className="mt-2 flex items-center text-sm text-blue-600 dark:text-blue-400">
                <div className="mr-2 h-4 w-4 animate-spin border-b-2 border-current rounded-full"></div>
                执行中...
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 执行日志 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">执行日志</h2>
          <Button onClick={ () => setLogs([]) } variant="outline" size="sm">
            清空日志
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400 font-mono">
          {logs.length === 0
            ? (
                <div className="text-gray-500">暂无日志，点击演示场景开始...</div>
              )
            : (
                logs.map((log, index) => (
                  <div key={ index } className="mb-1">
                    {log}
                  </div>
                ))
              )}
        </div>
      </Card>

      {/* 功能总结 */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">jl-http 功能特性总结</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium">🚀 核心功能</h3>
            <ul className="text-sm text-gray-600 space-y-1 dark:text-gray-400">
              <li>• 支持所有 HTTP 方法</li>
              <li>• 请求/响应拦截器</li>
              <li>• 自动错误处理</li>
              <li>• TypeScript 支持</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-medium">⚡ 性能优化</h3>
            <ul className="text-sm text-gray-600 space-y-1 dark:text-gray-400">
              <li>• 智能请求缓存</li>
              <li>• 并发请求控制</li>
              <li>• 自动重试机制</li>
              <li>• 请求中断控制</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-medium">🔧 高级特性</h3>
            <ul className="text-sm text-gray-600 space-y-1 dark:text-gray-400">
              <li>• SSE 流式数据</li>
              <li>• 模板代码生成</li>
              <li>• 灵活配置选项</li>
              <li>• 完整的错误处理</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}

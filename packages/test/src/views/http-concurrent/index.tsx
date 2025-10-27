import type { TaskResult } from '@jl-org/http'
import { concurrentTask } from '@jl-org/http'
import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { NumberInput } from '@/components/Input/NumberInput'
import { Select } from '@/components/Select'
import { TestModuleRunner } from '@/components/TestModuleRunner'
import { createHttpInstance } from '@/lib/test-modules'
import { createIntegratedPageProps } from '@/lib/test-modules/integration'
import { cn } from '@/utils'

interface ConcurrentLog {
  id: number
  timestamp: string
  taskCount: number
  maxConcurrency: number
  duration: number
  status: 'running' | 'completed' | 'error'
  results: TaskResult<any>[]
  successCount: number
  failureCount: number
  error?: string
}

interface TaskProgress {
  taskIndex: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: number
  endTime?: number
  duration?: number
  result?: any
  error?: string
}

export default function HttpConcurrentTest() {
  const [showManualTest, setShowManualTest] = useState(false)

  if (!showManualTest) {
    return <AutoTestMode onSwitchToManual={ () => setShowManualTest(true) } />
  }

  return <ManualTestMode onBack={ () => setShowManualTest(false) } />
}

function AutoTestMode({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const props = createIntegratedPageProps('http-concurrent')

  return (
    <div className="mx-auto max-w-7xl p-6">
      <TestModuleRunner
        { ...props }
        onTestComplete={ (scenarioId, result) => {
          console.log(`并发测试完成: ${scenarioId}`, result)
        } }
      />

      {/* 切换到手动测试 */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">手动测试模式</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              切换到手动测试模式，可以自定义并发参数进行测试
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
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<ConcurrentLog[]>([])
  const [taskProgress, setTaskProgress] = useState<TaskProgress[]>([])
  const [taskCount, setTaskCount] = useState(5)
  const [maxConcurrency, setMaxConcurrency] = useState(3)
  const [requestType, setRequestType] = useState<'posts' | 'users' | 'mixed' | 'delay'>('posts')
  const [includeFailures, setIncludeFailures] = useState(false)
  const logIdRef = useRef(0)

  const addLog = (log: Omit<ConcurrentLog, 'id' | 'timestamp'>) => {
    const newLog: ConcurrentLog = {
      ...log,
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLogs(prev => [newLog, ...prev])
    return newLog
  }

  const updateLog = (id: number, updates: Partial<ConcurrentLog>) => {
    setLogs(prev => prev.map(log =>
      log.id === id
        ? { ...log, ...updates }
        : log,
    ))
  }

  const createTasks = () => {
    const tasks: (() => Promise<any>)[] = []

    /** 创建 HTTP 实例 */
    const http = createHttpInstance({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      reqInterceptor: (config) => {
        console.log('并发请求拦截器:', config)
        return config
      },
      respInterceptor: (response) => {
        console.log('并发响应拦截器:', response)
        return response.data
      },
    })

    for (let i = 0; i < taskCount; i++) {
      let taskFn: () => Promise<any>

      switch (requestType) {
        case 'posts':
          taskFn = () => http.get(`/posts/${i + 1}`)
          break
        case 'users':
          taskFn = () => http.get(`/users/${i + 1}`)
          break
        case 'mixed':
          taskFn = i % 2 === 0
            ? () => http.get(`/posts/${Math.floor(i / 2) + 1}`)
            : () => http.get(`/users/${Math.floor(i / 2) + 1}`)
          break
        case 'delay':
          /** 使用 httpbin.org 的延迟接口 */
          taskFn = () => {
            const delayTime = Math.floor(Math.random() * 3) + 1 // 1-3秒随机延迟
            return fetch(`https://httpbin.org/delay/${delayTime}`)
              .then(res => res.json())
          }
          break
        default:
          taskFn = () => http.get(`/posts/${i + 1}`)
      }

      /** 如果包含失败情况，随机让一些任务失败 */
      if (includeFailures && Math.random() < 0.3) {
        const originalTask = taskFn
        taskFn = () => {
          if (Math.random() < 0.5) {
            return Promise.reject(new Error(`任务 ${i + 1} 模拟失败`))
          }
          return originalTask()
        }
      }

      /** 包装任务以跟踪进度 */
      const wrappedTask = () => {
        const startTime = Date.now()

        /** 更新任务状态为运行中 */
        setTaskProgress(prev => prev.map(task =>
          task.taskIndex === i
            ? { ...task, status: 'running', startTime }
            : task,
        ))

        return taskFn()
          .then((result) => {
            const endTime = Date.now()
            setTaskProgress(prev => prev.map(task =>
              task.taskIndex === i
                ? {
                    ...task,
                    status: 'completed',
                    endTime,
                    duration: endTime - startTime,
                    result,
                  }
                : task,
            ))
            return result
          })
          .catch((error) => {
            const endTime = Date.now()
            setTaskProgress(prev => prev.map(task =>
              task.taskIndex === i
                ? {
                    ...task,
                    status: 'failed',
                    endTime,
                    duration: endTime - startTime,
                    error: error.message || '任务失败',
                  }
                : task,
            ))
            throw error
          })
      }

      tasks.push(wrappedTask)
    }

    return tasks
  }

  const runConcurrentTasks = async () => {
    setLoading(true)
    const startTime = Date.now()

    /** 初始化任务进度 */
    const initialProgress: TaskProgress[] = Array.from({ length: taskCount }, (_, i) => ({
      taskIndex: i,
      status: 'pending',
    }))
    setTaskProgress(initialProgress)

    const log = addLog({
      taskCount,
      maxConcurrency,
      duration: 0,
      status: 'running',
      results: [],
      successCount: 0,
      failureCount: 0,
    })

    try {
      const tasks = createTasks()
      const results = await concurrentTask(tasks, maxConcurrency)

      const duration = Date.now() - startTime
      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length

      updateLog(log.id, {
        duration,
        status: 'completed',
        results,
        successCount,
        failureCount,
      })
    }
    catch (err: any) {
      const duration = Date.now() - startTime
      updateLog(log.id, {
        duration,
        status: 'error',
        error: err.message || '并发任务执行失败',
        results: [],
        successCount: 0,
        failureCount: taskCount,
      })
    }
    finally {
      setLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
    setTaskProgress([])
    logIdRef.current = 0
  }

  const testScenarios = [
    {
      name: '低并发测试',
      description: '5个任务，并发数2',
      taskCount: 5,
      concurrency: 2,
      type: 'posts' as const,
      failures: false,
    },
    {
      name: '高并发测试',
      description: '10个任务，并发数5',
      taskCount: 10,
      concurrency: 5,
      type: 'mixed' as const,
      failures: false,
    },
    {
      name: '错误处理测试',
      description: '8个任务，包含失败情况',
      taskCount: 8,
      concurrency: 3,
      type: 'posts' as const,
      failures: true,
    },
    {
      name: '延迟任务测试',
      description: '6个延迟任务，测试并发控制',
      taskCount: 6,
      concurrency: 2,
      type: 'delay' as const,
      failures: false,
    },
  ]

  const runTestScenario = async (scenario: typeof testScenarios[0]) => {
    setTaskCount(scenario.taskCount)
    setMaxConcurrency(scenario.concurrency)
    setRequestType(scenario.type)
    setIncludeFailures(scenario.failures)
    await new Promise(resolve => setTimeout(resolve, 100)) // 等待状态更新
    await runConcurrentTasks()
  }

  const getTaskStatusColor = (status: TaskProgress['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      case 'running': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
      case 'completed': return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
      case 'failed': return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">HTTP 并发请求功能测试 - 手动模式</h1>
          <p className="text-gray-600 dark:text-gray-400">
            手动配置和测试 jl-http 的并发请求功能，包括并发控制、任务调度、结果聚合等特性
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
          <h2 className="mb-4 text-xl font-semibold">并发配置</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">任务数量</label>
              <NumberInput
                value={ taskCount }
                onChange={ setTaskCount }
                min={ 1 }
                max={ 20 }
                placeholder="任务数量"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">最大并发数</label>
              <NumberInput
                value={ maxConcurrency }
                onChange={ setMaxConcurrency }
                min={ 1 }
                max={ 10 }
                placeholder="最大并发数"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">请求类型</label>
              <Select
                value={ requestType }
                onChange={ value => setRequestType(value as any) }
                options={ [
                  { label: '文章请求', value: 'posts' },
                  { label: '用户请求', value: 'users' },
                  { label: '混合请求', value: 'mixed' },
                  { label: '延迟请求', value: 'delay' },
                ] }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeFailures"
                checked={ includeFailures }
                onChange={ e => setIncludeFailures(e.target.checked) }
                className="rounded"
              />
              <label htmlFor="includeFailures" className="text-sm">
                包含失败情况
              </label>
            </div>

            <Button
              onClick={ runConcurrentTasks }
              loading={ loading }
              className="w-full"
            >
              执行并发任务
            </Button>
          </div>
        </Card>

        {/* 任务进度 */ }
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">任务进度</h2>

          <div className="max-h-96 overflow-y-auto space-y-2">
            { taskProgress.length === 0
              ? (
                  <p className="py-8 text-center text-gray-500">暂无任务进度</p>
                )
              : (
                  taskProgress.map(task => (
                    <div
                      key={ task.taskIndex }
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
                          任务
                          { task.taskIndex + 1 }
                        </span>
                        <span className={ cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          getTaskStatusColor(task.status),
                        ) }>
                          { task.status === 'pending' && '等待中' }
                          { task.status === 'running' && '运行中' }
                          { task.status === 'completed' && '已完成' }
                          { task.status === 'failed' && '失败' }
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        { task.duration
                          ? `${task.duration}ms`
                          : '-' }
                      </div>
                    </div>
                  ))
                ) }
          </div>
        </Card>
      </div>

      {/* 执行日志 */ }
      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">执行日志</h2>
          <Button onClick={ clearLogs } designStyle="outlined" size="sm">
            清空日志
          </Button>
        </div>

        <div className="space-y-4">
          { logs.length === 0
            ? (
                <p className="py-8 text-center text-gray-500">暂无执行日志</p>
              )
            : (
                logs.map(log => (
                  <div
                    key={ log.id }
                    className={ cn(
                      'p-4 rounded-lg border',
                      log.status === 'completed'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : log.status === 'error'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                    ) }
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">
                        并发执行
                        { ' ' }
                        { log.taskCount }
                        { ' ' }
                        个任务
                      </span>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          并发数:
                          { log.maxConcurrency }
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
                      | 成功:
                      { log.successCount }
                      { ' ' }
                      | 失败:
                      { log.failureCount }
                    </div>

                    { log.status === 'running' && (
                      <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                        <div className="mr-2 h-4 w-4 animate-spin border-b-2 border-current rounded-full"></div>
                        任务执行中...
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

      {/* 测试场景 */ }
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-xl font-semibold">并发测试场景</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 md:grid-cols-2">
          { testScenarios.map((scenario, index) => (
            <div key={ index } className="border rounded-lg p-4">
              <h3 className="mb-2 font-medium">{ scenario.name }</h3>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                { scenario.description }
              </p>
              <div className="mb-3 text-xs text-gray-500">
                任务:
                { ' ' }
                { scenario.taskCount }
                { ' ' }
                | 并发:
                { ' ' }
                { scenario.concurrency }
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
        <h2 className="mb-4 text-xl font-semibold">并发功能说明</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ul>
            <li>
              <strong>并发控制</strong>
              ：限制同时执行的任务数量，避免资源过度消耗
            </li>
            <li>
              <strong>顺序保持</strong>
              ：结果数组的顺序与输入任务数组的顺序一致
            </li>
            <li>
              <strong>错误隔离</strong>
              ：单个任务失败不会影响其他任务的执行
            </li>
            <li>
              <strong>自动调度</strong>
              ：任务完成后自动从队列中取下一个任务执行
            </li>
            <li>
              <strong>状态跟踪</strong>
              ：实时跟踪每个任务的执行状态和结果
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

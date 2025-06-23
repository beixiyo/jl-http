/**
 * 并发请求测试模块
 */

import { concurrentTask } from '@jl-org/http'
import type { ConcurrentTestConfig, TestContext, TestModule, TestResult } from '../types'
import { createErrorResult, createHttpInstance, createSuccessResult, createTestLog, measureTime } from '../utils'

export const concurrentModule: TestModule = {
  id: 'concurrent',
  name: '并发请求',
  description: '测试并发请求功能，包括并发控制、任务调度、结果聚合等',

  scenarios: [
    {
      id: 'basic-concurrent',
      name: '基础并发测试',
      description: '测试基本的并发请求功能',
      features: ['并发控制', '任务调度', '结果聚合'],
      category: 'concurrent',
      priority: 1,
    },
    {
      id: 'high-concurrency',
      name: '高并发测试',
      description: '测试高并发场景下的性能表现',
      features: ['高并发', '性能测试', '资源管理'],
      category: 'concurrent',
      priority: 2,
    },
    {
      id: 'error-handling',
      name: '并发错误处理',
      description: '测试并发请求中的错误处理和隔离',
      features: ['错误隔离', '失败恢复', '部分成功'],
      category: 'concurrent',
      priority: 2,
    },
    {
      id: 'mixed-requests',
      name: '混合请求测试',
      description: '测试不同类型请求的并发执行',
      features: ['混合请求', '类型多样性', '负载均衡'],
      category: 'concurrent',
      priority: 3,
    },
  ],

  getDefaultConfig(): ConcurrentTestConfig {
    return {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      taskCount: 5,
      maxConcurrency: 3,
      includeFailures: false,
      requestType: 'posts',
    }
  },

  validateConfig(config: ConcurrentTestConfig) {
    return !!(
      config.baseUrl
      && config.timeout > 0
      && config.taskCount > 0
      && config.maxConcurrency > 0
      && config.maxConcurrency <= config.taskCount
    )
  },

  async execute(context: TestContext): Promise<TestResult> {
    const { scenario, config } = context
    const logs: any[] = []
    const http = createHttpInstance(config)

    try {
      const { result, duration } = await measureTime(async () => {
        switch (scenario.id) {
          case 'basic-concurrent':
            return await testBasicConcurrent(http, config as ConcurrentTestConfig, logs)
          case 'high-concurrency':
            return await testHighConcurrency(http, config as ConcurrentTestConfig, logs)
          case 'error-handling':
            return await testErrorHandling(http, config as ConcurrentTestConfig, logs)
          case 'mixed-requests':
            return await testMixedRequests(http, config as ConcurrentTestConfig, logs)
          default:
            throw new Error(`未知的测试场景: ${scenario.id}`)
        }
      })

      return createSuccessResult(result, duration, logs, {
        scenario: scenario.id,
        taskCount: config.taskCount,
        maxConcurrency: config.maxConcurrency,
      })
    }
    catch (error: any) {
      const duration = Date.now()
      logs.push(createTestLog('error', `并发测试失败: ${error.message}`, error))
      return createErrorResult(error.message, duration, logs)
    }
  },
}

/** 创建任务列表 */
function createTasks(http: any, config: ConcurrentTestConfig) {
  const tasks: (() => Promise<any>)[] = []

  for (let i = 0; i < config.taskCount; i++) {
    let taskFn: () => Promise<any>

    switch (config.requestType) {
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
        taskFn = () => {
          const delayTime = Math.floor(Math.random() * 3) + 1
          return fetch(`https://httpbin.org/delay/${delayTime}`)
            .then(res => res.json())
        }
        break
      default:
        taskFn = () => http.get(`/posts/${i + 1}`)
    }

    // 如果包含失败情况，随机让一些任务失败
    if (config.includeFailures && Math.random() < 0.3) {
      const originalTask = taskFn
      taskFn = () => {
        if (Math.random() < 0.5) {
          return Promise.reject(new Error(`任务 ${i + 1} 模拟失败`))
        }
        return originalTask()
      }
    }

    tasks.push(taskFn)
  }

  return tasks
}

/** 测试基础并发 */
async function testBasicConcurrent(http: any, config: ConcurrentTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始基础并发测试'))

  const tasks = createTasks(http, config)
  logs.push(createTestLog('info', `创建 ${tasks.length} 个任务，最大并发数: ${config.maxConcurrency}`))

  const startTime = Date.now()
  const results = await concurrentTask(tasks, config.maxConcurrency)
  const duration = Date.now() - startTime

  const successCount = results.filter(r => r.status === 'fulfilled').length
  const failureCount = results.filter(r => r.status === 'rejected').length

  logs.push(createTestLog('success', `并发任务完成，耗时: ${duration}ms`))
  logs.push(createTestLog('info', `成功: ${successCount}, 失败: ${failureCount}`))

  return {
    taskCount: tasks.length,
    maxConcurrency: config.maxConcurrency,
    duration,
    results,
    successCount,
    failureCount,
    successRate: successCount / tasks.length,
  }
}

/** 测试高并发 */
async function testHighConcurrency(http: any, config: ConcurrentTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始高并发测试'))

  // 增加任务数量和并发数
  const highConcurrencyConfig = {
    ...config,
    taskCount: Math.max(config.taskCount, 10),
    maxConcurrency: Math.max(config.maxConcurrency, 5),
  }

  const tasks = createTasks(http, highConcurrencyConfig)
  logs.push(createTestLog('info', `高并发测试: ${tasks.length} 个任务，并发数: ${highConcurrencyConfig.maxConcurrency}`))

  const startTime = Date.now()
  const results = await concurrentTask(tasks, highConcurrencyConfig.maxConcurrency)
  const duration = Date.now() - startTime

  const successCount = results.filter(r => r.status === 'fulfilled').length
  const failureCount = results.filter(r => r.status === 'rejected').length

  // 计算性能指标
  const throughput = tasks.length / (duration / 1000) // 每秒处理的任务数
  const avgResponseTime = duration / tasks.length // 平均响应时间

  logs.push(createTestLog('success', `高并发测试完成，耗时: ${duration}ms`))
  logs.push(createTestLog('info', `吞吐量: ${throughput.toFixed(2)} 任务/秒`))
  logs.push(createTestLog('info', `平均响应时间: ${avgResponseTime.toFixed(2)}ms`))

  return {
    taskCount: tasks.length,
    maxConcurrency: highConcurrencyConfig.maxConcurrency,
    duration,
    results,
    successCount,
    failureCount,
    throughput,
    avgResponseTime,
    performance: {
      throughput,
      avgResponseTime,
      successRate: successCount / tasks.length,
    },
  }
}

/** 测试错误处理 */
async function testErrorHandling(http: any, config: ConcurrentTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始并发错误处理测试'))

  // 强制包含失败情况
  const errorConfig = {
    ...config,
    includeFailures: true,
  }

  const tasks = createTasks(http, errorConfig)
  logs.push(createTestLog('info', `错误处理测试: ${tasks.length} 个任务，包含模拟失败`))

  const startTime = Date.now()
  const results = await concurrentTask(tasks, config.maxConcurrency)
  const duration = Date.now() - startTime

  const successCount = results.filter(r => r.status === 'fulfilled').length
  const failureCount = results.filter(r => r.status === 'rejected').length

  // 分析错误类型
  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => (r as any).reason?.message || '未知错误')

  logs.push(createTestLog('success', `错误处理测试完成，耗时: ${duration}ms`))
  logs.push(createTestLog('info', `成功: ${successCount}, 失败: ${failureCount}`))
  logs.push(createTestLog('info', `错误隔离测试: ${failureCount > 0 ? '通过' : '未触发错误'}`))

  return {
    taskCount: tasks.length,
    duration,
    results,
    successCount,
    failureCount,
    errors,
    errorIsolation: successCount > 0 && failureCount > 0, // 部分成功部分失败说明错误隔离有效
  }
}

/** 测试混合请求 */
async function testMixedRequests(http: any, config: ConcurrentTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始混合请求测试'))

  // 创建不同类型的任务
  const mixedTasks = [
    () => http.get('/posts/1'),
    () => http.get('/users/1'),
    () => http.get('/albums/1'),
    () => http.post('/posts', { title: '测试', body: '内容', userId: 1 }),
    () => http.put('/posts/1', { id: 1, title: '更新', body: '内容', userId: 1 }),
  ]

  // 根据配置重复任务
  const tasks = []
  for (let i = 0; i < config.taskCount; i++) {
    tasks.push(mixedTasks[i % mixedTasks.length])
  }

  logs.push(createTestLog('info', `混合请求测试: ${tasks.length} 个不同类型的任务`))

  const startTime = Date.now()
  const results = await concurrentTask(tasks, config.maxConcurrency)
  const duration = Date.now() - startTime

  const successCount = results.filter(r => r.status === 'fulfilled').length
  const failureCount = results.filter(r => r.status === 'rejected').length

  // 分析请求类型分布
  const requestTypes = ['GET /posts', 'GET /users', 'GET /albums', 'POST /posts', 'PUT /posts']
  const typeDistribution = requestTypes.map((type, index) => ({
    type,
    count: Math.ceil(tasks.length / mixedTasks.length),
  }))

  logs.push(createTestLog('success', `混合请求测试完成，耗时: ${duration}ms`))
  logs.push(createTestLog('info', `请求类型: ${requestTypes.length} 种`))

  return {
    taskCount: tasks.length,
    requestTypes: requestTypes.length,
    duration,
    results,
    successCount,
    failureCount,
    typeDistribution,
    mixedRequestsWorking: successCount > 0,
  }
}

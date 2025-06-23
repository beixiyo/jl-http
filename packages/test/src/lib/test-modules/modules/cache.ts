/**
 * 缓存功能测试模块
 */

import type { CacheTestConfig, TestContext, TestModule, TestResult } from '../types'
import { createErrorResult, createHttpInstance, createSuccessResult, createTestLog, delay, isCacheHit, measureTime } from '../utils'

export const cacheModule: TestModule = {
  id: 'cache',
  name: '缓存功能',
  description: '测试 HTTP 请求缓存功能，包括缓存命中、缓存超时、缓存隔离等',

  scenarios: [
    {
      id: 'cache-hit',
      name: '缓存命中测试',
      description: '测试连续相同请求的缓存命中效果',
      features: ['缓存命中', '响应时间', '数据一致性'],
      category: 'cache',
      priority: 1,
    },
    {
      id: 'cache-timeout',
      name: '缓存超时测试',
      description: '测试缓存超时后重新请求的行为',
      features: ['缓存超时', '自动清理', '重新请求'],
      category: 'cache',
      priority: 2,
    },
    {
      id: 'cache-isolation',
      name: '缓存隔离测试',
      description: '测试不同参数请求的缓存隔离',
      features: ['参数隔离', '独立缓存', '键值管理'],
      category: 'cache',
      priority: 2,
    },
    {
      id: 'cache-methods',
      name: '缓存方法测试',
      description: '测试不同 HTTP 方法的缓存行为',
      features: ['GET 缓存', 'POST 缓存', 'PUT 缓存'],
      category: 'cache',
      priority: 3,
    },
  ],

  getDefaultConfig(): CacheTestConfig {
    return {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      cacheTimeout: 3000,
      testUrl: '/posts/1',
      requestBody: '{"title": "缓存测试", "body": "测试内容", "userId": 1}',
    }
  },

  validateConfig(config: CacheTestConfig) {
    return !!(
      config.baseUrl
      && config.timeout > 0
      && config.cacheTimeout > 0
      && config.testUrl
    )
  },

  async execute(context: TestContext): Promise<TestResult> {
    const { scenario, config } = context
    const logs: any[] = []
    const http = createHttpInstance(config)

    try {
      const { result, duration } = await measureTime(async () => {
        switch (scenario.id) {
          case 'cache-hit':
            return await testCacheHit(http, config as CacheTestConfig, logs)
          case 'cache-timeout':
            return await testCacheTimeout(http, config as CacheTestConfig, logs)
          case 'cache-isolation':
            return await testCacheIsolation(http, config as CacheTestConfig, logs)
          case 'cache-methods':
            return await testCacheMethods(http, config as CacheTestConfig, logs)
          default:
            throw new Error(`未知的测试场景: ${scenario.id}`)
        }
      })

      return createSuccessResult(result, duration, logs, {
        scenario: scenario.id,
        cacheTimeout: config.cacheTimeout,
      })
    }
    catch (error: any) {
      const duration = Date.now()
      logs.push(createTestLog('error', `缓存测试失败: ${error.message}`, error))
      return createErrorResult(error.message, duration, logs)
    }
  },
}

/** 测试缓存命中 */
async function testCacheHit(http: any, config: CacheTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始测试缓存命中'))

  const requests = []
  const cacheConfig = { cacheTimeout: config.cacheTimeout }

  // 第一次请求（无缓存）
  logs.push(createTestLog('info', '发送第一次请求（无缓存）'))
  const { result: result1, duration: duration1 } = await measureTime(() =>
    http.cacheGet(config.testUrl, cacheConfig),
  )
  requests.push({
    attempt: 1,
    duration: duration1,
    cached: false,
    data: result1,
  })
  logs.push(createTestLog('success', `第一次请求完成，耗时: ${duration1}ms`))

  // 第二次请求（应该命中缓存）
  await delay(100)
  logs.push(createTestLog('info', '发送第二次请求（应该命中缓存）'))
  const { result: result2, duration: duration2 } = await measureTime(() =>
    http.cacheGet(config.testUrl, cacheConfig),
  )
  const cached2 = isCacheHit(duration2)
  requests.push({
    attempt: 2,
    duration: duration2,
    cached: cached2,
    data: result2,
  })
  logs.push(createTestLog(
    cached2 ? 'success' : 'warning',
    `第二次请求完成，耗时: ${duration2}ms ${cached2 ? '(缓存命中)' : '(未命中缓存)'}`,
  ))

  // 第三次请求（仍应命中缓存）
  await delay(100)
  logs.push(createTestLog('info', '发送第三次请求（仍应命中缓存）'))
  const { result: result3, duration: duration3 } = await measureTime(() =>
    http.cacheGet(config.testUrl, cacheConfig),
  )
  const cached3 = isCacheHit(duration3)
  requests.push({
    attempt: 3,
    duration: duration3,
    cached: cached3,
    data: result3,
  })
  logs.push(createTestLog(
    cached3 ? 'success' : 'warning',
    `第三次请求完成，耗时: ${duration3}ms ${cached3 ? '(缓存命中)' : '(未命中缓存)'}`,
  ))

  const cacheHitCount = requests.filter(r => r.cached).length
  logs.push(createTestLog('info', `缓存命中次数: ${cacheHitCount}/${requests.length - 1}`))

  return {
    requests,
    cacheHitCount,
    totalRequests: requests.length,
    cacheHitRate: cacheHitCount / (requests.length - 1),
  }
}

/** 测试缓存超时 */
async function testCacheTimeout(http: any, config: CacheTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始测试缓存超时'))

  const shortCacheTimeout = 1000 // 1秒缓存
  const cacheConfig = { cacheTimeout: shortCacheTimeout }

  // 第一次请求
  logs.push(createTestLog('info', '发送第一次请求'))
  const { result: result1, duration: duration1 } = await measureTime(() =>
    http.cacheGet(config.testUrl, cacheConfig),
  )
  logs.push(createTestLog('success', `第一次请求完成，耗时: ${duration1}ms`))

  // 立即发送第二次请求（应该命中缓存）
  const { result: result2, duration: duration2 } = await measureTime(() =>
    http.cacheGet(config.testUrl, cacheConfig),
  )
  const cached2 = isCacheHit(duration2)
  logs.push(createTestLog(
    cached2 ? 'success' : 'warning',
    `第二次请求完成，耗时: ${duration2}ms ${cached2 ? '(缓存命中)' : '(未命中缓存)'}`,
  ))

  // 等待缓存超时
  logs.push(createTestLog('info', `等待缓存超时 (${shortCacheTimeout + 500}ms)`))
  await delay(shortCacheTimeout + 500)

  // 缓存超时后的请求
  logs.push(createTestLog('info', '发送缓存超时后的请求'))
  const { result: result3, duration: duration3 } = await measureTime(() =>
    http.cacheGet(config.testUrl, cacheConfig),
  )
  const cached3 = isCacheHit(duration3)
  logs.push(createTestLog(
    !cached3 ? 'success' : 'warning',
    `超时后请求完成，耗时: ${duration3}ms ${cached3 ? '(意外缓存命中)' : '(缓存已超时)'}`,
  ))

  return {
    cacheTimeout: shortCacheTimeout,
    requests: [
      { phase: 'initial', duration: duration1, cached: false },
      { phase: 'immediate', duration: duration2, cached: cached2 },
      { phase: 'after-timeout', duration: duration3, cached: cached3 },
    ],
    timeoutWorking: !cached3,
  }
}

/** 测试缓存隔离 */
async function testCacheIsolation(http: any, config: CacheTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始测试缓存隔离'))

  const cacheConfig = { cacheTimeout: config.cacheTimeout }
  const requests = []

  // 请求不同的资源
  const urls = ['/posts/1', '/posts/2', '/posts/3']

  for (const url of urls) {
    logs.push(createTestLog('info', `请求资源: ${url}`))
    const { result, duration } = await measureTime(() =>
      http.cacheGet(url, cacheConfig),
    )
    requests.push({
      url,
      duration,
      cached: false,
      data: result,
    })
    logs.push(createTestLog('success', `请求 ${url} 完成，耗时: ${duration}ms`))
  }

  // 再次请求相同资源（应该命中各自的缓存）
  logs.push(createTestLog('info', '再次请求相同资源，测试缓存隔离'))
  for (const url of urls) {
    const { result, duration } = await measureTime(() =>
      http.cacheGet(url, cacheConfig),
    )
    const cached = isCacheHit(duration)
    requests.push({
      url,
      duration,
      cached,
      data: result,
    })
    logs.push(createTestLog(
      cached ? 'success' : 'warning',
      `再次请求 ${url} 完成，耗时: ${duration}ms ${cached ? '(缓存命中)' : '(未命中缓存)'}`,
    ))
  }

  const cacheHitCount = requests.filter(r => r.cached).length
  logs.push(createTestLog('info', `缓存隔离测试完成，命中次数: ${cacheHitCount}/${urls.length}`))

  return {
    urls,
    requests,
    cacheHitCount,
    isolationWorking: cacheHitCount === urls.length,
  }
}

/** 测试不同方法的缓存 */
async function testCacheMethods(http: any, config: CacheTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始测试不同方法的缓存'))

  const cacheConfig = { cacheTimeout: config.cacheTimeout }
  const results = []

  // 测试 cacheGet
  logs.push(createTestLog('info', '测试 cacheGet 方法'))
  const { result: getResult, duration: getDuration } = await measureTime(() =>
    http.cacheGet(config.testUrl, cacheConfig),
  )
  results.push({ method: 'GET', duration: getDuration, result: getResult })

  // 测试 cachePost
  if (config.requestBody) {
    logs.push(createTestLog('info', '测试 cachePost 方法'))
    const { result: postResult, duration: postDuration } = await measureTime(() =>
      http.cachePost('/posts', JSON.parse(config.requestBody!), cacheConfig),
    )
    results.push({ method: 'POST', duration: postDuration, result: postResult })
  }

  // 测试 cachePut
  if (config.requestBody) {
    logs.push(createTestLog('info', '测试 cachePut 方法'))
    const { result: putResult, duration: putDuration } = await measureTime(() =>
      http.cachePut('/posts/1', JSON.parse(config.requestBody!), cacheConfig),
    )
    results.push({ method: 'PUT', duration: putDuration, result: putResult })
  }

  logs.push(createTestLog('success', `缓存方法测试完成，测试了 ${results.length} 个方法`))

  return {
    methods: results.map(r => r.method),
    results,
    allMethodsWorking: results.every(r => r.result),
  }
}

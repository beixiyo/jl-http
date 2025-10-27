/**
 * 请求中断测试模块
 */

import type { AbortTestConfig, TestContext, TestModule, TestResult } from '../types'
import { createErrorResult, createHttpInstance, createSuccessResult, createTestLog, delay, measureTime } from '../utils'

export const abortModule: TestModule = {
  id: 'abort',
  name: '请求中断',
  description: '测试请求中断功能，包括手动中断、超时中断、信号管理等',

  scenarios: [
    {
      id: 'manual-abort',
      name: '手动中断测试',
      description: '测试手动中断正在进行的请求',
      features: ['手动中断', '信号控制', '状态管理'],
      category: 'abort',
      priority: 1,
    },
    {
      id: 'timeout-abort',
      name: '超时中断测试',
      description: '测试请求超时自动中断',
      features: ['超时控制', '自动中断', '时间管理'],
      category: 'abort',
      priority: 2,
    },
    {
      id: 'multiple-abort',
      name: '多请求中断测试',
      description: '测试同时中断多个请求',
      features: ['批量中断', '信号传播', '资源清理'],
      category: 'abort',
      priority: 2,
    },
    {
      id: 'abort-recovery',
      name: '中断恢复测试',
      description: '测试中断后的恢复和重试机制',
      features: ['中断恢复', '重试机制', '状态重置'],
      category: 'abort',
      priority: 3,
    },
  ],

  getDefaultConfig(): AbortTestConfig {
    return {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      abortDelay: 2000,
      testUrl: '/posts',
    }
  },

  validateConfig(config: AbortTestConfig) {
    return !!(
      config.baseUrl
      && config.timeout && config.timeout > 0
      && config.abortDelay > 0
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
          case 'manual-abort':
            return await testManualAbort(http, config as AbortTestConfig, logs)
          case 'timeout-abort':
            return await testTimeoutAbort(http, config as AbortTestConfig, logs)
          case 'multiple-abort':
            return await testMultipleAbort(http, config as AbortTestConfig, logs)
          case 'abort-recovery':
            return await testAbortRecovery(http, config as AbortTestConfig, logs)
          default:
            throw new Error(`未知的测试场景: ${scenario.id}`)
        }
      })

      return createSuccessResult(result, duration, logs, {
        scenario: scenario.id,
        abortDelay: config.abortDelay,
      })
    }
    catch (error: any) {
      const duration = Date.now()
      logs.push(createTestLog('error', `中断测试失败: ${error.message}`, error))
      return createErrorResult(error.message, duration, logs)
    }
  },
}

/** 测试手动中断 */
async function testManualAbort(http: any, config: AbortTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始手动中断测试'))

  const controller = new AbortController()
  const abortDelay = config.abortDelay

  logs.push(createTestLog('info', `启动请求，${abortDelay}ms 后中断`))

  /** 启动请求 */
  const requestPromise = http.get(config.testUrl, {
    signal: controller.signal,
    timeout: config.timeout,
  })

  /** 设置中断定时器 */
  const abortTimer = setTimeout(() => {
    logs.push(createTestLog('info', `${abortDelay}ms 后执行中断`))
    controller.abort()
  }, abortDelay)

  const startTime = Date.now()
  let result: any
  let aborted = false
  let error: string | undefined

  try {
    result = await requestPromise
    clearTimeout(abortTimer)
    const duration = Date.now() - startTime
    logs.push(createTestLog('warning', `请求完成，未被中断 (${duration}ms)`))
  }
  catch (err: any) {
    clearTimeout(abortTimer)
    const duration = Date.now() - startTime

    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      aborted = true
      logs.push(createTestLog('success', `请求已被中断 (${duration}ms)`))
    }
    else {
      error = err.message
      logs.push(createTestLog('error', `请求失败: ${err.message} (${duration}ms)`))
    }
  }

  return {
    aborted,
    abortDelay,
    result,
    error,
    manualAbortWorking: aborted,
  }
}

/** 测试超时中断 */
async function testTimeoutAbort(http: any, config: AbortTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始超时中断测试'))

  const shortTimeout = 1000 // 1秒超时
  logs.push(createTestLog('info', `设置短超时时间: ${shortTimeout}ms`))

  const startTime = Date.now()
  let result: any
  let timedOut = false
  let error: string | undefined

  try {
    /** 使用一个可能较慢的端点或者延迟端点 */
    result = await http.get('/posts', {
      timeout: shortTimeout,
    })
    const duration = Date.now() - startTime
    logs.push(createTestLog('warning', `请求完成，未超时 (${duration}ms)`))
  }
  catch (err: any) {
    const duration = Date.now() - startTime

    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      timedOut = true
      logs.push(createTestLog('success', `请求超时中断 (${duration}ms)`))
    }
    else {
      error = err.message
      logs.push(createTestLog('error', `请求失败: ${err.message} (${duration}ms)`))
    }
  }

  return {
    timeout: shortTimeout,
    timedOut,
    result,
    error,
    timeoutAbortWorking: timedOut,
  }
}

/** 测试多请求中断 */
async function testMultipleAbort(http: any, config: AbortTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始多请求中断测试'))

  const controller = new AbortController()
  const requestCount = 3
  const abortDelay = config.abortDelay

  logs.push(createTestLog('info', `启动 ${requestCount} 个请求，${abortDelay}ms 后统一中断`))

  /** 启动多个请求 */
  const requests = []
  for (let i = 0; i < requestCount; i++) {
    const requestPromise = http.get(`/posts/${i + 1}`, {
      signal: controller.signal,
      timeout: config.timeout,
    })
    requests.push(requestPromise)
  }

  /** 设置中断定时器 */
  setTimeout(() => {
    logs.push(createTestLog('info', `${abortDelay}ms 后中断所有请求`))
    controller.abort()
  }, abortDelay)

  const startTime = Date.now()
  const results = []

  /** 等待所有请求完成或中断 */
  for (let i = 0; i < requests.length; i++) {
    try {
      const result = await requests[i]
      const duration = Date.now() - startTime
      results.push({ index: i, status: 'completed', result, duration })
      logs.push(createTestLog('warning', `请求 ${i + 1} 完成，未被中断`))
    }
    catch (err: any) {
      const duration = Date.now() - startTime
      const aborted = err.name === 'AbortError' || err.message?.includes('aborted')
      results.push({
        index: i,
        status: aborted
          ? 'aborted'
          : 'error',
        error: err.message,
        duration,
      })
      logs.push(createTestLog(
        aborted
          ? 'success'
          : 'error',
        `请求 ${i + 1} ${aborted
          ? '已中断'
          : '失败'}: ${err.message}`,
      ))
    }
  }

  const abortedCount = results.filter(r => r.status === 'aborted').length
  const completedCount = results.filter(r => r.status === 'completed').length

  logs.push(createTestLog('info', `多请求中断测试完成: ${abortedCount} 个中断, ${completedCount} 个完成`))

  return {
    requestCount,
    abortDelay,
    results,
    abortedCount,
    completedCount,
    multipleAbortWorking: abortedCount > 0,
  }
}

/** 测试中断恢复 */
async function testAbortRecovery(http: any, config: AbortTestConfig, logs: any[]) {
  logs.push(createTestLog('info', '开始中断恢复测试'))

  const attempts = []

  /** 第一次尝试 - 会被中断 */
  logs.push(createTestLog('info', '第一次尝试 - 将被中断'))
  const controller1 = new AbortController()

  setTimeout(() => {
    logs.push(createTestLog('info', '中断第一次请求'))
    controller1.abort()
  }, config.abortDelay)

  const startTime1 = Date.now()
  try {
    const result1 = await http.get(config.testUrl, {
      signal: controller1.signal,
      timeout: config.timeout,
    })
    const duration1 = Date.now() - startTime1
    attempts.push({ attempt: 1, status: 'completed', result: result1, duration: duration1 })
    logs.push(createTestLog('warning', `第一次请求完成，未被中断 (${duration1}ms)`))
  }
  catch (err: any) {
    const duration1 = Date.now() - startTime1
    const aborted = err.name === 'AbortError' || err.message?.includes('aborted')
    attempts.push({
      attempt: 1,
      status: aborted
        ? 'aborted'
        : 'error',
      error: err.message,
      duration: duration1,
    })
    logs.push(createTestLog(
      aborted
        ? 'success'
        : 'error',
      `第一次请求 ${aborted
        ? '已中断'
        : '失败'} (${duration1}ms)`,
    ))
  }

  /** 等待一段时间后重试 */
  await delay(500)

  /** 第二次尝试 - 正常完成 */
  logs.push(createTestLog('info', '第二次尝试 - 正常请求'))
  const startTime2 = Date.now()
  try {
    const result2 = await http.get(config.testUrl, {
      timeout: config.timeout,
    })
    const duration2 = Date.now() - startTime2
    attempts.push({ attempt: 2, status: 'completed', result: result2, duration: duration2 })
    logs.push(createTestLog('success', `第二次请求完成 (${duration2}ms)`))
  }
  catch (err: any) {
    const duration2 = Date.now() - startTime2
    attempts.push({ attempt: 2, status: 'error', error: err.message, duration: duration2 })
    logs.push(createTestLog('error', `第二次请求失败: ${err.message} (${duration2}ms)`))
  }

  const firstAborted = attempts[0]?.status === 'aborted'
  const secondCompleted = attempts[1]?.status === 'completed'

  logs.push(createTestLog('info', `中断恢复测试完成: 第一次${firstAborted
    ? '中断'
    : '未中断'}, 第二次${secondCompleted
    ? '成功'
    : '失败'}`))

  return {
    attempts,
    firstAborted,
    secondCompleted,
    recoveryWorking: firstAborted && secondCompleted,
  }
}

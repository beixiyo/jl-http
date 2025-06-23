/**
 * 测试模块工具函数
 */

import { Http } from '@jl-org/http'
import type { HttpTestConfig, TestLogEntry, TestResult } from './types'

/** 创建 HTTP 实例 */
export function createHttpInstance(config: HttpTestConfig = {}): Http {
  return new Http({
    baseUrl: config.baseUrl || 'https://jsonplaceholder.typicode.com',
    timeout: config.timeout || 10000,
    retry: config.retry || 2,
    cacheTimeout: config.cacheTimeout || 5000,
    reqInterceptor: config.interceptors?.request || ((config) => {
      console.log('🚀 请求发送:', config.method, config.url)
      return config
    }),
    respInterceptor: config.interceptors?.response || ((response) => {
      console.log('✅ 响应接收:', response.rawResp.status, response.rawResp.url)
      return response.data
    }),
    respErrInterceptor: config.interceptors?.error || ((error) => {
      console.error('❌ 请求错误:', error)
    }),
    ...config.headers && { headers: config.headers },
  })
}

/** 创建测试日志 */
export function createTestLog(
  level: TestLogEntry['level'],
  message: string,
  data?: any,
): TestLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toLocaleTimeString(),
    level,
    message,
    data,
  }
}

/** 测量执行时间 */
export async function measureTime<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - startTime
    return { result, duration }
  }
  catch (error) {
    const duration = Date.now() - startTime
    throw { error, duration }
  }
}

/** 创建成功的测试结果 */
export function createSuccessResult(
  data: any,
  duration: number,
  logs: TestLogEntry[] = [],
  metadata?: Record<string, any>,
): TestResult {
  return {
    success: true,
    data,
    duration,
    logs,
    metadata,
  }
}

/** 创建失败的测试结果 */
export function createErrorResult(
  error: string,
  duration: number,
  logs: TestLogEntry[] = [],
  metadata?: Record<string, any>,
): TestResult {
  return {
    success: false,
    error,
    duration,
    logs,
    metadata,
  }
}

/** 延迟函数 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** 生成随机字符串 */
export function generateRandomString(length: number = 8): string {
  return Math.random().toString(36).substr(2, length)
}

/** 格式化持续时间 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${(ms / 60000).toFixed(1)}min`
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/** 检查是否为缓存命中 */
export function isCacheHit(duration: number, threshold: number = 100): boolean {
  return duration < threshold
}

/** 创建模拟错误 */
export function createMockError(message: string, code?: string): Error {
  const error = new Error(message)
  if (code) {
    (error as any).code = code
  }
  return error
}

/** 验证 URL */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  }
  catch {
    return false
  }
}

/** 验证 JSON 字符串 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  }
  catch {
    return false
  }
}

/** 深度克隆对象 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any
  }
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as any
  }
  if (typeof obj === 'object') {
    const cloned = {} as any
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }
  return obj
}

/** 安全执行异步函数 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback?: T,
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await fn()
    return { success: true, data }
  }
  catch (error: any) {
    return {
      success: false,
      error: error.message || '执行失败',
      data: fallback,
    }
  }
}

/** 重试执行函数 */
export async function retryExecute<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    }
    catch (error: any) {
      lastError = error
      if (i < maxRetries) {
        await delay(delayMs * (i + 1)) // 递增延迟
      }
    }
  }

  throw lastError!
}

/** 并发执行任务 */
export async function executeConcurrent<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number = 3,
): Promise<Array<{ status: 'fulfilled' | 'rejected'; value?: T; reason?: any }>> {
  const results: Array<{ status: 'fulfilled' | 'rejected'; value?: T; reason?: any }> = []
  const executing: Promise<void>[] = []

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const promise = task()
      .then(value => {
        results[i] = { status: 'fulfilled', value }
      })
      .catch(reason => {
        results[i] = { status: 'rejected', reason }
      })

    executing.push(promise)

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing)
      executing.splice(executing.findIndex(p => p === promise), 1)
    }
  }

  await Promise.all(executing)
  return results
}

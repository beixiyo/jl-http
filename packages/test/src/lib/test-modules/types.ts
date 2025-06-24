/**
 * 测试模块的核心类型定义
 */

import type { BaseCacheConstructorConfig } from '@jl-org/http'

/** 测试状态 */
export type TestStatus = 'idle' | 'running' | 'success' | 'error'

/** 测试日志条目 */
export interface TestLogEntry {
  id: string
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  data?: any
}

/** 测试结果 */
export interface TestResult {
  success: boolean
  data?: any
  error?: string
  duration: number
  logs: TestLogEntry[]
  metadata?: Record<string, any>
}

/** 测试场景配置 */
export interface TestScenario {
  id: string
  name: string
  description: string
  features: string[]
  category: string
  priority: number
}

/** 测试执行上下文 */
export interface TestContext {
  scenario: TestScenario
  config: Record<string, any>
  abortController?: AbortController
}

/** 测试模块接口 */
export interface TestModule {
  /** 模块标识 */
  id: string
  /** 模块名称 */
  name: string
  /** 模块描述 */
  description: string
  /** 支持的测试场景 */
  scenarios: TestScenario[]
  /** 执行测试 */
  execute: (context: TestContext) => Promise<TestResult>
  /** 获取默认配置 */
  getDefaultConfig: () => Record<string, any>
  /** 验证配置 */
  validateConfig: (config: any) => boolean
}

/** 测试执行器状态 */
export interface TestExecutorState {
  currentTest?: {
    moduleId: string
    scenarioId: string
    startTime: number
  }
  results: Map<string, TestResult>
  logs: TestLogEntry[]
  globalStatus: TestStatus
}

/** 测试报告 */
export interface TestReport {
  summary: {
    total: number
    passed: number
    failed: number
    duration: number
    timestamp: string
  }
  results: Array<{
    moduleId: string
    scenarioId: string
    result: TestResult
  }>
  logs: TestLogEntry[]
}

/** HTTP 测试配置 */
export type HttpTestConfig = BaseCacheConstructorConfig

/** 并发测试配置 */
export interface ConcurrentTestConfig extends HttpTestConfig {
  taskCount: number
  maxConcurrency: number
  includeFailures: boolean
  requestType: 'posts' | 'users' | 'mixed' | 'delay'
}

/** 缓存测试配置 */
export interface CacheTestConfig extends HttpTestConfig {
  cacheTimeout: number
  testUrl: string
  requestBody?: string
}

/** 中断测试配置 */
export interface AbortTestConfig extends HttpTestConfig {
  abortDelay: number
  testUrl: string
}

/** SSE 测试配置 */
export interface SSETestConfig {
  url: string
  timeout?: number
  expectedEvents?: number
}

/** 重试测试配置 */
export interface RetryTestConfig extends HttpTestConfig {
  maxRetries: number
  retryDelay?: number
  failureRate?: number
}

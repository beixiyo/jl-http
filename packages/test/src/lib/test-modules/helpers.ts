/**
 * 测试模块开发辅助工具
 */

import type { TestModule, TestScenario, TestContext, TestResult, TestLogEntry } from './types'
import { createTestLog, createSuccessResult, createErrorResult, measureTime } from './utils'

/**
 * 创建测试模块的辅助函数
 */
export function createTestModule(config: {
  id: string
  name: string
  description: string
  scenarios: TestScenario[]
  defaultConfig?: Record<string, any>
  validateConfig?: (config: Record<string, any>) => boolean
  execute: (context: TestContext, helpers: TestModuleHelpers) => Promise<TestResult>
}): TestModule {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    scenarios: config.scenarios,
    
    getDefaultConfig() {
      return config.defaultConfig || {}
    },
    
    validateConfig(testConfig) {
      if (config.validateConfig) {
        return config.validateConfig(testConfig)
      }
      return true
    },
    
    async execute(context: TestContext): Promise<TestResult> {
      const logs: TestLogEntry[] = []
      
      const helpers: TestModuleHelpers = {
        log: (level, message, data?) => {
          const logEntry = createTestLog(level, message, data)
          logs.push(logEntry)
          return logEntry
        },
        
        measure: measureTime,
        
        createSuccess: (data, duration, metadata?) => 
          createSuccessResult(data, duration, logs, metadata),
        
        createError: (error, duration, metadata?) => 
          createErrorResult(error, duration, logs, metadata),
      }
      
      try {
        return await config.execute(context, helpers)
      } catch (error: any) {
        helpers.log('error', `测试执行失败: ${error.message}`, error)
        return helpers.createError(error.message, 0)
      }
    }
  }
}

/**
 * 测试模块辅助工具接口
 */
export interface TestModuleHelpers {
  /** 记录日志 */
  log: (level: TestLogEntry['level'], message: string, data?: any) => TestLogEntry
  /** 测量执行时间 */
  measure: <T>(fn: () => Promise<T>) => Promise<{ result: T; duration: number }>
  /** 创建成功结果 */
  createSuccess: (data: any, duration: number, metadata?: Record<string, any>) => TestResult
  /** 创建错误结果 */
  createError: (error: string, duration: number, metadata?: Record<string, any>) => TestResult
}

/**
 * 创建测试场景的辅助函数
 */
export function createTestScenario(config: {
  id: string
  name: string
  description: string
  features: string[]
  category?: string
  priority?: number
}): TestScenario {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    features: config.features,
    category: config.category || 'general',
    priority: config.priority || 1,
  }
}

/**
 * 批量创建测试场景
 */
export function createTestScenarios(scenarios: Array<{
  id: string
  name: string
  description: string
  features: string[]
  category?: string
  priority?: number
}>): TestScenario[] {
  return scenarios.map(createTestScenario)
}

/**
 * 测试断言工具
 */
export class TestAssert {
  private logs: TestLogEntry[] = []
  
  constructor(private logFn: (level: TestLogEntry['level'], message: string, data?: any) => void) {}
  
  /** 断言值为真 */
  assertTrue(value: any, message: string = '断言失败') {
    if (!value) {
      this.logFn('error', `${message}: 期望为真，实际为 ${value}`)
      throw new Error(message)
    }
    this.logFn('success', `断言通过: ${message}`)
  }
  
  /** 断言值为假 */
  assertFalse(value: any, message: string = '断言失败') {
    if (value) {
      this.logFn('error', `${message}: 期望为假，实际为 ${value}`)
      throw new Error(message)
    }
    this.logFn('success', `断言通过: ${message}`)
  }
  
  /** 断言相等 */
  assertEqual(actual: any, expected: any, message: string = '断言失败') {
    if (actual !== expected) {
      this.logFn('error', `${message}: 期望 ${expected}，实际 ${actual}`)
      throw new Error(message)
    }
    this.logFn('success', `断言通过: ${message}`)
  }
  
  /** 断言不相等 */
  assertNotEqual(actual: any, expected: any, message: string = '断言失败') {
    if (actual === expected) {
      this.logFn('error', `${message}: 期望不等于 ${expected}，实际 ${actual}`)
      throw new Error(message)
    }
    this.logFn('success', `断言通过: ${message}`)
  }
  
  /** 断言包含 */
  assertContains(container: any[], item: any, message: string = '断言失败') {
    if (!container.includes(item)) {
      this.logFn('error', `${message}: 期望包含 ${item}`)
      throw new Error(message)
    }
    this.logFn('success', `断言通过: ${message}`)
  }
  
  /** 断言类型 */
  assertType(value: any, type: string, message: string = '断言失败') {
    if (typeof value !== type) {
      this.logFn('error', `${message}: 期望类型 ${type}，实际类型 ${typeof value}`)
      throw new Error(message)
    }
    this.logFn('success', `断言通过: ${message}`)
  }
  
  /** 断言范围 */
  assertInRange(value: number, min: number, max: number, message: string = '断言失败') {
    if (value < min || value > max) {
      this.logFn('error', `${message}: 期望在 ${min}-${max} 范围内，实际 ${value}`)
      throw new Error(message)
    }
    this.logFn('success', `断言通过: ${message}`)
  }
  
  /** 断言抛出错误 */
  async assertThrows(fn: () => Promise<any> | any, message: string = '断言失败') {
    try {
      await fn()
      this.logFn('error', `${message}: 期望抛出错误，但没有抛出`)
      throw new Error(message)
    } catch (error) {
      this.logFn('success', `断言通过: ${message}`)
    }
  }
}

/**
 * 创建测试断言实例
 */
export function createAssert(logFn: (level: TestLogEntry['level'], message: string, data?: any) => void): TestAssert {
  return new TestAssert(logFn)
}

/**
 * 测试数据生成器
 */
export class TestDataGenerator {
  /** 生成随机字符串 */
  static randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
  
  /** 生成随机数字 */
  static randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  
  /** 生成随机邮箱 */
  static randomEmail(): string {
    return `${this.randomString(8)}@${this.randomString(5)}.com`
  }
  
  /** 生成随机URL */
  static randomUrl(): string {
    return `https://${this.randomString(8)}.com/${this.randomString(6)}`
  }
  
  /** 生成测试用户数据 */
  static testUser() {
    return {
      id: this.randomNumber(1, 1000),
      name: this.randomString(8),
      email: this.randomEmail(),
      age: this.randomNumber(18, 80),
    }
  }
  
  /** 生成测试文章数据 */
  static testPost() {
    return {
      id: this.randomNumber(1, 1000),
      title: `测试文章 ${this.randomString(6)}`,
      body: `这是一篇测试文章的内容 ${this.randomString(20)}`,
      userId: this.randomNumber(1, 100),
    }
  }
}

/**
 * 性能测试工具
 */
export class PerformanceTracker {
  private marks: Map<string, number> = new Map()
  
  /** 开始计时 */
  start(name: string) {
    this.marks.set(name, Date.now())
  }
  
  /** 结束计时并返回耗时 */
  end(name: string): number {
    const startTime = this.marks.get(name)
    if (!startTime) {
      throw new Error(`未找到计时器: ${name}`)
    }
    const duration = Date.now() - startTime
    this.marks.delete(name)
    return duration
  }
  
  /** 测量函数执行时间 */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.start(name)
    try {
      const result = await fn()
      const duration = this.end(name)
      return { result, duration }
    } catch (error) {
      this.end(name)
      throw error
    }
  }
}

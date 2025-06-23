/**
 * 测试执行器 - 负责管理和执行测试模块
 */

import type { TestExecutorState, TestLogEntry, TestModule, TestReport, TestResult, TestScenario, TestStatus } from './types'

export class TestExecutor {
  private modules = new Map<string, TestModule>()
  private state: TestExecutorState = {
    results: new Map(),
    logs: [],
    globalStatus: 'idle',
  }
  private listeners = new Set<(state: TestExecutorState) => void>()

  /** 注册测试模块 */
  registerModule(module: TestModule) {
    this.modules.set(module.id, module)
  }

  /** 获取所有模块 */
  getModules(): TestModule[] {
    return Array.from(this.modules.values())
  }

  /** 获取模块 */
  getModule(moduleId: string): TestModule | undefined {
    return this.modules.get(moduleId)
  }

  /** 获取当前状态 */
  getState(): TestExecutorState {
    return { ...this.state }
  }

  /** 订阅状态变化 */
  subscribe(listener: (state: TestExecutorState) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 通知状态变化 */
  private notifyStateChange() {
    this.listeners.forEach(listener => listener(this.getState()))
  }

  /** 添加日志 */
  private addLog(entry: Omit<TestLogEntry, 'id' | 'timestamp'>) {
    const logEntry: TestLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString(),
    }
    this.state.logs.unshift(logEntry)
    this.notifyStateChange()
  }

  /** 更新全局状态 */
  private updateGlobalStatus(status: TestStatus) {
    this.state.globalStatus = status
    this.notifyStateChange()
  }

  /** 执行单个测试 */
  async executeTest(moduleId: string, scenarioId: string, config: Record<string, any> = {}): Promise<TestResult> {
    const module = this.modules.get(moduleId)
    if (!module) {
      throw new Error(`测试模块 ${moduleId} 不存在`)
    }

    const scenario = module.scenarios.find(s => s.id === scenarioId)
    if (!scenario) {
      throw new Error(`测试场景 ${scenarioId} 不存在`)
    }

    // 验证配置
    const finalConfig = { ...module.getDefaultConfig(), ...config }
    if (!module.validateConfig(finalConfig)) {
      throw new Error('测试配置验证失败')
    }

    // 更新状态
    this.state.currentTest = {
      moduleId,
      scenarioId,
      startTime: Date.now(),
    }
    this.updateGlobalStatus('running')

    this.addLog({
      level: 'info',
      message: `开始执行测试: ${module.name} - ${scenario.name}`,
    })

    try {
      // 创建中断控制器
      const abortController = new AbortController()

      // 执行测试
      const result = await module.execute({
        scenario,
        config: finalConfig,
        abortController,
      })

      // 保存结果
      const resultKey = `${moduleId}_${scenarioId}`
      this.state.results.set(resultKey, result)

      this.addLog({
        level: result.success ? 'success' : 'error',
        message: `测试完成: ${module.name} - ${scenario.name} (${result.duration}ms)`,
        data: result.success ? result.data : result.error,
      })

      this.state.currentTest = undefined
      this.updateGlobalStatus('idle')

      return result
    }
    catch (error: any) {
      const duration = Date.now() - (this.state.currentTest?.startTime || 0)
      const result: TestResult = {
        success: false,
        error: error.message || '测试执行失败',
        duration,
        logs: [],
      }

      const resultKey = `${moduleId}_${scenarioId}`
      this.state.results.set(resultKey, result)

      this.addLog({
        level: 'error',
        message: `测试失败: ${module.name} - ${scenario.name}`,
        data: error.message,
      })

      this.state.currentTest = undefined
      this.updateGlobalStatus('error')

      throw error
    }
  }

  /** 执行模块的所有测试 */
  async executeModule(moduleId: string, config: Record<string, any> = {}): Promise<TestResult[]> {
    const module = this.modules.get(moduleId)
    if (!module) {
      throw new Error(`测试模块 ${moduleId} 不存在`)
    }

    const results: TestResult[] = []

    for (const scenario of module.scenarios) {
      try {
        const result = await this.executeTest(moduleId, scenario.id, config)
        results.push(result)
        // 测试间稍作延迟
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      catch (error) {
        // 继续执行其他测试
        console.error(`测试 ${scenario.id} 失败:`, error)
      }
    }

    return results
  }

  /** 执行所有测试 */
  async executeAll(config: Record<string, any> = {}): Promise<TestReport> {
    this.addLog({
      level: 'info',
      message: '开始执行所有测试模块',
    })

    const startTime = Date.now()
    const allResults: Array<{ moduleId: string; scenarioId: string; result: TestResult }> = []

    for (const module of this.modules.values()) {
      for (const scenario of module.scenarios) {
        try {
          const result = await this.executeTest(module.id, scenario.id, config)
          allResults.push({
            moduleId: module.id,
            scenarioId: scenario.id,
            result,
          })
        }
        catch (error) {
          // 记录错误但继续执行
          console.error(`测试 ${module.id}/${scenario.id} 失败:`, error)
        }
        // 测试间稍作延迟
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    const duration = Date.now() - startTime
    const passed = allResults.filter(r => r.result.success).length
    const failed = allResults.length - passed

    const report: TestReport = {
      summary: {
        total: allResults.length,
        passed,
        failed,
        duration,
        timestamp: new Date().toISOString(),
      },
      results: allResults,
      logs: [...this.state.logs],
    }

    this.addLog({
      level: passed === allResults.length ? 'success' : 'warning',
      message: `所有测试执行完成: 总计 ${allResults.length}, 通过 ${passed}, 失败 ${failed}`,
    })

    return report
  }

  /** 清空状态 */
  clearState() {
    this.state = {
      results: new Map(),
      logs: [],
      globalStatus: 'idle',
    }
    this.notifyStateChange()
  }

  /** 中断当前测试 */
  abortCurrentTest() {
    if (this.state.currentTest) {
      this.addLog({
        level: 'warning',
        message: '用户中断了当前测试',
      })
      this.state.currentTest = undefined
      this.updateGlobalStatus('idle')
    }
  }
}

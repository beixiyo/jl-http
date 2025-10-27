import type { TestExecutorState, TestModule, TestReport, TestResult } from '@/lib/test-modules'
import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TestLogViewer, TestResultCard, TestSummary } from '@/components/TestReport'
import {
  defaultTestExecutor,

} from '@/lib/test-modules'

export default function HttpComprehensiveTest() {
  const [modules, setModules] = useState<TestModule[]>([])
  const [executorState, setExecutorState] = useState<TestExecutorState>()
  const [currentReport, setCurrentReport] = useState<TestReport>()
  const [selectedModule, setSelectedModule] = useState<string>()
  const [selectedScenario, setSelectedScenario] = useState<string>()
  const [isRunning, setIsRunning] = useState(false)

  /** 初始化测试执行器 */
  useEffect(() => {
    setModules(defaultTestExecutor.getModules())
    setExecutorState(defaultTestExecutor.getState())

    /** 订阅状态变化 */
    const unsubscribe = defaultTestExecutor.subscribe((state) => {
      setExecutorState(state)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  /** 执行单个测试 */
  const executeTest = async (moduleId: string, scenarioId: string) => {
    if (isRunning)
      return

    setIsRunning(true)
    setSelectedModule(moduleId)
    setSelectedScenario(scenarioId)

    try {
      await defaultTestExecutor.executeTest(moduleId, scenarioId)
    }
    catch (error) {
      console.error('测试执行失败:', error)
    }
    finally {
      setIsRunning(false)
      setSelectedModule(undefined)
      setSelectedScenario(undefined)
    }
  }

  /** 执行模块的所有测试 */
  const executeModule = async (moduleId: string) => {
    if (isRunning)
      return

    setIsRunning(true)
    try {
      await defaultTestExecutor.executeModule(moduleId)
    }
    catch (error) {
      console.error('模块测试执行失败:', error)
    }
    finally {
      setIsRunning(false)
    }
  }

  /** 执行所有测试 */
  const executeAllTests = async () => {
    if (isRunning)
      return

    setIsRunning(true)
    try {
      const report = await defaultTestExecutor.executeAll()
      setCurrentReport(report)
    }
    catch (error) {
      console.error('全部测试执行失败:', error)
    }
    finally {
      setIsRunning(false)
    }
  }

  /** 清空状态 */
  const clearAll = () => {
    defaultTestExecutor.clearState()
    setCurrentReport(undefined)
  }

  /** 获取测试结果 */
  const getTestResult = (moduleId: string, scenarioId: string): TestResult | undefined => {
    if (!executorState)
      return undefined
    return executorState.results.get(`${moduleId}_${scenarioId}`)
  }

  /** 检查测试是否正在运行 */
  const isTestRunning = (moduleId: string, scenarioId: string): boolean => {
    return isRunning
      && selectedModule === moduleId
      && selectedScenario === scenarioId
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">jl-http 综合功能测试</h1>
        <p className="text-gray-600 dark:text-gray-400">
          基于模块化架构的 jl-http 功能测试平台，提供统一的测试入口和详细的测试报告
        </p>
      </div>

      {/* 测试摘要 */}
      {currentReport && (
        <TestSummary
          report={ currentReport }
          isRunning={ isRunning }
          className="mb-6"
        />
      )}

      {/* 控制面板 */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">测试控制</h2>
          <div className="flex gap-2">
            <Button
              onClick={ executeAllTests }
              loading={ isRunning }
              disabled={ isRunning }
            >
              执行所有测试
            </Button>
            <Button
              onClick={ clearAll }
              designStyle="outlined"
              disabled={ isRunning }
            >
              清空重置
            </Button>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          点击测试卡片执行单个测试，或使用"执行所有测试"按钮运行完整的测试套件
        </div>
      </Card>

      {/* 测试模块 */}
      <div className="space-y-8">
        {modules.map(module => (
          <Card key={ module.id } className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{module.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {module.description}
                </p>
              </div>
              <Button
                onClick={ () => executeModule(module.id) }
                loading={ isRunning }
                disabled={ isRunning }
                size="sm"
              >
                执行模块
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 md:grid-cols-2">
              {module.scenarios.map(scenario => (
                <TestResultCard
                  key={ scenario.id }
                  scenario={ scenario }
                  result={ getTestResult(module.id, scenario.id) }
                  isRunning={ isTestRunning(module.id, scenario.id) }
                  onClick={ () => executeTest(module.id, scenario.id) }
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* 测试日志 */}
      {executorState && (
        <TestLogViewer
          logs={ executorState.logs }
          onClear={ clearAll }
          className="mt-6"
        />
      )}

      {/* 功能特性总结 */}
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
              <li>• 模块化测试架构</li>
              <li>• 统一测试报告</li>
              <li>• 灵活配置选项</li>
              <li>• 完整的错误处理</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}

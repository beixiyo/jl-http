/**
 * 测试模块运行器组件 - 可复用的测试模块执行界面
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TestResultCard, TestLogViewer, TestSummary } from '@/components/TestReport'
import { cn } from '@/utils'
import { 
  TestExecutor,
  type TestModule, 
  type TestResult, 
  type TestExecutorState,
  type TestReport
} from '@/lib/test-modules'

export const TestModuleRunner = ({
  module,
  title,
  description,
  className,
  showAllScenarios = true,
  defaultConfig = {},
  onTestComplete,
}: TestModuleRunnerProps) => {
  const [executor] = useState(() => {
    const exec = new TestExecutor()
    exec.registerModule(module)
    return exec
  })
  
  const [executorState, setExecutorState] = useState<TestExecutorState>()
  const [currentReport, setCurrentReport] = useState<TestReport>()
  const [selectedScenario, setSelectedScenario] = useState<string>()
  const [isRunning, setIsRunning] = useState(false)
  const [config, setConfig] = useState(defaultConfig)

  // 初始化执行器
  useEffect(() => {
    setExecutorState(executor.getState())

    // 订阅状态变化
    const unsubscribe = executor.subscribe((state) => {
      setExecutorState(state)
    })

    return () => {
      unsubscribe()
    }
  }, [executor])

  // 执行单个测试
  const executeTest = async (scenarioId: string) => {
    if (isRunning) return

    setIsRunning(true)
    setSelectedScenario(scenarioId)

    try {
      const result = await executor.executeTest(module.id, scenarioId, config)
      onTestComplete?.(scenarioId, result)
    } catch (error) {
      console.error('测试执行失败:', error)
    } finally {
      setIsRunning(false)
      setSelectedScenario(undefined)
    }
  }

  // 执行所有测试
  const executeAllTests = async () => {
    if (isRunning) return

    setIsRunning(true)
    try {
      const results = await executor.executeModule(module.id, config)
      const report = createReportFromResults(results)
      setCurrentReport(report)
      onTestComplete?.('all', results)
    } catch (error) {
      console.error('全部测试执行失败:', error)
    } finally {
      setIsRunning(false)
    }
  }

  // 清空状态
  const clearAll = () => {
    executor.clearState()
    setCurrentReport(undefined)
  }

  // 获取测试结果
  const getTestResult = (scenarioId: string): TestResult | undefined => {
    if (!executorState) return undefined
    return executorState.results.get(`${module.id}_${scenarioId}`)
  }

  // 检查测试是否正在运行
  const isTestRunning = (scenarioId: string): boolean => {
    return isRunning && selectedScenario === scenarioId
  }

  // 从结果创建报告
  const createReportFromResults = (results: TestResult[]): TestReport => {
    const passed = results.filter(r => r.success).length
    const failed = results.length - passed
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

    return {
      summary: {
        total: results.length,
        passed,
        failed,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
      },
      results: results.map((result, index) => ({
        moduleId: module.id,
        scenarioId: module.scenarios[index]?.id || `scenario_${index}`,
        result,
      })),
      logs: executorState?.logs || [],
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 标题和描述 */}
      <div>
        <h1 className="mb-2 text-3xl font-bold">{title || module.name}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {description || module.description}
        </p>
      </div>

      {/* 测试摘要 */}
      {currentReport && (
        <TestSummary 
          report={currentReport} 
          isRunning={isRunning}
        />
      )}

      {/* 控制面板 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">测试控制</h2>
          <div className="flex gap-2">
            <Button
              onClick={executeAllTests}
              loading={isRunning}
              disabled={isRunning}
            >
              执行所有测试
            </Button>
            <Button
              onClick={clearAll}
              designStyle="outlined"
              disabled={isRunning}
            >
              清空重置
            </Button>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          点击测试卡片执行单个测试，或使用"执行所有测试"按钮运行完整的测试套件
        </div>
      </Card>

      {/* 测试场景 */}
      {showAllScenarios && (
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">测试场景</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {module.scenarios.length} 个测试场景
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 md:grid-cols-2">
            {module.scenarios.map((scenario) => (
              <TestResultCard
                key={scenario.id}
                scenario={scenario}
                result={getTestResult(scenario.id)}
                isRunning={isTestRunning(scenario.id)}
                onClick={() => executeTest(scenario.id)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* 测试日志 */}
      {executorState && executorState.logs.length > 0 && (
        <TestLogViewer
          logs={executorState.logs}
          onClear={clearAll}
        />
      )}

      {/* 模块信息 */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">模块信息</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium">基本信息</h3>
            <ul className="text-sm text-gray-600 space-y-1 dark:text-gray-400">
              <li>• 模块ID: {module.id}</li>
              <li>• 模块名称: {module.name}</li>
              <li>• 测试场景: {module.scenarios.length} 个</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-medium">测试特性</h3>
            <ul className="text-sm text-gray-600 space-y-1 dark:text-gray-400">
              {module.scenarios.slice(0, 3).map((scenario, index) => (
                <li key={index}>• {scenario.features.join(', ')}</li>
              ))}
              {module.scenarios.length > 3 && (
                <li>• 更多特性...</li>
              )}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}

export type TestModuleRunnerProps = {
  /** 测试模块 */
  module: TestModule
  /** 页面标题 */
  title?: string
  /** 页面描述 */
  description?: string
  /** 是否显示所有测试场景 */
  showAllScenarios?: boolean
  /** 默认配置 */
  defaultConfig?: Record<string, any>
  /** 测试完成回调 */
  onTestComplete?: (scenarioId: string, result: TestResult | TestResult[]) => void
} & React.HTMLAttributes<HTMLDivElement>

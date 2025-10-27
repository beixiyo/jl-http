/**
 * 测试结果卡片组件
 */

import type { TestResult, TestScenario } from '@/lib/test-modules'
import { memo } from 'react'
import { Card } from '@/components/Card'
import { cn } from '@/utils'

export const TestResultCard = memo<TestResultCardProps>(({
  scenario,
  result,
  isRunning = false,
  onClick,
  className,
}) => {
  const getStatusColor = () => {
    if (isRunning) {
      return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }
    if (!result) {
      return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
    return result.success
      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  }

  const getStatusIcon = () => {
    if (isRunning)
      return '🔄'
    if (!result)
      return '⭕'
    return result.success
      ? '✅'
      : '❌'
  }

  const getStatusText = () => {
    if (isRunning)
      return '运行中'
    if (!result)
      return '未运行'
    return result.success
      ? '成功'
      : '失败'
  }

  return (
    <Card
      className={ cn(
        'p-4 cursor-pointer transition-all hover:shadow-lg',
        getStatusColor(),
        className,
      ) }
      onClick={ onClick }
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{scenario.name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-lg">{getStatusIcon()}</span>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {getStatusText()}
          </span>
        </div>
      </div>

      <p className="line-clamp-2 mb-3 text-xs text-gray-600 dark:text-gray-400">
        {scenario.description}
      </p>

      <div className="mb-3 flex flex-wrap gap-1">
        {scenario.features.slice(0, 3).map((feature, index) => (
          <span
            key={ index }
            className="rounded bg-white/50 px-2 py-1 text-xs dark:bg-black/20"
          >
            {feature}
          </span>
        ))}
        {scenario.features.length > 3 && (
          <span className="rounded bg-white/50 px-2 py-1 text-xs dark:bg-black/20">
            +
            {scenario.features.length - 3}
          </span>
        )}
      </div>

      {result && (
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">耗时:</span>
            <span>
              {result.duration}
              ms
            </span>
          </div>
          {result.metadata?.requestCount && (
            <div className="flex justify-between">
              <span className="text-gray-500">请求数:</span>
              <span>{result.metadata.requestCount}</span>
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div className="line-clamp-1 mt-2 text-xs text-red-600 dark:text-red-400">
          错误:
          {' '}
          {result.error}
        </div>
      )}

      {isRunning && (
        <div className="mt-2 flex items-center text-xs text-blue-600 dark:text-blue-400">
          <div className="mr-2 h-3 w-3 animate-spin border-b-2 border-current rounded-full"></div>
          执行中...
        </div>
      )}
    </Card>
  )
})

TestResultCard.displayName = 'TestResultCard'

export type TestResultCardProps = {
  /** 测试场景 */
  scenario: TestScenario
  /** 测试结果 */
  result?: TestResult
  /** 是否正在运行 */
  isRunning?: boolean
  /** 点击事件 */
  onClick?: () => void
} & React.HTMLAttributes<HTMLDivElement>

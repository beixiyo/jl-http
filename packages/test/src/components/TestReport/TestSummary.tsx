/**
 * 测试摘要组件
 */

import { memo } from 'react'
import { Card } from '@/components/Card'
import { cn } from '@/utils'
import type { TestReport } from '@/lib/test-modules'

export const TestSummary = memo<TestSummaryProps>(({
  report,
  isRunning = false,
  className,
}) => {
  const { summary } = report
  const successRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0

  const getSuccessRateColor = () => {
    if (successRate >= 90) return 'text-green-600 dark:text-green-400'
    if (successRate >= 70) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">测试摘要</h2>
        {isRunning && (
          <div className="flex items-center text-blue-600 dark:text-blue-400">
            <div className="mr-2 h-4 w-4 animate-spin border-b-2 border-current rounded-full"></div>
            <span className="text-sm">测试进行中...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {/* 总测试数 */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {summary.total}
          </div>
          <div className="text-sm text-gray-500">总测试数</div>
        </div>

        {/* 通过数 */}
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {summary.passed}
          </div>
          <div className="text-sm text-gray-500">通过</div>
        </div>

        {/* 失败数 */}
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {summary.failed}
          </div>
          <div className="text-sm text-gray-500">失败</div>
        </div>

        {/* 成功率 */}
        <div className="text-center">
          <div className={cn('text-2xl font-bold', getSuccessRateColor())}>
            {successRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">成功率</div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mt-6">
        <div className="mb-2 flex justify-between text-sm">
          <span>测试进度</span>
          <span>{summary.passed + summary.failed} / {summary.total}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-700">
          <div
            className="h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-300"
            style={{
              width: `${summary.total > 0 ? ((summary.passed + summary.failed) / summary.total) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* 详细信息 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">总耗时:</span>
          <span className="text-sm font-medium">
            {formatDuration(summary.duration)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">平均耗时:</span>
          <span className="text-sm font-medium">
            {summary.total > 0 ? formatDuration(summary.duration / summary.total) : '0ms'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">测试时间:</span>
          <span className="text-sm font-medium">
            {new Date(summary.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* 状态指示器 */}
      <div className="mt-6 flex items-center justify-center">
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
          isRunning
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
            : summary.failed === 0
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        )}>
          {isRunning ? (
            <>
              <div className="h-3 w-3 animate-spin border-b-2 border-current rounded-full"></div>
              测试进行中
            </>
          ) : summary.failed === 0 ? (
            <>
              <span>✅</span>
              所有测试通过
            </>
          ) : (
            <>
              <span>❌</span>
              {summary.failed} 个测试失败
            </>
          )}
        </div>
      </div>
    </Card>
  )
})

TestSummary.displayName = 'TestSummary'

export type TestSummaryProps = {
  /** 测试报告 */
  report: TestReport
  /** 是否正在运行 */
  isRunning?: boolean
} & React.HTMLAttributes<HTMLDivElement>

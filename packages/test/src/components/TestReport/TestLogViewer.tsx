/**
 * 测试日志查看器组件
 */

import { memo } from 'react'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { cn } from '@/utils'
import type { TestLogEntry } from '@/lib/test-modules'

export const TestLogViewer = memo<TestLogViewerProps>(({
  logs,
  onClear,
  maxHeight = 400,
  className,
}) => {
  const getLevelColor = (level: TestLogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'info':
      default:
        return 'text-blue-400'
    }
  }

  const getLevelIcon = (level: TestLogEntry['level']) => {
    switch (level) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">测试日志</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            共 {logs.length} 条日志
          </span>
          {onClear && (
            <Button onClick={onClear} designStyle="outlined" size="sm">
              清空日志
            </Button>
          )}
        </div>
      </div>

      <div
        className="overflow-y-auto rounded-lg bg-gray-900 p-4 text-sm font-mono"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            暂无日志，开始测试后将显示执行日志...
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-xs text-gray-500 shrink-0 w-20">
                  {log.timestamp}
                </span>
                <span className="shrink-0">
                  {getLevelIcon(log.level)}
                </span>
                <span className={cn('flex-1', getLevelColor(log.level))}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span>✅</span>
              <span>成功: {logs.filter(l => l.level === 'success').length}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>❌</span>
              <span>错误: {logs.filter(l => l.level === 'error').length}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>⚠️</span>
              <span>警告: {logs.filter(l => l.level === 'warning').length}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>ℹ️</span>
              <span>信息: {logs.filter(l => l.level === 'info').length}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
})

TestLogViewer.displayName = 'TestLogViewer'

export type TestLogViewerProps = {
  /** 日志列表 */
  logs: TestLogEntry[]
  /** 清空日志回调 */
  onClear?: () => void
  /** 最大高度 */
  maxHeight?: number
} & React.HTMLAttributes<HTMLDivElement>

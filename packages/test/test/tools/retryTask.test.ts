import { RetryError, retryTask } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('retryTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('应该在第一次尝试成功时返回结果', async () => {
    const task = vi.fn().mockResolvedValue('success')

    const result = await retryTask(task)

    expect(result).toBe('success')
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('应该在失败后重试', async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockRejectedValueOnce(new Error('second fail'))
      .mockResolvedValue('success')

    const result = await retryTask(task, 3)

    expect(result).toBe('success')
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('应该在所有重试失败后抛出 RetryError', async () => {
    const error = new Error('persistent error')
    const task = vi.fn().mockRejectedValue(error)

    await expect(retryTask(task, 2)).rejects.toThrow(RetryError)

    try {
      await retryTask(task, 2)
    }
    catch (e) {
      expect(e).toBeInstanceOf(RetryError)
      expect((e as RetryError).attempts).toBe(2)
      expect((e as RetryError).lastError).toBe(error)
      expect((e as RetryError).message).toContain('Task failed after 2 attempts')
    }

    expect(task).toHaveBeenCalledTimes(4) // 2 次调用 + 2 次调用
  })

  it('应该处理非 Error 类型的异常', async () => {
    const task = vi.fn().mockRejectedValue('string error')

    await expect(retryTask(task, 1)).rejects.toThrow(RetryError)

    try {
      await retryTask(task, 1)
    }
    catch (e) {
      expect((e as RetryError).lastError?.message).toBe('string error')
    }
  })

  it('应该使用默认重试次数 3', async () => {
    const task = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(retryTask(task)).rejects.toThrow(RetryError)
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('应该在重试间添加延迟', async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')

    const startTime = Date.now()
    await retryTask(task, 2, { delayMs: 100 })
    const endTime = Date.now()

    expect(endTime - startTime).toBeGreaterThanOrEqual(100)
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('应该确保最小重试次数为 1', async () => {
    const task = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(retryTask(task, 0)).rejects.toThrow(RetryError)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('应该记录重试日志', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')

    await retryTask(task, 2)

    expect(consoleSpy).toHaveBeenCalledWith('Attempt 1 failed for task. Retrying...')
  })
})

describe('retryError', () => {
  it('应该正确设置错误属性', () => {
    const lastError = new Error('original error')
    const retryError = new RetryError('retry failed', 3, lastError)

    expect(retryError.name).toBe('RetryError')
    expect(retryError.message).toBe('retry failed')
    expect(retryError.attempts).toBe(3)
    expect(retryError.lastError).toBe(lastError)
  })

  it('应该处理没有 lastError 的情况', () => {
    const retryError = new RetryError('retry failed', 2)

    expect(retryError.attempts).toBe(2)
    expect(retryError.lastError).toBeUndefined()
  })
})

import { concurrentTask } from '@jl-org/http'
import { describe, expect, it } from 'vitest'

describe('concurrentTask', () => {
  it('应该处理空任务数组', async () => {
    const result = await concurrentTask([])
    expect(result).toEqual([])
  })

  it('应该并发执行任务并保持顺序', async () => {
    const tasks = [
      () => new Promise(resolve => setTimeout(() => resolve('task1'), 100)),
      () => new Promise(resolve => setTimeout(() => resolve('task2'), 50)),
      () => new Promise(resolve => setTimeout(() => resolve('task3'), 75)),
    ]

    const results = await concurrentTask(tasks, 2)

    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'task1' })
    expect(results[1]).toEqual({ status: 'fulfilled', value: 'task2' })
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'task3' })
  })

  it('应该处理任务失败的情况', async () => {
    const tasks = [
      () => Promise.resolve('success'),
      () => Promise.reject(new Error('test error')),
      () => Promise.reject('string error'),
    ]

    const results = await concurrentTask(tasks)

    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'success' })
    expect(results[1]).toEqual({
      status: 'rejected',
      reason: expect.any(Error),
    })
    // @ts-ignore
    expect(results[1].reason.message).toBe('test error')
    expect(results[2]).toEqual({
      status: 'rejected',
      reason: expect.any(Error),
    })
    // @ts-ignore
    expect(results[2].reason.message).toBe('string error')
  })

  it('应该限制最大并发数', async () => {
    let runningCount = 0
    let maxRunning = 0

    const tasks = Array.from({ length: 10 }, (_, i) =>
      () => new Promise((resolve) => {
        runningCount++
        maxRunning = Math.max(maxRunning, runningCount)
        setTimeout(() => {
          runningCount--
          resolve(`task${i}`)
        }, 50)
      }))

    await concurrentTask(tasks, 3)
    expect(maxRunning).toBeLessThanOrEqual(3)
  })

  it('应该使用默认并发数 4', async () => {
    let runningCount = 0
    let maxRunning = 0

    const tasks = Array.from({ length: 8 }, (_, i) =>
      () => new Promise((resolve) => {
        runningCount++
        maxRunning = Math.max(maxRunning, runningCount)
        setTimeout(() => {
          runningCount--
          resolve(`task${i}`)
        }, 50)
      }))

    await concurrentTask(tasks)
    expect(maxRunning).toBeLessThanOrEqual(4)
  })
})

import { callbackToAsyncIterator } from '@jl-org/http'
import { describe, expect, it, vi } from 'vitest'

describe('callbackToAsyncIterator', () => {
  it('应该按顺序产出数据并在 null 时结束', async () => {
    const iterator = callbackToAsyncIterator<string>((cb) => {
      cb('a')
      cb('b')
      cb('c')
      cb(null)
    })

    const received: string[] = []
    for await (const v of iterator) {
      received.push(v)
    }

    expect(received).toEqual(['a', 'b', 'c'])
  })

  it('应该在订阅函数抛错时在 next() 处抛出', async () => {
    const err = new Error('subscribe error')
    const iterator = callbackToAsyncIterator<string>(() => {
      throw err
    })

    await expect(iterator.next()).rejects.toBe(err)
  })

  it('调用 return() 应该触发清理函数', async () => {
    const cleanup = vi.fn()
    const iterator = callbackToAsyncIterator<string>((cb) => {
      cb('x')
      return cleanup
    })

    // 读一个值以确保已订阅
    const first = await iterator.next()
    expect(first).toEqual({ done: false, value: 'x' })

    // 主动结束迭代
    const doneRes = await iterator.return?.()
    expect(doneRes).toEqual({ done: true, value: undefined })
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('调用 throw(e) 应该触发清理并抛出', async () => {
    const cleanup = vi.fn()
    const iterator = callbackToAsyncIterator<string>(() => cleanup)
    await expect(iterator.throw?.(new Error('stop'))).rejects.toThrow('stop')
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})



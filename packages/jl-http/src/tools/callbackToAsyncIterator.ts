/**
 * 回调转异步迭代器
 * @template T 数据类型
 * @param subscribeFn 订阅函数，接收一个回调函数作为参数，返回取消订阅函数
 * @returns 异步迭代器
 *
 * @example
 * ```ts
 * const iterator = callbackToAsyncIterator<string>((callback) => {
 *   const timer = setInterval(() => callback('data'), 1000);
 *   return () => clearInterval(timer);
 * });
 *
 * for await (const data of iterator) {
 *   console.log(data);
 * }
 * ```
 */
export function callbackToAsyncIterator<T>(
  subscribeFn: (callback: (data: T | null) => void) => (() => void) | void,
): AsyncIterableIterator<T> {
  let buffer: T[] = []
  let resolve: ((value: IteratorResult<T>) => void) | null = null
  let reject: ((error: any) => void) | null = null
  let isComplete = false
  let unsubscribe: (() => void) | null = null
  let error: any = null

  /** 订阅回调 */
  try {
    const cleanup = subscribeFn((data) => {
      if (data === null) {
        /** 结束信号 */
        isComplete = true
        if (resolve) {
          resolve({ done: true, value: undefined })
          resolve = null
          reject = null
        }
      }
      else {
        /** 有数据 */
        if (resolve) {
          /** 如果有等待的 Promise，直接 resolve */
          resolve({ done: false, value: data })
          resolve = null
          reject = null
        }
        else {
          /** 否则放入缓冲区 */
          buffer.push(data)
        }
      }
    })

    unsubscribe = cleanup || null
  }
  catch (err) {
    error = err
    isComplete = true
  }

  return {
    [Symbol.asyncIterator]() {
      return this
    },
    next(): Promise<IteratorResult<T>> {
      return new Promise((res, rej) => {
        /** 如果有错误，直接拒绝 */
        if (error) {
          rej(error)
          return
        }

        if (buffer.length > 0) {
          /** 如果缓冲区有数据，直接返回 */
          res({ done: false, value: buffer.shift()! })
        }
        else if (isComplete) {
          /** 如果已完成，返回 done */
          res({ done: true, value: undefined })
        }
        else {
          /** 等待下一个数据 */
          resolve = res
          reject = rej
        }
      })
    },
    async return(): Promise<IteratorResult<T>> {
      /** 清理资源 */
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      isComplete = true
      buffer = []
      return { done: true, value: undefined }
    },
    async throw(e?: any): Promise<IteratorResult<T>> {
      /** 抛出异常并清理资源 */
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      isComplete = true
      buffer = []
      error = e
      throw e
    },
  }
}

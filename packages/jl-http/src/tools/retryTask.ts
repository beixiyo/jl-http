import { wait } from '@/tools/tool'

export class RetryError extends Error {
  public readonly attempts: number
  public readonly lastError?: Error

  constructor(message: string, attempts: number, lastError?: Error) {
    super(message)
    this.name = 'RetryError'
    this.attempts = attempts
    this.lastError = lastError
  }
}

/**
 * 失败后自动重试异步任务。
 * @param task 要执行的异步任务函数，该函数应返回一个 Promise。
 * @param maxAttempts 最大尝试次数（包括首次尝试）。默认为 3。
 * @returns 返回任务成功的结果 Promise。如果所有尝试都失败，则 reject 一个 RetryError。
 */
export async function retryTask<T>(
  task: () => Promise<T>,
  maxAttempts = 3,
  opts: RetryTaskOpts = {},
): Promise<T> {
  const { delayMs = 0, onRetry, shouldRetry = () => true } = opts
  let attempts = 0
  let lastError: Error | undefined
  maxAttempts = Math.max(maxAttempts, 1)

  while (attempts < maxAttempts) {
    attempts++
    try {
      const res = await task()
      return res
    }
    catch (error) {
      lastError = error instanceof Error
        ? error
        : new Error(String(error))

      const context = {
        attempt: attempts,
        maxAttempts,
        error,
      }
      if (attempts >= maxAttempts || !shouldRetry(context)) {
        /** 所有尝试已用尽，抛出最终错误 */
        throw new RetryError(
          `Task failed after ${attempts} attempts. Last error: ${lastError.message}`,
          attempts,
          lastError,
        )
      }
      /** 如果还有重试机会，并且设置了延迟 */
      const retryDelay = typeof delayMs === 'function'
        ? delayMs(context)
        : delayMs
      onRetry?.(context)
      if (retryDelay > 0) {
        await wait(retryDelay)
      }
    }
  }

  /**
   * 理论上不应该执行到这里，因为循环内要么成功返回，要么在最后一次尝试失败后抛出错误
   * 但为了类型安全和逻辑完整性，如果意外到达这里，也抛出一个错误
   */
  throw new RetryError(
    `Task failed unexpectedly after ${attempts} attempts. Should not happen.`,
    attempts,
    lastError,
  )
}

export type RetryTaskOpts = {
  /**
   * 重试任务的延迟时间
   */
  delayMs?: number | ((context: RetryContext) => number)
  /** 返回 false 时立即停止重试并抛出 RetryError */
  shouldRetry?: (context: RetryContext) => boolean
  /** 下一次尝试开始前调用 */
  onRetry?: (context: RetryContext) => void
}

export type RetryContext = {
  /** 刚刚失败的尝试序号，从 1 开始 */
  attempt: number
  /** 包含首次请求在内的最大尝试次数 */
  maxAttempts: number
  error: unknown
}

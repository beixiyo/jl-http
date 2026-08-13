/**
 * HTTP 请求过程中可由调用方识别和处理的错误类型
 */

/** 单次请求超时；与外部主动取消分开，允许调用方选择是否重试 */
export class RequestTimeoutError extends Error {
  readonly code = 408

  constructor(readonly url: string, readonly timeoutMs: number) {
    super(`${url} 请求超时（Request Timeout）`)
    this.name = 'RequestTimeoutError'
  }
}

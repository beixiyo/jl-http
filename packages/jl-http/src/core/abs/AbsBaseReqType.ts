import type { SSEParserOptions } from '@/core/sse/SSEParser'
import type { SSEStream, SSETransportActivity } from '@/core/sse/types'
import type { RetryTaskOpts } from '@/tools/retryTask'
import type { FetchType, HttpMethod, ReqBody, ReqHeaders } from '@/types'

/**
 * 请求基础接口
 */
export interface BaseHttpReq {

  get: <T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig) => Promise<HttpResponse>
  head: <T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig) => Promise<HttpResponse>

  delete: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig) => Promise<HttpResponse>
  options: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig) => Promise<HttpResponse>

  post: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig) => Promise<HttpResponse>
  put: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig) => Promise<HttpResponse>
  patch: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig) => Promise<HttpResponse>

  fetchSSE: <T = unknown>(url: string, config?: SSEOptions<T>) => Promise<SSEStream<T>>
}

export type FetchOptions = Omit<RequestInit, 'method'> & {
  method?: HttpMethod
}

export type BaseReqConfig =
  Omit<FetchOptions, 'body'>
  & BaseReqConstructorConfig
  & {
    /**
     * 返回类型，默认 json
     * 如果设置为 stream，会返回一个 ReadableStream
     */
    respType?: FetchType
    url: string
    /**
     * 基路径，传入后比实例化时的 baseUrl 优先级高
     * @default ''
     */
    baseUrl?: string
    /**
     * 请求超时时间，默认 `10秒`，单位 `ms`。传入 `-1` 则不超时
     * @default 10000
     */
    timeout?: number
    query?: Record<string, any>
    body?: ReqBody
    /**
     * 重试请求次数
     * @default 0
     */
    retry?: number | RetryRequestOptions
    /**
     * 请求进度回调函数，接收进度百分比值（0-1）
     * 如果无法计算进度（如服务器未返回 content-length），则传递 -1
     */
    onProgress?: (progress: number) => void
  }

export type BaseReqMethodConfig = Omit<BaseReqConfig, 'url'>

/** 请求重试策略；maxAttempts 包含首次请求 */
export type RetryRequestOptions = RetryTaskOpts & {
  /**
   * 包含首次请求在内的最大尝试次数
   * @default 1
   */
  maxAttempts: number
}

/** `fetchSSE` 的请求、解析与生命周期选项。 */
export type SSEOptions<T = unknown> = SSEParserOptions & {
  /**
   * 转换一条已经完整提交的 SSE data 事件
   *
   * 默认使用 `JSON.parse`。需要原始文本时显式传入 `dataText => dataText`。回调可以
   * 异步执行，在 Promise settle 前不会读取下一条事件
   * @default JSON.parse
   */
  parseData?: (dataText: string) => T | Promise<T>
  /**
   * 每当响应体读取到非空字节块时触发
   *
   * 该回调不要求字节已组成完整 SSE 帧，适合刷新空闲超时；包括注释心跳在内的任意字节都会触发
   */
  onActivity?: (activity: SSETransportActivity) => void
  /**
   * 是否要求成功响应的 Content-Type 为 `text/event-stream`
   * @default true
   */
  validateContentType?: boolean
}
& Omit<BaseReqConfig, 'url' | 'retry' | 'respType' | 'timeout' | 'onProgress'>

export interface BaseReqConstructorConfig {
  /**
   * 基路径
   * @default ''
   */
  baseUrl?: string
  headers?: ReqHeaders
  /**
   * 请求超时时间，默认 10 秒
   * @default 10000
   */
  timeout?: number
  /**
   * 重试请求次数
   * @default 0
   */
  retry?: number | RetryRequestOptions
  /**
   * 请求进度回调函数，接收进度百分比值（0-1）
   * 如果无法计算进度（如服务器未返回 content-length），则传递 -1
   */
  onProgress?: (progress: number) => void
  /** 请求拦截 */
  reqInterceptor?: (config: Omit<BaseReqConfig, 'headers'> & { headers: any }) => any
  /** 响应拦截 */
  respInterceptor?: RespInterceptor
  /**
   * 错误拦截
   *
   * 普通 HTTP 请求仅在非 2xx 响应时触发，网络错误 / 超时不经过此拦截器；
   * SSE 请求还会在建连、响应校验或读取流失败时触发，并通过错误上下文标明阶段
   *
   * 普通 HTTP 路径与 {@link RespInterceptor} 对称，返回值会被消费：
   * - 返回非 `undefined` 值 → 作为本次请求的 resolve 值（错误恢复，如刷新 token 后透明重放）
   * - 抛出 / 返回 rejected Promise → 本次请求以该错误 reject（可改写错误对象）
   * - 返回 `undefined`（纯副作用，含未显式 return 的 async）→ 以原始 fetch `Response` reject
   *
   * SSE 是增量流，不能用一个返回值替代后续事件。SSE 路径只响应显式 `reopen()`；
   * 未调用时继续抛出原错误，拦截器自身抛错时则抛出该错误
   */
  respErrInterceptor?: RespErrInterceptor
  /** Fetch 配置选项，优先级最低 */
  fetchOption?: FetchOptions
}

/** 响应错误拦截器收到的请求与恢复上下文 */
export type RespErrInterceptorError = {
  /**
   * fetch 返回的原始 Response
   */
  rawResp: Response
  /**
   * 请求时使用的最终配置只读视图
   *
   * 需要调整重新建连的物理请求时，使用 `reopen({ request })`，不要直接修改该对象
   */
  request: Readonly<BaseReqConfig>
  /**
   * 原始错误对象（可能是 Response 或其它错误）
   */
  error: any
  /**
   * 发生错误的传输类型
   *
   * 旧请求路径可能不提供该字段，调用方应保留兼容分支
   */
  transport?: 'http' | 'sse'
  /**
   * 发生错误的生命周期阶段
   *
   * `request` 表示建连失败，`response` 表示响应不合法，`stream` 表示读取响应体失败
   */
  phase?: 'request' | 'response' | 'stream'
  /**
   * 重新打开当前 SSE 逻辑流的物理连接
   *
   * SSE 请求会提供该函数。调用后只登记重新打开请求；错误拦截器完成后，执行器才会
   * 重新执行请求拦截器并打开新的物理连接。它不会回放已经收到的响应或事件
   */
  reopen?: (options?: SSEReopenOptions) => Promise<void>
}

/**
 * 错误拦截器
 *
 * 普通 HTTP 路径会消费返回值；SSE 路径忽略返回值，只通过载荷中的 `reopen()` 重新建连
 * 详见 {@link BaseReqConstructorConfig.respErrInterceptor}
 */
export type RespErrInterceptor = (error: RespErrInterceptorError) => any

/** `reopen()` 的显式物理请求调整。 */
export interface SSEReopenOptions {
  /**
   * 当前逻辑流在重新建连时使用的请求参数覆盖
   *
   * 省略时完整沿用当前请求。`headers` 和 `query` 与当前值合并，其余字段覆盖；覆盖会
   * 保留到该逻辑流后续的物理连接。解析规则、拦截器和 AbortSignal 属于逻辑流生命周期，
   * 不能在重新建连时替换
   *
   * @default undefined
   */
  request?: SSEReopenRequestOverrides
}

/** `reopen()` 允许修改的物理请求参数。 */
export type SSEReopenRequestOverrides = Partial<Omit<
  BaseReqConfig,
  | 'baseUrl'
  | 'fetchOption'
  | 'onProgress'
  | 'reqInterceptor'
  | 'respErrInterceptor'
  | 'respInterceptor'
  | 'respType'
  | 'retry'
  | 'signal'
  | 'timeout'
>>

export interface Resp<T> {
  /** fetch 返回的原始对象 */
  rawResp: Response
  /** 后端返回的数据 */
  data: T
  /** 如果 respType = stream，则返回一个可读流 */
  reader?: ReadableStreamDefaultReader<Uint8Array>
  /** 请求时使用的最终配置 */
  request: BaseReqConfig
}

export type RespInterceptor<T = Resp<any>> = (resp: T) => T | Promise<T>

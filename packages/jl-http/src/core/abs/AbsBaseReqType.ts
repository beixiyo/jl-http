import type { SSEStreamProcessorConfig } from '@/tools/SSEStreamProcessor'
import type { FetchType, HttpMethod, ReqBody, ReqHeaders, SSEData } from '@/types'

/**
 * 请求基础接口
 */
export interface BaseHttpReq {

  get: <T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig) => Promise<HttpResponse>
  head: <T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig) => Promise<HttpResponse>

  delete: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig) => Promise<HttpResponse>
  options: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig) => Promise<HttpResponse>

  post: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig) => Promise<HttpResponse>
  put: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig) => Promise<HttpResponse>
  patch: <T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig) => Promise<HttpResponse>

  fetchSSE: (url: string, config?: SSEOptions) => Promise<FetchSSEReturn>
}

export type FetchOptions = Omit<RequestInit, 'method'> & {
  method?: HttpMethod
}

export type FetchSSEReturn = {
  cancel: () => void
  promise: Promise<SSEData>
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
    retry?: number
    /**
     * 请求进度回调函数，接收进度百分比值（0-1）
     * 如果无法计算进度（如服务器未返回 content-length），则传递 -1
     */
    onProgress?: (progress: number) => void
  }

export type BaseReqMethodConfig = Omit<BaseReqConfig, 'url'>

export type SSEOptions = {
  /**
   * 每次都会拿到之前到现在累加的所有内容
   */
  onMessage?: (data: SSEData) => void
  /**
   * 原始 SSE 数据，按照数组分段存储，较好处理
   */
  onRawMessage?: (data: {
    /** 当前原始 SSE 拼接的数据，未经过任何处理 */
    currentRawSSEData: string[]
    /** 累积原始 SSE 拼接的数据，未经过任何处理 */
    allRawSSEData: string[]
  }) => void
  /**
   * 处理数据的自定义函数，用于对提取的数据进行进一步处理
   */
  handleData?: SSEStreamProcessorConfig['handleData']

  /**
   * 计算进度，接口必须有 content-length 响应头
   */
  onProgress?: (progress: number) => void
  onError?: (error: any) => void

  /**
   * 是否解析 SSE 数据，删除 data: 内容
   * @default true
   */
  needParseData?: boolean
  /**
   * 是否解析 JSON，开启后，会解析出 JSON 对象，放入 onMessage 回调
   * @default true
   */
  needParseJSON?: boolean

  /**
   * 以什么作为分隔符切割
   * @default '\n\n'
   */
  separator?: SSEStreamProcessorConfig['separator']
  /**
   * 以什么作为数据前缀
   * @default 'data:'
   */
  dataPrefix?: SSEStreamProcessorConfig['dataPrefix']

  /**
   * 以什么作为结束信号
   * @default '[DONE]'
   */
  doneSignal?: SSEStreamProcessorConfig['doneSignal']
  /**
   * 是否忽略无效数据前缀 (如不以 dataPrefix(data: 开头))。
   * 通常用来忽略事件名，如 event:xxx。
   * @default true
   */
  ignoreInvalidDataPrefix?: boolean
}
& Omit<BaseReqConfig, 'url' | 'retry' | 'respType' | 'timeout'>

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
  retry?: number
  /**
   * 请求进度回调函数，接收进度百分比值（0-1）
   * 如果无法计算进度（如服务器未返回 content-length），则传递 -1
   */
  onProgress?: (progress: number) => void
  /** 请求拦截 */
  reqInterceptor?: (config: Omit<BaseReqConfig, 'headers'> & { headers: any }) => any
  /** 响应拦截 */
  respInterceptor?: (resp: Resp<any>) => any
  /** 错误拦截 */
  respErrInterceptor?: (error: RespErrInterceptorError) => any
}

export type RespErrInterceptorError = {
  url: string
  method: HttpMethod
  body: any
  query: Record<string, any>
  headers: Record<string, any>
  error: any
}

export interface Resp<T> {
  /** fetch 返回的原始对象 */
  rawResp: Response
  /** 后端返回的数据 */
  data: T
  /** 如果 respType = stream，则返回一个可读流 */
  reader?: ReadableStreamDefaultReader<Uint8Array>
}

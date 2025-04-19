import type { FetchType, HttpMethod, ReqBody, ReqHeaders } from '../../types'


/**
 * 请求基础接口
 */
export interface BaseHttpReq {

  get<T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig): Promise<HttpResponse>
  head<T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig): Promise<HttpResponse>

  delete<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>
  options<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>

  post<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>
  put<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>
  patch<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>

  fetchSSE(url: string, config?: SSEOptions): Promise<string>
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
    retry?: number
  }

export type BaseReqMethodConfig = Omit<BaseReqConfig, 'url'>

export type SSEOptions = {
  /**
   * 每次都会拿到之前到现在累加的所有内容
   */
  onMessage?: (content: string) => void
  /**
   * 计算进度，接口必须有 content-length 响应头
   */
  onProgress?: (progress: number, content: string) => void
  onError?: (error: any) => void

  /**
   * 是否解析数据，删除 data: 内容
   * 开启的话，会解析出 [...] 字符串，可用作 JSON 解析
   * @default true
   */
  needParseData?: boolean
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
  /** 请求拦截 */
  reqInterceptor?: (config: Omit<BaseReqConfig, 'headers'> & { headers: any }) => any
  /** 响应拦截 */
  respInterceptor?: (resp: Resp<any>) => any
  /** 错误拦截 */
  respErrInterceptor?: (err: any) => any
}

export interface Resp<T> {
  /** fetch 返回的原始对象 */
  rawResp: Response
  /** 后端返回的数据 */
  data: T
  /** 如果 respType = stream，则返回一个可读流 */
  reader?: ReadableStreamDefaultReader<Uint8Array>
}

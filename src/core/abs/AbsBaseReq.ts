import type { FetchType, HttpMethod, ReqBody, ReqHeaders } from '../../types'


/** 请求基础接口 */
export interface BaseHttpReq {
    get<T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig): Promise<HttpResponse>
    head<T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig): Promise<HttpResponse>

    delete<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>
    options<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>

    post<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>
    put<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>
    patch<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse>
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
         * 请求超时时间，默认 10 秒 
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
    reqInterceptor?: (config: BaseReqMethodConfig) => any
    /** 响应拦截 */
    respInterceptor?: <T = any>(resp: Resp<T>) => any
    /** 错误拦截 */
    respErrInterceptor?: <T = any>(err: T) => any
}

export interface Resp<T> {
    /** fetch 返回的原始对象 */
    rawResp: Response
    /** 后端返回的数据 */
    data: T
    /** 如果 respType = stream，则返回一个可读流 */
    reader?: ReadableStreamDefaultReader<Uint8Array>
}

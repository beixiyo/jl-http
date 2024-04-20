import type { FetchType, HttpMethod, ReqBody, ReqHeaders } from '../../types'


/** 请求基类 */
export abstract class AbsBaseReq implements BaseHttpReq {

    abstract request<T>(config: BaseReqConfig): Promise<Resp<T>>

    abstract get<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>>
    abstract delete<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>>
    abstract head<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>>
    abstract options<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>>

    abstract post<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>>
    abstract put<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>>
    abstract patch<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>>

}

export interface BaseHttpReq {
    get<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>>
    delete<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>>
    head<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>>
    options<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>>

    post<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>>
    put<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>>
    patch<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>>
}


export type FetchOptions = Omit<RequestInit, 'method'> & {
    method?: HttpMethod
}

export interface BaseReqConfig extends FetchOptions {
    /** 返回类型，默认 json。如果设置为 stream，会返回一个 ReadableStream */
    respType?: FetchType
    url: string
    /** 基路径，传入后比实例化时的 baseUrl 优先级高 */
    baseUrl?: string
    /** 请求超时时间，默认 10 秒 */
    timeout?: number
    /** 是否终止请求，你也可以自己传递 signal 控制 */
    abort?: () => boolean
    query?: Record<string, any>
}

export type BaseReqMethodConfig = Omit<BaseReqConfig, 'url'>

export interface BaseReqConstructorConfig {
    /** 默认配置，可在方法中覆盖 */
    defaultConfig?: {
        /** 基路径 */
        baseUrl?: string
        headers?: ReqHeaders
        /** 请求超时时间，默认 10 秒 */
        timeout?: number
    }
    /** 拦截器 */
    interceptor?: {
        /** 请求拦截 */
        reqInterceptor?: (config: BaseReqMethodConfig) => any
        /** 响应拦截 */
        respInterceptor?: <T = any>(resp: Resp<T>) => any
        /** 错误拦截 */
        respErrInterceptor?: <T = any>(err: any) => any
    }
}

export interface Resp<T> {
    /** fetch 返回的原始对象 */
    rawResp: Response
    /** 后端返回的数据 */
    data: T
    /** 如果 respType = stream，则返回一个可读流 */
    reader?: ReadableStreamDefaultReader<Uint8Array>
}

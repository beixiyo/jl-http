import type { BaseReqConstructorConfig, BaseReqConfig, BaseReqMethodConfig, Resp, BaseHttpReq } from './abs/AbsBaseReq'
import { TIME_OUT } from '../constants'
import type { HttpMethod, ReqBody, RespData } from '../types'
import { getType, retryReq } from '../tools'
import qs from 'query-string'


export class BaseReq implements BaseHttpReq {

    constructor(private defaultConfig: BaseReqConstructorConfig = {}) { }

    async request<T, HttpResponse = Resp<T>>(config: BaseReqConfig): Promise<HttpResponse> {
        const {
            url: _url,
            timeout,
            respType,
            retry,
            ...rest
        } = this.normalizeOpts(config)

        const {
            reqInterceptor,
            respInterceptor,
            respErrInterceptor,
        } = this.getInterceptor<HttpResponse>(config)

        const { data, url } = await getReqConfig(rest, reqInterceptor, rest.method, _url)

        return new Promise((resolve, reject) => {
            const abort = new AbortController()
            const reason: RespData = {
                msg: '请求超时（Request Timeout）',
                code: 408
            }

            if (rest.signal) {
                rest.signal.addEventListener('abort', () => {
                    abort.abort()
                })
            }

            setTimeout(() => {
                reject(reason)
                abort.abort(reason)
            }, timeout)

            const res = retry >= 1
                ? retryReq<HttpResponse>(() => _req(abort.signal), retry)
                : _req(abort.signal)
            resolve(res)
        })


        function _req(signal: AbortSignal) {
            return fetch(url, {
                ...data,
                signal: rest.signal || signal
            })
                .then(async (response) => {
                    if (hasHttpErr(response.status)) {
                        respErrInterceptor?.(response)
                        return Promise.reject(response)
                    }

                    let res: Resp<T>
                    if (respType === 'stream') {
                        const reader = response.body?.getReader()

                        res = {
                            rawResp: response,
                            data: null as T,
                            reader,
                        }
                    }
                    else {
                        const data = await response[respType]()
                        res = {
                            rawResp: response,
                            data,
                        }
                    }

                    return await respInterceptor(res as any)
                })
        }
    }

    // ======================= 请求方法 =======================

    get<T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig): Promise<HttpResponse> {
        return this.request({ url, method: 'GET', ...config })
    }

    head<T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig): Promise<HttpResponse> {
        return this.request({ url, method: 'HEAD', ...config })
    }


    delete<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse> {
        return this.request({ url, method: 'DELETE', body: data, ...config })
    }

    options<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse> {
        return this.request({ url, method: 'OPTIONS', body: data, ...config })
    }

    post<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse> {
        return this.request({ url, method: 'POST', body: data, ...config })
    }

    put<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse> {
        return this.request({ url, method: 'PUT', body: data, ...config })
    }

    patch<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody, config?: BaseReqMethodConfig): Promise<HttpResponse> {
        return this.request({ url, method: 'PATCH', body: data, ...config })
    }

    private normalizeOpts(config: BaseReqConfig) {
        const {
            respType = 'json',
            method = 'GET',
        } = config

        const defaultConfig = this.defaultConfig || {}

        return {
            respType,
            method,
            headers: config.headers || defaultConfig.headers || {},
            timeout: config.timeout || defaultConfig.timeout || TIME_OUT,
            signal: config.signal,
            retry: defaultConfig.retry ?? config.retry ?? 0,
            ...config,
            url: (defaultConfig.baseUrl || config.baseUrl || '') + config.url,
        } as Required<BaseReqConfig>
    }

    private getInterceptor<T>(config: BaseReqConfig) {
        let reqInterceptor = async (config: BaseReqMethodConfig) => config,
            respInterceptor = async (config: T) => config,
            respErrInterceptor: any = () => { }

        const defaultConfig = this.defaultConfig
        if (defaultConfig.reqInterceptor) {
            reqInterceptor = defaultConfig.reqInterceptor
        }
        if (defaultConfig.respInterceptor) {
            respInterceptor = defaultConfig.respInterceptor as any
        }
        if (defaultConfig.respErrInterceptor) {
            respErrInterceptor = defaultConfig.respErrInterceptor
        }

        if (config.reqInterceptor) {
            reqInterceptor = config.reqInterceptor
        }
        if (config.respInterceptor) {
            respInterceptor = config.respInterceptor as any
        }
        if (config.respErrInterceptor) {
            respErrInterceptor = config.respErrInterceptor
        }

        return {
            reqInterceptor,
            respInterceptor,
            respErrInterceptor,
        }
    }
}


function parseBody(data: any) {
    if (getType(data) === 'object') {
        return {
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }

    return {
        body: data
    }
}

/**
 * 获取请求拦截器过滤后的数据
 */
async function getReqConfig(
    config: BaseReqMethodConfig,
    reqInterceptor: Function,
    method: HttpMethod,
    url: string
) {
    const query = qs.stringify(config.query || {})

    /**
     * 这俩请求方法没有 body
     */
    if (['GET', 'HEAD'].includes(method.toUpperCase())) {
        const data = await reqInterceptor(config)
        return {
            data,
            url: query
                ? `${url}?${query}`
                : url
        }
    }

    const data = await reqInterceptor({
        ...config,
        ...parseBody(config.body)
    })
    
    return {
        data,
        url: query
            ? `${url}?${query}`
            : url
    }
}

function hasHttpErr(code: string | number) {
    return +code >= 400
}
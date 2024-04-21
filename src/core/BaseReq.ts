import type { BaseReqConstructorConfig, BaseReqConfig, BaseReqMethodConfig, Resp, BaseHttpReq } from './abs/AbsBaseReq'
import { TIME_OUT } from '../constants'
import type { HttpMethod, ReqBody } from '../types'
import { isObj, retryReq } from '../tools'
import qs from 'query-string'


export class BaseReq implements BaseHttpReq {

    constructor(private config?: BaseReqConstructorConfig) { }

    async request<T, HttpResponse = Resp<T>>(config: BaseReqConfig): Promise<HttpResponse> {
        const {
            url: _url,
            timeout,
            respType,
            controller,
            retry,
            ...rest
        } = this.normalizeOpts(config)

        let id = setTimeout(() => {
            return Promise.reject({
                msg: '请求超时',
                status: 408
            })
        }, timeout)

        const {
            reqInterceptor = async (config: BaseReqMethodConfig) => config,
            respInterceptor = async (config: Resp<any>) => config,
            respErrInterceptor,
        } = this.config || {}

        const { data, url } = await getReqConfig(rest, reqInterceptor, rest.method, _url)
        const res = retryReq<HttpResponse>(_req, retry)

        if (data.abort?.()) controller.abort()
        return res


        function _req() {
            return fetch(url, data)
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

                    return await respInterceptor(res)
                })
                .catch(err => {
                    respErrInterceptor?.(err)
                    return Promise.reject(err)
                })
                .finally(() => clearTimeout(id))
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
        const controller = new AbortController()
        const {
            respType = 'json',
            method = 'GET',
        } = config

        const defaultConfig = this.config || {}

        return {
            respType,
            method,
            headers: config.headers || defaultConfig.headers || {},
            timeout: config.timeout || defaultConfig.timeout || TIME_OUT,
            signal: controller.signal,
            controller,
            retry: defaultConfig.retry ?? config.retry ?? 0,
            ...config,
            url: (defaultConfig.baseUrl || config.baseUrl || '') + config.url,
        }
    }
}


function parseBody(data: any) {
    if (isObj(data)) {
        return JSON.stringify(data)
    }
    return '{}'
}

async function getReqConfig(
    config: BaseReqMethodConfig,
    reqInterceptor: Function,
    method: HttpMethod,
    url: string
) {
    const query = qs.stringify(config.query || {})

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
        body: parseBody(config.body)
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
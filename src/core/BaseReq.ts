import { AbsBaseReq, type BaseReqConstructorConfig, type BaseReqConfig, type BaseReqMethodConfig, type Resp } from './abs/AbsBaseReq'
import { TIME_OUT } from '../constants'
import type { HttpMethod, ReqBody } from '../types'
import { isObj } from '../tools'
import qs from 'query-string'


export class BaseReq extends AbsBaseReq {

    constructor(private config?: BaseReqConstructorConfig) {
        super()
    }

    async request<T>(config: BaseReqConfig): Promise<Resp<T>> {
        const {
            url: _url,
            timeout,
            respType,
            controller,
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
        } = this.config?.interceptor || {}

        const { data, url } = await getReqConfig(rest, reqInterceptor, rest.method, _url)
        const res = fetch(url, data)
            .then(async (response) => {
                if (hasHttpErr(response.status)) {
                    return respErrInterceptor?.(response)
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
            .catch(respErrInterceptor)
            .finally(() => clearTimeout(id))

        if (data.abort?.()) controller.abort()
        return res
    }

    // ======================= 请求方法 =======================

    get<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.request({ url, method: 'GET', ...config })
    }

    delete<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.request({ url, method: 'DELETE', ...config })
    }

    head<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.request({ url, method: 'HEAD', ...config })
    }

    options<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.request({ url, method: 'OPTIONS', ...config })
    }

    post<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.request({ url, method: 'POST', body: data, ...config })
    }

    put<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.request({ url, method: 'PUT', body: data, ...config })
    }

    patch<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.request({ url, method: 'PATCH', body: data, ...config })
    }

    private normalizeOpts(config: BaseReqConfig) {
        const controller = new AbortController()
        const {
            respType = 'json',
            method = 'GET',
        } = config

        const defaultConfig = this.config?.defaultConfig || {}

        return {
            respType,
            method,
            headers: config.headers || defaultConfig.headers || {},
            timeout: config.timeout || defaultConfig.timeout || TIME_OUT,
            signal: controller.signal,
            controller,
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
            url: `${url}?${query}`
        }
    }

    const data = await reqInterceptor({
        ...config,
        body: parseBody(config.body)
    })
    return {
        data,
        url: `${url}?${query}`
    }
}

function hasHttpErr(code: string | number) {
    return +code >= 300
}
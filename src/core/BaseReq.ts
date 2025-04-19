import type { BaseReqConstructorConfig, BaseReqConfig, BaseReqMethodConfig, Resp, BaseHttpReq, SSEOptions } from './abs/AbsBaseReqType'
import { TIME_OUT } from '../constants'
import type { HttpMethod, ReqBody, RespData } from '../types'
import { getType, retryReq } from '../tools'
import qs from 'query-string'


export class BaseReq implements BaseHttpReq {

  constructor(private defaultConfig: BaseReqConstructorConfig = {}) { }

  async request<T, HttpResponse = Resp<T>>(config: BaseReqConfig): Promise<HttpResponse> {
    const formatConfig = this.normalizeOpts(config)
    const {
      url: withPrefixUrl,
      timeout,
      respType,
      retry,
      ...rest
    } = formatConfig

    const {
      reqInterceptor,
      respInterceptor,
      respErrInterceptor,
    } = this.getInterceptor<HttpResponse>(config)

    const { data, url } = await getReqConfig(formatConfig, reqInterceptor, rest.method, withPrefixUrl)

    return new Promise((resolve, reject) => {
      const abort = new AbortController()
      const reason: RespData = {
        msg: `${url} 请求超时（Request Timeout）`,
        code: 408
      }

      if (rest.signal) {
        rest.signal.addEventListener('abort', () => {
          abort.abort()
        })
      }

      if (timeout > 0) {
        setTimeout(() => {
          reject(reason)
          abort.abort(reason)
        }, timeout)
      }

      const res = retry >= 1
        ? retryReq<HttpResponse>(() => _req(abort.signal), retry)
        : _req(abort.signal)
      resolve(res)
    })


    async function _req(signal: AbortSignal) {
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

  /**
   * SSE 请求，默认使用 GET
   */
  async fetchSSE(url: string, config?: SSEOptions): Promise<string> {
    const formatConfig = this.normalizeSSEOpts(url, config)
    const {
      url: withPrefixUrl,
      needParseData,
      onError,
      onMessage,
      onProgress,
      ...rest
    } = formatConfig
    const { promise, reject, resolve } = Promise.withResolvers<string>()

    const {
      reqInterceptor,
      respErrInterceptor,
    } = this.getInterceptor(formatConfig)
    const { data, url: withQueryUrl } = await getReqConfig(formatConfig, reqInterceptor, rest.method, withPrefixUrl)

    try {
      const resp = await fetch(
        withQueryUrl,
        data
      )

      if (!resp.ok) {
        const error = new Error(`HTTP error! status: ${resp.status}`)
        onError?.(error)
        reject(error)
        return promise
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      const total = resp.headers.get('content-length')
        ? Number(resp.headers.get('content-length'))
        : 0

      let content = ''
      let loaded = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          resolve(content)
          break
        }

        loaded += value.length
        content += needParseData
          ? BaseReq.parseSSEContent(decoder.decode(value))
          : decoder.decode(value)
        onMessage?.(content)

        const progress = loaded / total
        onProgress?.(
          progress > 0
            ? progress
            : -1,
          content
        )
      }
    }
    catch (error) {
      onError?.(error)
      reject(error)
      respErrInterceptor(error)
    }

    return promise
  }

  static parseSSEContent(content: string) {
    const matches = content.match(/data:([\s\S]*?)(?=\ndata:|$)/g)
    if (!matches)
      return '[]'

    const json = matches
      .filter(item => item.startsWith('data:{'))
      .map(item => item
        .replace(/^data:/, '')
        .replace(/\n/g, ''),
      )
      .join(',')

    return `[${json}]`
  }

  private normalizeOpts(config: BaseReqConfig) {
    const {
      respType = 'json',
      method = 'GET',
    } = config

    const defaultConfig = this.defaultConfig || {}

    const finalConfig = {
      respType,
      method,
      headers: config.headers || defaultConfig.headers || {},
      timeout: config.timeout || defaultConfig.timeout || TIME_OUT,
      signal: config.signal,
      retry: defaultConfig.retry ?? config.retry ?? 0,
      ...config,
      url: (defaultConfig.baseUrl || config.baseUrl || '') + config.url,
    }

    return finalConfig
  }

  private normalizeSSEOpts(url: string, config: SSEOptions = {}) {
    const defaultConfig = this.defaultConfig || {}
    const {
      method = 'GET',
    } = config

    const headers = {
      'Accept': 'text/event-stream',
      ...(config.headers || defaultConfig.headers || {})
    }
    if (method === 'POST') {
      // @ts-ignore
      headers['Content-Type'] = 'application/json'
    }

    const finalConfig: SSEOptions & {
      url: string
      method: HttpMethod
    } = {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(config.body) : undefined,
      needParseData: true,
      ...config,
      url: (defaultConfig.baseUrl || config.baseUrl || '') + url,
    }

    return finalConfig
  }

  private getInterceptor<T>(config: BaseReqConfig) {
    let reqInterceptor = async (config: BaseReqMethodConfig) => config,
      respInterceptor = async (config: T) => config,
      respErrInterceptor: any = () => { }

    const defaultConfig = this.defaultConfig
    if (defaultConfig.reqInterceptor) {
      // @ts-ignore
      reqInterceptor = defaultConfig.reqInterceptor
    }
    if (defaultConfig.respInterceptor) {
      respInterceptor = defaultConfig.respInterceptor as any
    }
    if (defaultConfig.respErrInterceptor) {
      respErrInterceptor = defaultConfig.respErrInterceptor
    }

    if (config.reqInterceptor) {
      // @ts-ignore
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
import type { HttpMethod, ReqBody, RespData, SSEData } from '../types'
import type { BaseHttpReq, BaseReqConfig, BaseReqConstructorConfig, BaseReqMethodConfig, Resp, SSEOptions } from './abs/AbsBaseReqType'
import qs from 'query-string'
import { TIME_OUT } from '../constants'
import { retryReq } from '../tools'
import { SSEStreamProcessor } from '../tools/SSEStreamProcessor'

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
        code: 408,
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
        signal: rest.signal || signal,
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
  async fetchSSE(url: string, config?: SSEOptions): Promise<SSEData> {
    const formatConfig = this.normalizeSSEOpts(url, config)
    const {
      url: withPrefixUrl,
      needParseData,
      onError,
      onMessage: onMsg,
      onRawMessage,
      onProgress,
      needParseJSON,
      ...rest
    } = formatConfig

    const {
      reqInterceptor,
      respErrInterceptor,
    } = this.getInterceptor(formatConfig)
    const { data, url: withQueryUrl } = await getReqConfig(formatConfig, reqInterceptor, rest.method, withPrefixUrl)

    return new Promise<SSEData>(async (resolve, reject) => {
      try {
        const resp = await fetch(
          withQueryUrl,
          data,
        )

        if (!resp.ok) {
          const error = new Error(`HTTP error! status: ${resp.status}`)
          onError?.(error)
          reject(error)
        }

        const rawSSEData: string[] = []
        const sseData: SSEData = {
          currentJson: [],
          currentContent: '',
          allJson: [],
          allContent: '',
          rawSSEData: [],
        }

        const sseParser = new SSEStreamProcessor({
          onMessage: (data) => {
            Object.assign(sseData, { ...data })
            onMsg?.(data)
          },
          needParseData,
          needParseJSON,
        })
        const reader = resp.body!.getReader()
        const decoder = new TextDecoder()

        const total = resp.headers.get('content-length')
          ? Number(resp.headers.get('content-length'))
          : 0

        let loaded = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            /**
             * 确保一定正确且有值
             * 因为不传递 onMsg 时，是不会触发 SSEStreamProcessor 的
             */
            sseData.rawSSEData = rawSSEData
            resolve?.(sseData)
            break
          }

          loaded += value.length
          const currentContent = decoder.decode(value)
          const parsedCurrentContent = needParseData
            ? SSEStreamProcessor.parseSSEMessages({ content: currentContent })
            : [currentContent]

          rawSSEData.push(...parsedCurrentContent)

          // 当有 onMsg 才需要解析
          onMsg && sseParser.processChunk(currentContent)
          onRawMessage?.(parsedCurrentContent)

          const progress = loaded / total
          onProgress?.(
            progress > 0
              ? progress
              : -1,
          )
        }
      }
      catch (error) {
        onError?.(error)
        reject(error)
        respErrInterceptor(error)
      }
    })
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
      Accept: 'text/event-stream',
      ...(config.headers || defaultConfig.headers || {}),
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
      needParseData: true,
      needParseJSON: true,
      ...config,
      url: (defaultConfig.baseUrl || config.baseUrl || '') + url,
    }

    return finalConfig
  }

  private getInterceptor<T>(config: BaseReqConfig) {
    let reqInterceptor = async (config: BaseReqMethodConfig) => config
    let respInterceptor = async (config: T) => config
    let respErrInterceptor: any = () => { }

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
  if (typeof data === 'object') {
    return {
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  }

  return {
    body: data,
  }
}

/**
 * 获取请求拦截器过滤后的数据
 */
async function getReqConfig(
  config: BaseReqMethodConfig,
  reqInterceptor: Function,
  method: HttpMethod,
  url: string,
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
        : url,
    }
  }

  const { body, headers } = parseBody(config.body)
  Object.assign(config.headers || {}, headers)
  const data = await reqInterceptor({
    ...config,
    body,
  })

  return {
    data,
    url: query
      ? `${url}?${query}`
      : url,
  }
}

function hasHttpErr(code: string | number) {
  return +code >= 400
}

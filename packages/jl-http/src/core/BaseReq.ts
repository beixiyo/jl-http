import type { BaseHttpReq, BaseReqConfig, BaseReqConstructorConfig, BaseReqMethodConfig, FetchSSEReturn, Resp, SSEOptions } from './abs/AbsBaseReqType'
import type { HttpMethod, ReqBody, RespData, SSEData } from '@/types'
import qs from 'query-string'
import { TIME_OUT } from '@/constants'
import { retryTask } from '@/tools'
import { SSEStreamProcessor } from '@/tools/SSEStreamProcessor'

export class BaseReq implements BaseHttpReq {
  constructor(private defaultConfig: BaseReqConstructorConfig = {}) { }

  async request<T, HttpResponse = Resp<T>>(config: BaseReqConfig): Promise<HttpResponse> {
    const formatConfig = this.normalizeOpts(config)
    const {
      url: withPrefixUrl,
      timeout,
      respType,
      retry,
      onProgress,
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

      /** 同步外部 */
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
        ? retryTask<HttpResponse>(() => _req(abort.signal), retry)
        : _req(abort.signal)
      res.then(resolve).catch(reject)
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

          /**
           * 进度处理
           */
          let contentLength: number
          if (
            onProgress
            && (contentLength = Number(response.headers.get('content-length'))) > 0
          ) {
            const res = response.clone()
            const reader = res.body!.getReader()
            let loaded = 0
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                break
              }

              loaded += value.length
              const progress = Number((loaded / contentLength).toFixed(2))
              onProgress?.(progress)
            }
          }
          else if (onProgress) {
            onProgress(-1)
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
  async fetchSSE(url: string, config?: SSEOptions): Promise<FetchSSEReturn> {
    const formatConfig = this.normalizeSSEOpts(url, config)
    const {
      url: withPrefixUrl,
      needParseData,
      onError,
      onMessage: onMsg,
      onRawMessage,
      onProgress,
      needParseJSON,
      ignoreInvalidDataPrefix,
      handleData,
      separator,
      dataPrefix,
      doneSignal,
      ...rest
    } = formatConfig

    const {
      reqInterceptor,
      respErrInterceptor,
    } = this.getInterceptor(formatConfig)
    const { data, url: withQueryUrl } = await getReqConfig(formatConfig, reqInterceptor, rest.method, withPrefixUrl)

    const { promise, resolve, reject } = Promise.withResolvers<SSEData>()
    let cancelFn: Function = () => { }

    fetch(
      withQueryUrl,
      data,
    )
      .then(async (resp) => {
        if (!resp.ok) {
          const error = new Error(`HTTP error! status: ${resp.status}`)
          onError?.(error)
          reject(error)
        }

        const rawSSEData: string[] = []
        const sseData: SSEData = {
          currentContent: '',
          currentJson: [],

          allJson: [],
          allContent: '',
        }

        const sseParser = new SSEStreamProcessor({
          onMessage: (data) => {
            Object.assign(sseData, { ...data })
            onMsg?.(data)
          },
          handleData,
          needParseData,
          needParseJSON,
          ignoreInvalidDataPrefix,
          separator,
          dataPrefix,
          doneSignal,
        })

        const reader = resp.body!.getReader()
        const decoder = new TextDecoder()
        cancelFn = () => {
          reader.cancel()
        }

        const total = resp.headers.get('content-length')
          ? Number(resp.headers.get('content-length'))
          : 0

        let loaded = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            resolve?.(sseData)
            break
          }

          loaded += value.length
          const currentContent = decoder.decode(value)
          const parsedCurrentSSEData = needParseData
            ? SSEStreamProcessor.parseSSEMessages({
                content: currentContent,
                handleData,
                ignoreInvalidDataPrefix,
                separator,
                dataPrefix,
                doneSignal,
              })
            : [currentContent]

          rawSSEData.push(...parsedCurrentSSEData)

          /** 当有 onMsg 才需要解析 */
          onMsg && sseParser.processChunk(currentContent)
          onRawMessage?.({
            allRawSSEData: rawSSEData,
            currentRawSSEData: parsedCurrentSSEData,
          })

          const progress = loaded / total
          onProgress?.(
            progress > 0
              ? progress
              : -1,
          )
        }
      })
      .catch((error) => {
        onError?.(error)
        reject(error)
        respErrInterceptor(error)
      })

    return {
      promise,
      cancel: () => {
        cancelFn()
        reject(new Error('Request canceled by user'))
      },
    }
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
      retry: config.retry ?? defaultConfig.retry ?? 0,
      onProgress: config.onProgress || defaultConfig.onProgress,
      ...config,
      url: (config.baseUrl ?? defaultConfig.baseUrl ?? '') + config.url,
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
      ignoreInvalidDataPrefix: true,
      separator: '\n\n',
      dataPrefix: 'data:',
      doneSignal: '[DONE]',
      handleData(currentContent) {
        return currentContent
      },
      ...config,
      url: (config.baseUrl || defaultConfig.baseUrl || '') + url,
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
  if (data instanceof FormData) {
    return {
      body: data,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  }

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

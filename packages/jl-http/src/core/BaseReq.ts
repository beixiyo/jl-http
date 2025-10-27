import type { BaseHttpReq, BaseReqConfig, BaseReqConstructorConfig, BaseReqMethodConfig, FetchSSEReturn, Resp, RespErrInterceptorError, SSEOptions } from './abs/AbsBaseReqType'
import type { HttpMethod, ReqBody, RespData, SSEData } from '@/types'
import { TIME_OUT } from '@/constants'
import { callbackToAsyncIterator, retryTask } from '@/tools'
import { getReqConfig, handleRespErrInterceptor } from '@/tools/reqTool'
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
          if (!response.ok) {
            handleRespErrInterceptor(
              {
                error: response,
                url,
                body: formatConfig.body,
                headers: formatConfig.headers,
                method: rest.method,
                query: formatConfig.query || {},
              },
              respErrInterceptor,
            )
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
          onError?.(resp)
          reject(resp)
          handleRespErrInterceptor(
            {
              error: resp,
              url: withQueryUrl,
              body: formatConfig.body,
              headers: formatConfig.headers || {},
              method: rest.method,
              query: formatConfig.query || {},
            },
            respErrInterceptor,
          )
          return
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
        handleRespErrInterceptor(
          {
            error,
            url: withQueryUrl,
            body: formatConfig.body,
            headers: formatConfig.headers || {},
            method: rest.method,
            query: formatConfig.query || {},
          },
          respErrInterceptor,
        )
      })

    return {
      promise,
      cancel: () => {
        cancelFn()
        reject(new Error('Request canceled by user'))
      },
    }
  }

  fetchSSEAsIterator(url: string, config?: SSEOptions): AsyncIterableIterator<SSEData> {
    return callbackToAsyncIterator<SSEData>((callback) => {
      let cancelFn: (() => void) | undefined

      /** 启动 SSE 请求 */
      this.fetchSSE(url, {
        ...config,
        onMessage: (data) => {
          /** 调用用户提供的 onMessage 回调（如果有） */
          config?.onMessage?.(data)
          /** 向迭代器传递数据 */
          callback(data)
        },
        onError: (error) => {
          /** 调用用户提供的 onError 回调（如果有） */
          config?.onError?.(error)
          /** 发送结束信号 */
          callback(null)
        },
      }).then(({ promise, cancel }) => {
        /** 保存 cancel 函数 */
        cancelFn = cancel

        /** 当 SSE 完成时，发送结束信号 */
        promise.then(() => {
          callback(null)
        }).catch(() => {
          /** 错误已经在 onError 中处理 */
          callback(null)
        })
      }).catch((error) => {
        // fetchSSE 初始化失败
        config?.onError?.(error)
        callback(null)
      })

      /** 返回取消函数 */
      return () => {
        cancelFn?.()
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
      url: ((config.baseUrl ?? defaultConfig.baseUrl) || '') + url,
    }

    return finalConfig
  }

  private getInterceptor<T>(config: BaseReqConfig) {
    let reqInterceptor = async (config: BaseReqMethodConfig) => config
    let respInterceptor = async (config: T) => config
    let respErrInterceptor: (error: RespErrInterceptorError) => any = () => { }

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

import type { BaseHttpReq, BaseReqConfig, BaseReqConstructorConfig, BaseReqMethodConfig, FetchSSEReturn, Resp, SSEOptions } from './abs/AbsBaseReqType'
import type { ReqBody, SSEData } from '@/types'
import { normalizeSSEConfig, resolveInterceptors } from './requestConfig'
import { executeRequest } from './requestExecutor'
import { callbackToAsyncIterator, maybeIsConfig } from '@/tools'
import { getReqConfig } from '@/tools/requestPreparation'
import { handleRespErrInterceptor } from '@/tools/responseError'
import { SSEStreamProcessor } from '@/tools/SSEStreamProcessor'

export class BaseReq implements BaseHttpReq {
  constructor(private defaultConfig: BaseReqConstructorConfig = {}) { }

  async request<T, HttpResponse = Resp<T>>(config: BaseReqConfig): Promise<HttpResponse> {
    return executeRequest<T, HttpResponse>(config, this.defaultConfig)
  }

  // ======================= 请求方法 =======================

  get<T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig): Promise<HttpResponse> {
    return this.request({ url, method: 'GET', ...config })
  }

  head<T, HttpResponse = Resp<T>>(url: string, config?: BaseReqMethodConfig): Promise<HttpResponse> {
    return this.request({ url, method: 'HEAD', ...config })
  }

  delete<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig): Promise<HttpResponse> {
    if (maybeIsConfig(data, config)) {
      return this.request({ url, method: 'DELETE', ...data })
    }
    return this.request({ url, method: 'DELETE', body: data, ...config })
  }

  options<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig): Promise<HttpResponse> {
    if (maybeIsConfig(data, config)) {
      return this.request({ url, method: 'OPTIONS', ...data })
    }
    return this.request({ url, method: 'OPTIONS', body: data, ...config })
  }

  post<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig): Promise<HttpResponse> {
    if (maybeIsConfig(data, config)) {
      return this.request({ url, method: 'POST', ...data })
    }
    return this.request({ url, method: 'POST', body: data, ...config })
  }

  put<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig): Promise<HttpResponse> {
    if (maybeIsConfig(data, config)) {
      return this.request({ url, method: 'PUT', ...data })
    }
    return this.request({ url, method: 'PUT', body: data, ...config })
  }

  patch<T, HttpResponse = Resp<T>>(url: string, data?: ReqBody | BaseReqMethodConfig, config?: BaseReqMethodConfig): Promise<HttpResponse> {
    if (maybeIsConfig(data, config)) {
      return this.request({ url, method: 'PATCH', ...data })
    }
    return this.request({ url, method: 'PATCH', body: data, ...config })
  }

  /**
   * SSE 请求，默认使用 GET
   */
  async fetchSSE(url: string, config?: SSEOptions): Promise<FetchSSEReturn> {
    const formatConfig = normalizeSSEConfig(url, config, this.defaultConfig)
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

    /** 获取构造器的 fetchOption，优先级最低 */
    const fetchOption = this.defaultConfig.fetchOption || {}

    const {
      reqInterceptor,
      respErrInterceptor,
    } = resolveInterceptors(formatConfig, this.defaultConfig)
    const { data, url: withQueryUrl } = await getReqConfig(formatConfig, reqInterceptor, rest.method, withPrefixUrl)

    const { promise, resolve, reject } = Promise.withResolvers<SSEData>()
    let cancelFn: Function = () => { }

    fetch(
      withQueryUrl,
      {
        ...fetchOption,
        ...data,
      },
    )
      .then(async (resp) => {
        if (!resp.ok) {
          onError?.(resp)
          reject(resp)
          handleRespErrInterceptor(
            {
              error: resp,
              rawResp: resp,
              request: formatConfig,
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
            request: formatConfig,
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
}

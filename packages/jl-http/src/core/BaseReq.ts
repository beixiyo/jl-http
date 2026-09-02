import type { BaseHttpReq, BaseReqConfig, BaseReqConstructorConfig, BaseReqMethodConfig, Resp, SSEOptions } from './abs/AbsBaseReqType'
import type { SSEStream } from './sse'
import type { ReqBody } from '@/types'
import { maybeIsConfig } from '@/tools'
import { executeRequest } from './requestExecutor'
import { executeSSERequest } from './sse'

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
   * 打开只能消费一次的 SSE 增量流，默认使用 GET
   *
   * 完整事件通过 AsyncIterator 逐条交付；除当前未完成事件外不会保存响应历史
   */
  async fetchSSE<T = unknown>(url: string, config?: SSEOptions<T>): Promise<SSEStream<T>> {
    return executeSSERequest({
      url,
      config,
      defaultConfig: this.defaultConfig,
    })
  }
}

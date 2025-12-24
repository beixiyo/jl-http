import type { BaseReqMethodConfig } from '@/core'
import type { BaseReqConfig, BaseReqConstructorConfig, RespErrInterceptorError } from '@/core/abs/AbsBaseReqType'
import type { HttpMethod } from '@/types'
import qs from 'query-string'

/**
 * 解析请求体，自动识别 FormData 和 JSON 类型
 * @param data 请求体
 * @returns 请求体和请求头
 */
export function parseBody(data: any) {
  if (data instanceof FormData) {
    return {
      body: data,
      headers: {
        /** 不需要手动设置 Content-Type，让 FormData 自己处理 boundary，否则可能会报错 */
        // 'Content-Type': 'multipart/form-data',
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
 * 获取拦截器返回的请求配置，自动拼接 query 参数
 * @param config 请求配置
 * @param reqInterceptor 请求拦截器
 * @param method 请求方法
 * @param url 请求 URL
 * @returns 请求配置
 */
export async function getReqConfig(
  config: BaseReqMethodConfig,
  reqInterceptor: Function,
  method: HttpMethod,
  url: string,
): Promise<{
    data: Omit<BaseReqMethodConfig, 'body'> & { body: any }
    url: string
  }> {
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

/**
 * 统一处理响应错误拦截器，兼容 Response 和非 Response 错误
 * 入参只需要提供原始 error、可选的 rawResp 以及 request，最终都会转为 RespErrInterceptorError
 * @param data 错误及请求信息
 * @param respErrInterceptor 响应错误拦截器
 */
export function handleRespErrInterceptor(
  data: {
    error: any
    request: BaseReqConfig
    rawResp?: Response
  },
  respErrInterceptor: BaseReqConstructorConfig['respErrInterceptor'],
) {
  const { error, request, rawResp } = data

  let finalResp: Response
  if (rawResp instanceof Response) {
    finalResp = rawResp
  }
  else if (error instanceof Response) {
    finalResp = error
  }
  else {
    /** 将非 Response 错误包装成一个 mock Response，保证错误拦截器拿到的始终是 Response */
    finalResp = {
      ok: false,
      status: 0,
      statusText: error?.message || 'Unknown error',
      text: async () => error?.message || 'Unknown error',
      json: async () => ({ error: error?.message || 'Unknown error' }),
    } as Response
  }

  const interceptorPayload: RespErrInterceptorError = {
    rawResp: finalResp,
    request,
    error,
  }

  respErrInterceptor?.(interceptorPayload)
}

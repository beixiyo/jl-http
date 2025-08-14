import type { BaseReqMethodConfig } from '@/core'
import type { BaseReqConstructorConfig, RespErrInterceptorError } from '@/core/abs/AbsBaseReqType'
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
 * @param data 错误
 * @param respErrInterceptor 响应错误拦截器
 */
export function handleRespErrInterceptor(
  data: RespErrInterceptorError,
  respErrInterceptor: BaseReqConstructorConfig['respErrInterceptor'],
) {
  const { error, ...rest } = data
  if (data instanceof Response) {
    respErrInterceptor?.(data)
  }
  else {
    const mockResponse = {
      ok: false,
      status: 0,
      statusText: error.message || 'Unknown error',
      text: async () => error.message || 'Unknown error',
      json: async () => ({ error: error.message || 'Unknown error' }),
    } as Response

    respErrInterceptor?.({
      error: mockResponse,
      ...rest,
    })
  }
}

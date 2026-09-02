import type { BaseReqConfig, BaseReqConstructorConfig, RespErrInterceptor, RespInterceptor, SSEOptions } from './abs/AbsBaseReqType'
import type { HttpMethod } from '@/types'
/**
 * 统一归一化请求配置，并解析单次请求使用的拦截器
 */
import { TIME_OUT } from '@/constants'
import { mergeHeaders } from '@/tools/headers'

export function normalizeRequestConfig(config: BaseReqConfig, defaultConfig: BaseReqConstructorConfig) {
  const {
    respType = 'json',
    method = 'GET',
  } = config

  return {
    respType,
    method,
    timeout: config.timeout || defaultConfig.timeout || TIME_OUT,
    signal: config.signal,
    retry: config.retry ?? defaultConfig.retry ?? 0,
    onProgress: config.onProgress || defaultConfig.onProgress,
    ...config,
    headers: mergeHeaders(defaultConfig.headers, config.headers),
    url: (config.baseUrl ?? defaultConfig.baseUrl ?? '') + config.url,
  }
}

export function normalizeSSEConfig<T>(url: string, config: SSEOptions<T> = {}, defaultConfig: BaseReqConstructorConfig) {
  const {
    method = 'GET',
  } = config

  const finalConfig: SSEOptions<T> & {
    url: string
    method: HttpMethod
    parseData: NonNullable<SSEOptions<T>['parseData']>
  } = {
    method,
    validateContentType: true,
    ...config,
    parseData: config.parseData ?? JSON.parse,
    headers: mergeHeaders(
      { Accept: 'text/event-stream' },
      defaultConfig.headers,
      config.headers,
      method === 'POST'
        ? { 'Content-Type': 'application/json' }
        : undefined,
    ),
    url: ((config.baseUrl ?? defaultConfig.baseUrl) || '') + url,
  }

  return finalConfig
}

export function resolveInterceptors<T>(config: BaseReqConfig, defaultConfig: BaseReqConstructorConfig) {
  return {
    reqInterceptor: config.reqInterceptor
      ?? defaultConfig.reqInterceptor
      ?? (async requestConfig => requestConfig),
    respInterceptor: (
      config.respInterceptor
      ?? defaultConfig.respInterceptor
      ?? (async (response: T) => response)
    ) as RespInterceptor<T>,
    respErrInterceptor: config.respErrInterceptor
      ?? defaultConfig.respErrInterceptor
      ?? (() => {}) as RespErrInterceptor,
  }
}

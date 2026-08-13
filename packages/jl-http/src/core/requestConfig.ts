/**
 * 统一归一化请求配置，并解析单次请求使用的拦截器
 */
import { TIME_OUT } from '@/constants'
import type { HttpMethod } from '@/types'
import type { BaseReqConfig, BaseReqConstructorConfig, RespErrInterceptor, RespInterceptor, SSEOptions } from './abs/AbsBaseReqType'

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
    headers: {
      ...(defaultConfig.headers || {}),
      ...(config.headers || {}),
    },
    url: (config.baseUrl ?? defaultConfig.baseUrl ?? '') + config.url,
  }
}

export function normalizeSSEConfig(url: string, config: SSEOptions = {}, defaultConfig: BaseReqConstructorConfig) {
  const {
    method = 'GET',
  } = config

  const finalConfig: SSEOptions & {
    url: string
    method: HttpMethod
  } = {
    method,
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
    headers: {
      Accept: 'text/event-stream',
      ...(defaultConfig.headers || {}),
      ...(config.headers || {}),
      ...(method === 'POST'
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    url: ((config.baseUrl ?? defaultConfig.baseUrl) || '') + url,
  }

  return finalConfig
}

export function resolveInterceptors<T>(config: BaseReqConfig, defaultConfig: BaseReqConstructorConfig) {
  return {
    reqInterceptor: config.reqInterceptor
      ?? defaultConfig.reqInterceptor
      ?? (async (requestConfig) => requestConfig),
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

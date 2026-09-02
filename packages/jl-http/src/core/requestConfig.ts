import type {
  BaseReqConfig,
  BaseReqConstructorConfig,
  BaseReqResolvedConfig,
  Resolvable,
  RespErrInterceptor,
  RespInterceptor,
  SSEOptions,
} from './abs/AbsBaseReqType'
import type { HttpMethod } from '@/types'
/**
 * 统一归一化请求配置，并解析单次请求使用的拦截器
 */
import { TIME_OUT } from '@/constants'
import { mergeHeaders } from '@/tools/headers'

/** 求值可能是函数形式的配置字段 */
export function resolveValue<T>(value: Resolvable<T>): T {
  return typeof value === 'function'
    ? (value as () => T)()
    : value
}

/**
 * 把实例默认配置求值为本次请求使用的纯值快照
 *
 * 每次请求调用一次，函数形式的字段在此刻求值；之后的执行器、拦截器和 SSE 重连都只看这份快照
 */
export function resolveConstructorConfig<T extends BaseReqConstructorConfig>(config: T): Omit<T, keyof BaseReqResolvedConfig> & BaseReqResolvedConfig {
  return {
    ...config,
    baseUrl: resolveValue(config.baseUrl),
    headers: resolveValue(config.headers),
    timeout: resolveValue(config.timeout),
    retry: resolveValue(config.retry),
    fetchOption: resolveValue(config.fetchOption),
  }
}

/**
 * 合并实例默认配置补丁
 *
 * 浅合并：`headers` 在双方都是纯值时增量合并，其余字段覆盖；显式传入 `undefined` 的字段会被删除
 */
export function mergeConstructorConfig<T extends BaseReqConstructorConfig>(current: T, patch: Partial<T>): T {
  const next = { ...current } as Record<string, unknown>

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete next[key]
      continue
    }

    if (key === 'headers' && typeof next.headers !== 'function' && typeof value !== 'function') {
      next.headers = mergeHeaders(next.headers as HeadersInit | undefined, value as HeadersInit)
      continue
    }

    next[key] = value
  }

  return next as T
}

export function normalizeRequestConfig(config: BaseReqConfig, defaultConfig: BaseReqResolvedConfig) {
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

export function normalizeSSEConfig<T>(url: string, config: SSEOptions<T> = {}, defaultConfig: BaseReqResolvedConfig) {
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

export function resolveInterceptors<T>(config: BaseReqConfig, defaultConfig: BaseReqResolvedConfig) {
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

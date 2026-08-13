/**
 * 执行普通 HTTP 请求，负责单次请求、超时、响应解析与重试生命周期
 */
import type { BaseReqConfig, BaseReqConstructorConfig, Resp, RetryRequestOptions } from './abs/AbsBaseReqType'
import { RequestTimeoutError } from './errors'
import { normalizeRequestConfig, resolveInterceptors } from './requestConfig'
import { getReqConfig } from '@/tools/requestPreparation'
import { handleRespErrInterceptor } from '@/tools/responseError'
import { retryTask } from '@/tools/retryTask'

export async function executeRequest<T, HttpResponse = Resp<T>>(
  config: BaseReqConfig,
  defaultConfig: BaseReqConstructorConfig,
): Promise<HttpResponse> {
  const formatConfig = normalizeRequestConfig(config, defaultConfig)
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
  } = resolveInterceptors<HttpResponse>(config, defaultConfig)

  const { data, url } = await getReqConfig(formatConfig, reqInterceptor, rest.method, withPrefixUrl)
  const fetchOption = defaultConfig.fetchOption || {}
  const retryOptions = normalizeRetry(retry)

  if (retryOptions.maxAttempts <= 1)
    return requestOnce()

  return retryTask<HttpResponse>(
    requestOnce,
    retryOptions.maxAttempts,
    {
      ...retryOptions,
      shouldRetry: context => !isExternalAbort(context.error, rest.signal)
        && (retryOptions.shouldRetry?.(context) ?? isRetryableRequestError(context.error)),
    },
  )

  async function requestOnce(): Promise<HttpResponse> {
    if (rest.signal?.aborted)
      throw rest.signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')

    const attemptAbort = new AbortController()
    const signal = rest.signal
      ? AbortSignal.any([rest.signal, attemptAbort.signal])
      : attemptAbort.signal
    const timeoutError = new RequestTimeoutError(url, timeout)
    const timeoutId = timeout > 0
      ? setTimeout(() => attemptAbort.abort(timeoutError), timeout)
      : undefined

    try {
      const response = await fetch(url, {
        ...fetchOption,
        ...data,
        signal,
      })

      if (!response.ok) {
        const recovered = await handleRespErrInterceptor(
          {
            error: response,
            rawResp: response,
            request: formatConfig,
          },
          respErrInterceptor,
        )

        if (recovered !== undefined)
          return recovered as HttpResponse
        throw response
      }

      let contentLength = 0
      const progressResponse = onProgress
        && response.body
        && (contentLength = Number(response.headers.get('content-length'))) > 0
        ? response.clone()
        : undefined

      let res: Resp<T>
      if (respType === 'stream') {
        res = {
          rawResp: response,
          data: null as T,
          reader: response.body?.getReader(),
          request: formatConfig,
        }
      }
      else {
        res = {
          rawResp: response,
          data: await response[respType](),
          request: formatConfig,
        }
      }

      if (progressResponse) {
        const reader = progressResponse.body!.getReader()
        let loaded = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done)
            break

          loaded += value.length
          onProgress?.(Number((loaded / contentLength).toFixed(2)))
        }
      }
      else if (onProgress) {
        onProgress(-1)
      }

      return await respInterceptor(res as unknown as HttpResponse)
    }
    finally {
      if (timeoutId !== undefined)
        clearTimeout(timeoutId)
    }
  }
}

function normalizeRetry(retry: number | RetryRequestOptions): Required<Pick<RetryRequestOptions, 'maxAttempts'>> & Omit<RetryRequestOptions, 'maxAttempts'> {
  if (typeof retry === 'number')
    return { maxAttempts: Math.max(retry, 1) }

  return {
    ...retry,
    maxAttempts: Math.max(retry.maxAttempts, 1),
  }
}

function isExternalAbort(error: unknown, signal?: AbortSignal | null): boolean {
  return signal?.aborted === true
    || (error instanceof DOMException && error.name === 'AbortError')
}

function isRetryableRequestError(error: unknown): boolean {
  if (error instanceof Response)
    return error.status === 408 || error.status === 429 || error.status >= 500
  if (error instanceof RequestTimeoutError)
    return true
  if (error instanceof DOMException)
    return error.name !== 'AbortError'
  return error instanceof Error
}

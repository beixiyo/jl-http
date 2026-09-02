/**
 * 准备 fetch 请求配置，负责 body 序列化与 query URL 合并
 */
import type { BaseReqMethodConfig } from '@/core'
import type { HttpMethod } from '@/types'
import { mergeHeaders } from '@/tools/headers'

/**
 * 解析请求体，自动识别 Fetch 原生 body 和 JSON 对象
 */
export function parseBody(data: any) {
  if (data === undefined || data === null || isRawBody(data)) {
    return {
      body: data,
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
 * 获取拦截器处理后的请求配置，并将 query 合并到 URL
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
  const requestUrl = appendQuery(url, stringifyQuery(config.query))

  if (['GET', 'HEAD'].includes(method.toUpperCase())) {
    return {
      data: await reqInterceptor(config),
      url: requestUrl,
    }
  }

  const { body, headers } = parseBody(config.body)
  config.headers = mergeHeaders(config.headers, headers)

  const reqConfig: any = { ...config }
  if (body === undefined || body === null)
    delete reqConfig.body
  else reqConfig.body = body

  return {
    data: await reqInterceptor(reqConfig),
    url: requestUrl,
  }
}

/** Fetch 原生请求体必须原样透传，不能按普通对象 JSON 序列化 */
function isRawBody(data: unknown): data is BodyInit {
  return typeof data === 'string'
    || data instanceof Blob
    || data instanceof ArrayBuffer
    || ArrayBuffer.isView(data)
    || data instanceof FormData
    || data instanceof URLSearchParams
    || data instanceof ReadableStream
}

/**
 * 将 query 对象映射为标准 URLSearchParams
 * 数组展开为重复 key，null 和 undefined 不参与请求
 */
function stringifyQuery(query?: Record<string, any>): string {
  const searchParams = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(query || {})) {
    if (rawValue === undefined || rawValue === null)
      continue

    const values = Array.isArray(rawValue)
      ? rawValue
      : [rawValue]

    for (const value of values) {
      if (value !== undefined && value !== null)
        searchParams.append(key, String(value))
    }
  }

  return searchParams.toString()
}

/** 将新查询参数追加到 URL，并保留已有查询参数和 fragment */
function appendQuery(url: string, query: string): string {
  if (!query)
    return url

  const hashIndex = url.indexOf('#')
  const baseUrl = hashIndex === -1
    ? url
    : url.slice(0, hashIndex)
  const fragment = hashIndex === -1
    ? ''
    : url.slice(hashIndex)
  const separator = !baseUrl.includes('?')
    ? '?'
    : baseUrl.endsWith('?') || baseUrl.endsWith('&')
      ? ''
      : '&'

  return `${baseUrl}${separator}${query}${fragment}`
}

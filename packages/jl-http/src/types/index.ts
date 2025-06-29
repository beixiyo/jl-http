export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'CONNECT'
  | 'TRACE'
  | 'PATCH'

export type ReqBody = RequestInit['body'] | Record<string, any>
export type ReqHeaders = RequestInit['headers']

export type FetchType = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'stream'

export type RespData = {
  msg: string
  code: number
}

export type SSEData = {
  /** 当前处理块/缓冲区中提取的原始有效载荷字符串 */
  currentContent: string
  /** 当前处理块/缓冲区中解析出的 JSON 对象数组 (只读) */
  currentJson: readonly SSEJson[]

  /** 累积的所有原始有效载荷字符串 */
  allContent: string
  /** 累积的所有 JSON 对象数组 (只读) */
  allJson: readonly SSEJson[]
}

type SSEJson = {
  __internal__event: string
  [key: string]: any
}

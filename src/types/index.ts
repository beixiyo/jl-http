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

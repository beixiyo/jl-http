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

export type ReqBody = RequestInit['body']
export type ReqHeaders = Headers | Record<string, any>

export type FetchType = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'stream'
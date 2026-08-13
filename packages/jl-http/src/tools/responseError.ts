/**
 * 将不同来源的请求错误统一适配为响应错误拦截器载荷
 */
import type { BaseReqConfig, BaseReqConstructorConfig, RespErrInterceptorError } from '@/core/abs/AbsBaseReqType'

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

  return respErrInterceptor?.(interceptorPayload)
}

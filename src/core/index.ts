import { BaseReq } from './BaseReq'
import { AbsCacheReq } from './abs/AbsCacheReq'
import type { BaseCacheConstructorConfig } from './abs/AbsCacheReq'

export type { BaseReq } from './BaseReq'
export type { AbsCacheReq } from './abs/AbsCacheReq'
export type { BaseReqMethodConfig, BaseHttpReq, Resp } from './abs/AbsBaseReqType'
export type { BaseCacheReqMethodConfig, BaseCacheConstructorConfig } from './abs/AbsCacheReq'


export class Http extends AbsCacheReq {

  http: BaseReq

  constructor(protected config: BaseCacheConstructorConfig) {
    super(config)
    this.http = new BaseReq(config)
  }

  /**
   * 去除标准 SSE 格式的 data: 前缀
   */
  static parseSSEContent(
    {
      content,
      joinStr = ',',
      handleResult = (result: string) => `[${result}]`
    }: ParseSSEContentParam
  ) {
    const matches = content.match(/data:([\s\S]*?)(?=\ndata:|$)/g)
    if (!matches)
      return '[]'

    const json = matches
      .filter(item => item.startsWith('data:{'))
      .map(item => item
        .replace(/^data:/, '')
        .replace(/\n/g, ''),
      )
      .join(joinStr)

    return handleResult(json)
  }

}


type ParseSSEContentParam = {
  content: string
  /**
   * 每行的连接符号
   * @default ','
   */
  joinStr?: string
  /**
   * 处理结果的函数，默认使用数组包起来
   * @default (result: string) => `[${result}]`
   */
  handleResult?: (result: string) => string
}

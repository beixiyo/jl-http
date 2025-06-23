import type { BaseCacheConstructorConfig } from './abs/AbsCacheReq'
import { AbsCacheReq } from './abs/AbsCacheReq'
import { BaseReq } from './BaseReq'

export type { BaseHttpReq, BaseReqMethodConfig, Resp } from './abs/AbsBaseReqType'
export type { AbsCacheReq } from './abs/AbsCacheReq'
export type { BaseCacheConstructorConfig, BaseCacheReqMethodConfig } from './abs/AbsCacheReq'
export type { BaseReq } from './BaseReq'

export class Http extends AbsCacheReq {
  http: BaseReq

  constructor(protected config: BaseCacheConstructorConfig) {
    super(config)
    this.http = new BaseReq(config)
  }
}

import type { BaseCacheConstructorConfig } from './abs/AbsCacheReq'
import { AbsCacheReq } from './abs/AbsCacheReq'
import { BaseReq } from './BaseReq'

export class Http extends AbsCacheReq {
  http: BaseReq

  constructor(protected config: BaseCacheConstructorConfig) {
    super(config)
    this.http = new BaseReq(config)
  }
}

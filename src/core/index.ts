import { BaseReq } from './BaseReq'
import { AbsCacheReq } from './abs/AbsCacheReq'
import type { BaseCacheConstructorConfig } from './abs/AbsCacheReq'

export type { BaseReq } from './BaseReq'
export type { BaseReqMethodConfig, AbsBaseReq, BaseHttpReq } from './abs/AbsBaseReq'
export type { BaseCacheReqMethodConfig, BaseCacheConstructorConfig } from './abs/AbsCacheReq'


export class Http extends AbsCacheReq {
    protected http: BaseReq

    constructor(protected config: BaseCacheConstructorConfig) {
        super(config)
        this.http = new BaseReq(config)
    }

}

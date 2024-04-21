import type { BaseHttpReq, BaseReqMethodConfig, BaseReqConstructorConfig, Resp, AbsBaseReq } from './AbsBaseReq'
import type { ReqBody } from '../../types'
import { deepCompare } from '../../tools'


/** 带缓存控制的请求基类 */
export abstract class AbsCacheReq implements BaseHttpReq {

    protected abstract http: AbsBaseReq
    /** 缓存过期时间，默认 1 秒 */
    protected _cacheTimeout = 1000
    /** 未命中缓存 */
    protected static NO_MATCH_TAG = Symbol('No Match')
    /** 缓存已超时 */
    protected static CACHE_TIMEOUT_TAG = Symbol('Cache Timeout')

    protected cacheMap = new Map<string, Cache>()

    // ====================================================

    constructor(protected config: BaseCacheConstructorConfig) {
        this.clearCachePeriodically()

        const { cacheTimeout } = config
        if (cacheTimeout === undefined) return
        this.cacheTimeout = cacheTimeout
    }

    static getErrMsg(status: number | string, msg?: string) {
        if (msg != undefined) return msg

        if (status == 400) {
            return '请求参数错误'
        }
        if (status == 401) {
            return '未授权，请重新登录'
        }
        if (status == 403) {
            return '禁止访问'
        }
        if (status == 404) {
            return '资源不存在'
        }
        if (status == 500) {
            return '服务器内部错误'
        }
        if (status == 502) {
            return '网关错误'
        }
        if (status == 503) {
            return '服务不可用'
        }
        if (status == 504) {
            return '网关超时'
        }
    }

    // ======================= cache =======================
    protected setCache(data: {
        url: string
        params: any
        cacheData: any
        cacheTimeout?: number
    }) {
        const { url, ...rest } = data
        this.cacheMap.set(url, {
            time: performance.now(),
            ...rest
        })
    }

    /** 设置缓存超时时间 */
    set cacheTimeout(timeout: number) {
        if (timeout < 1) {
            console.warn('缓存时间不能小于 1 毫秒')
            return
        }
        this._cacheTimeout = timeout
    }

    protected compareCache(url: string, params: any) {
        const cache = this.clearOneCache(url)
        if (typeof cache === 'symbol') {
            return cache
        }

        // 比较相同则返回缓存
        if (deepCompare(params, cache?.params)) {
            return cache.cacheData
        }

        return false
    }

    protected getCache(url: string, params: any) {
        const cache = this.compareCache(url, params)

        if (this.isMatchCache(cache)) {
            console.log(`%c缓存命中 ${url}:`, 'color: #f40', cache)
            return cache
        }

        return AbsCacheReq.NO_MATCH_TAG
    }

    protected isMatchCache(cache: any) {
        return ![AbsCacheReq.CACHE_TIMEOUT_TAG, AbsCacheReq.NO_MATCH_TAG, false].includes(cache)
    }

    /** 定期清理缓存 */
    protected clearCachePeriodically(gap = 2000) {
        setInterval(
            () => {
                for (const url of this.cacheMap.keys()) {
                    this.clearOneCache(url)
                }
            },
            gap
        )
    }

    protected clearOneCache(url: string) {
        const cache = this.cacheMap.get(url)
        // 没匹配到
        if (!cache) return AbsCacheReq.NO_MATCH_TAG

        const now = performance.now()
        const { cacheTimeout = this._cacheTimeout, time } = cache
        // 超时则删除
        if (now - time > cacheTimeout) {
            this.cacheMap.delete(url)
            return AbsCacheReq.CACHE_TIMEOUT_TAG
        }

        return cache
    }

    // ======================= 请求方法 =======================

    get<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.http.get(url, config)
    }

    delete<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.http.delete(url, config)
    }

    head<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.http.head(url, config)
    }

    options<T>(url: string, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.http.options(url, config)
    }


    post<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.http.post(url, data, config)
    }

    put<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.http.put(url, data, config)
    }

    patch<T, D extends ReqBody>(url: string, data?: D, config?: BaseReqMethodConfig): Promise<Resp<T>> {
        return this.http.patch(url, data, config)
    }


    /** 缓存响应，如果下次请求未超过缓存时间，则直接从缓存中获取 */
    async cacheGet<T>(url: string, config: BaseCacheReqMethodConfig = {}): Promise<Resp<T>> {
        const cache = this.getCache(url, config.query)
        if (this.isMatchCache(cache)) {
            return cache as Resp<T>
        }

        const { cacheTimeout, ...rest } = config
        const cacheData = await this.get<T>(url, rest)
        this.setCache({
            url,
            params: config.query,
            cacheData,
            cacheTimeout
        })
        return cacheData
    }

    /** 缓存响应，如果下次请求未超过缓存时间，则直接从缓存中获取 */
    async cachePost<T, D extends ReqBody>(url: string, data?: D, config: BaseCacheReqMethodConfig = {}): Promise<Resp<T>> {
        const cache = this.getCache(url, data)
        if (cache !== AbsCacheReq.NO_MATCH_TAG) {
            return cache as Resp<T>
        }

        const { cacheTimeout, ...rest } = config
        const cacheData = await this.post<T, D>(url, data, rest)
        this.setCache({
            url,
            cacheData,
            params: data,
            cacheTimeout
        })
        return cacheData
    }
}


export interface BaseCacheConstructorConfig extends BaseReqConstructorConfig {
    /** 缓存过期时间，默认 1 秒 */
    cacheTimeout?: number
}

export interface BaseCacheReqMethodConfig extends BaseReqMethodConfig {
    /** 缓存过期时间，默认 1 秒 */
    cacheTimeout?: number
}

export type Cache = {
    /** 缓存那一刻的时间 */
    time: number,
    params?: any,
    /** 缓存的数据 */
    cacheData: any,
    cacheTimeout?: number
}
import type { HttpMethod } from '@/types'

export function defineConfig(config: Config) {
    return config
}

export type Config = {
    /** 顶部导入的路径 */
    importPath?: string
    /** 类名 */
    className: string
    /** 可以发送请求的对象 */
    requestFnName: string
    /** 类里的函数 */
    fns: Fn[]
}

export type Fn = {
    /** 函数的名字 */
    name: string
    /** 添加异步关键字 */
    isAsync?: boolean
    /** 生成 TS 类型的代码，你可以像写 TS 一样写，也可以乱写 */
    args: Record<string, any>
    /** 请求的方法，如 get | post | ... */
    method: HttpMethod
}


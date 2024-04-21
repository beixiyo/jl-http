# 一个能中断请求、缓存（幂等）请求的库

支持 `ESM` | `CommonJS` | `iife`

**iife** 模式下，全局导出一个 `_jlHttp` 对象

---

## 安装
```bash
npm i @jl-org/http
```

## 使用
**配置全部都有文档注释**

```ts
import { Http } from '@jl-org/http'

export const iotHttp = new Http({
    /** 缓存过期时间，默认 1 秒 */
    cacheTimeout: 1000,
    defaultConfig: {
        baseUrl: '/iot',
        timeout: 10000,
        // ... 其他配置详见定义
    },
    
    interceptor: {
        reqInterceptor: (config) => {
            return {
                ...config,
                headers: {
                    token: 'token'
                },
            }
        },
        respInterceptor: (resp) => {
            return {
                data: resp.data,
            }
        },
        respErrInterceptor: (reason) => {
            console.warn(reason)
        }
    }
})

// get 请求
iotHttp.get('/device/list', {
    params: {
        page: 1,
        size: 10,
    }
}).then(console.log)

// post 请求
iotHttp.post(
    '/device/add',
    {
        name: 'device1',
        type: 'type1',
    },
    {
        timeout: 2000
    }
)
    .then(console.log)
```

### 可缓存的请求

- 当你在短时间内多次请求同一个接口，并且参数一致，则不会发送请求，而是直接返回上一次的结果
- 适用于幂等请求，请注意，**缓存在内存中，如果页面刷新则会失效**
- 每隔两秒或者调用接口时，会检查一遍缓存，如果超时则会清除缓存
```ts
iotHttp.cachePost(
    '/device/add',
    {
        name: 'device1',
        type: 'type1',
    },
    {
        /** 缓存超时时间，默认 1000 */
        cacheTimeout: 2000
    }
)
    .then(console.log)
```

### 中断请求

```ts
iotHttp.get('/device/list', {
    params: {
        page: 1,
        size: 10,
    },
    /**
     * 若返回 true，则会中断请求
     * 你也可以在请求拦截器设置，或者手动设置 fetch 的配置项 signal
     */
    abort: () => true
})
```

---

### 命令行快速生成模板代码

```bash
npx jl-http <inputSrc> <outputSrc>

# 例如：则向 ./test/output.ts 生成模板代码
npx jl-http ./test/input.ts ./test/output.ts
```

**模板配置文件**  
`./test/input.ts`
```ts
import { defineConfig } from '@jl-org/http'

export default defineConfig({
    /** 类名 */
    className: 'Test',
    /** 可以发送请求的对象 */
    requestFnName: 'iotHttp',
    /** 顶部导入的路径 */
    importPath: 'import { iotHttp } from \'@/http/iotHttp\'',
    /** 类里的函数 */
    fns: [
        {   
            /** 
             * 生成 TS 类型的代码
             * 你可以像写 TS 一样写，也可以写字面量，字面量会被 typeof 转换
             */
            args: {
                age: 18,
                name: 'string',
                ids: 'number[]',
                salary: 'Bigint',
                money: BigInt(123),
                fn: 'function',
                isMan: true,
                isWoman: 'boolean',
            },
            /** 函数的名字 */
            name: 'getData',
            /** 请求的方法，如 get | post | ... */
            method: 'get',
            /** 请求地址 */
            url: '/addList',
            /** 添加异步关键字 */
            isAsync: false
        },
        {
            // ...
        }
    ],
})
```

上面的代码，将会生成如下的模板代码
```ts
import { iotHttp } from '@/http/iotHttp'

export class Test {

    static getData(data: {
		age: number
		name: string
		ids: number[]
		salary: string
		money: bigint
		fn: string
		isMan: true
		isWoman: boolean
	}) {
        return iotHttp.get(data)
    }

}
```
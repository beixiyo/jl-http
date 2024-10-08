# 一个能中断请求、缓存（幂等）请求、重试请求、并发请求，生成模板代码的库

支持 `ESM` | `CommonJS` | `iife`

**iife** 模式下，全局导出一个 `_jlHttp` 对象

---

## 安装
```bash
npm i @jl-org/http
```

---


## 使用

**配置全部都有文档注释**

```ts
import { Http } from '@jl-org/http'

/** 这里的默认配置，都可以在实际请求里设置覆盖 */
export const iotHttp = new Http({
    /** 缓存过期时间，默认 1 秒 */
    cacheTimeout: 1000,
    baseUrl: '/iot',
    /** 超时时间 */
    timeout: 10000,
    /** 请求失败重试次数，默认 0 */
    retry: 0,

    respInterceptor: (response: Resp<MyResp>) => {
        if (!response.data.success) {
            return Promise.reject(response.data.msg)
        }

        return response.data.data
    },

    reqInterceptor(config) {
        config.headers.authorization = getLocalStorage('token') || ''
        return config
    },

    respErrInterceptor: (error: any) => {
        console.warn(error)
    }
    // ... 其他配置详见定义
})


// get 请求，重试 5 次
iotHttp.get('/device/list', {
    query: {
        page: 1,
        size: 10,
    },
    retry: 5,
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

---


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

---


### 中断请求

注意，配置了 *signal* 后，**超时配置无效**  
因为你的控制器覆盖了超时的控制器

```ts
const controller = new AbortController()

iotHttp.get('/device/list', {
    params: {
        page: 1,
        size: 10,
    },
    signal: controller.signal
})

// 中断请求
controller.abort()
```

---


### 并发请求

```ts
/**
 * 并发任务数组 完成最大并发数后才会继续
 * @param tasks 任务数组
 * @param maxCount 最大并发数，默认 4
 */
export declare function concurrentTask<T>(tasks: (() => Promise<T>)[], maxCount?: number): Promise<T[]>;
```

---


### 下载资源

```ts
import { downloadByData } from '@jl-org/tool'

const data = await iotHttp.get('/getImg', {
    /** 如果需要可读流，则设置为 stream */
    respType: 'blob' 
})
downloadByData(blob.data as Blob, 'test.png')
```

---


### 命令行快速生成模板代码

```bash
npx jl-http <inputSrc> <outputSrc>

# 例如下面的命令：会向 `./test/output.ts` 生成模板代码
npx jl-http ./test/template.ts ./test/output.ts

# 如果你用 npx 报错，那你可能需要使用对应的包管理器，比如你项目用 pnpm
pnpm jl-http ./test/template.ts ./test/output.ts
```


**模板配置文件**  

`./test/template.ts`

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
                money: BigInt(123),
                fn: 'function',
                isMan: true,
                isWoman: 'boolean',
                scratch: '乱写的'
            },
            /** 函数的名字 */
            name: 'getData',
            /** 请求的方法，如 get | post | ... */
            method: 'get',
            /** 请求地址 */
            url: '/getList',
            /** 添加异步关键字 */
            isAsync: false,
            /** 注释 */
            comment: '我是一个高雅的文档注释'
        },
        {
            method: 'post',
            name: 'postData',
            url: '/addList',
            isAsync: true,
            args: {
                id: 'number'
            }
        },
        {
            method: 'delete',
            name: 'delData',
            url: '/addList',
            isAsync: true,
            comment: '我是无参函数'
        }
    ],
})
```

上面的代码，将会生成如下的模板代码  

`./test/output.ts`
```ts
import { iotHttp } from '@/http/iotHttp'

export class Test {

    /** 我是一个高雅的文档注释 */
	static getData(data: {
		age: number
		name: string
		ids: number[]
		money: bigint
		fn: Function
		isMan: true
		isWoman: boolean
		scratch: string
	}) {
        return iotHttp.get('/getList', { query: data })
    }

    static async postData(data: {
		id: number
	}) {
        return iotHttp.post('/addList', data)
    }

    /** 我是无参函数 */
	static async delData() {
        return iotHttp.delete('/addList')
    }

}
```
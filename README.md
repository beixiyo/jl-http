# 现代化、通用的、灵活的请求库

<p align="center">
  <a href="./README-EN.md">English</a>
  <a href="./README.md">中文</a>
</p>

<p align="center">
  <img alt="npm-version" src="https://img.shields.io/npm/v/@jl-org/http.svg" />
  <img alt="npm-download" src="https://img.shields.io/npm/dy/@jl-org/http?logo=npm" />
  <img alt="License" src="https://img.shields.io/npm/l/@jl-org/http?color=blue" />
  <img alt="vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="github" src="https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white" />
</p>

## ✨ 特性

- 🔄 **请求中断** - 随时取消进行中的请求
- 💾 **请求缓存** - 可选自动缓存请求，提高应用性能，减小服务端压力和潜在的多次错误调用
- 🔁 **请求重试** - 自动重试失败的请求，增强应用稳定性
- 🚦 **并发控制** - 轻松管理并发请求，保持结果顺序
- 🧩 **模板生成** - 通过 CLI 工具快速生成模板代码
- 📊 **SSE 增量流** - 一次性异步迭代，标准 SSE 增量解析，协议字段可配置，默认按事件 JSON 解析，并可限制未完成事件大小
- ⏳ **进度追踪** - 实时掌握请求进度，提升用户体验
- 📦 **轻量级** - 零外部依赖，体积小，加载快
- 🔧 **高度可配置** - 灵活的拦截器和配置选项

## 📦 安装

```bash
# npm
npm install @jl-org/http

# yarn
yarn add @jl-org/http

# pnpm
pnpm add @jl-org/http
```

## 🚀 基本使用

```ts
import { Http } from '@jl-org/http'

/** 创建HTTP实例，所有默认配置都可以在实际请求中覆盖 */
export const iotHttp = new Http({
  /** 缓存过期时间，默认 1 秒 */
  cacheTimeout: 1000,
  baseUrl: '/iot',
  /** 超时时间 */
  timeout: 10000,
  /** 请求失败重试次数，默认 0 */
  retry: 0,

  respInterceptor: (response) => {
    if (!response.data.success) {
      return Promise.reject(response.data.msg)
    }
    return response.data.data
  },

  reqInterceptor(config) {
    config.headers.authorization = getLocalStorage('token') || ''
    return config
  },

  respErrInterceptor: (error) => {
    console.warn(error)
  }
})

// GET请求示例
iotHttp.get('/device/list', {
  query: {
    page: 1,
    size: 10,
  },
  retry: 5, // 覆盖默认重试次数
}).then(console.log)

// POST请求示例
iotHttp.post(
  '/device/add',
  {
    name: 'device1',
    type: 'type1',
  },
  {
    timeout: 2000 // 覆盖默认超时时间
  }
).then(console.log)
```

## 💾 请求缓存

当短时间内多次请求同一接口且参数一致时，jl-http会自动返回缓存结果而不发送新请求：

```ts
/** 缓存POST请求 */
iotHttp.cachePost(
  '/device/add',
  {
    name: 'device1',
    type: 'type1',
  },
  {
    /** 缓存超时时间，默认 1000ms */
    cacheTimeout: 2000
  }
).then(console.log)

/** 缓存GET请求 */
iotHttp.cacheGet('/device/list', {
  query: { page: 1 },
  cacheTimeout: 5000
}).then(console.log)
```

> 📝 注意：缓存为内存缓存，刷新页面后会丢失。默认每 2000ms 执行一次全局过期清理（可通过 `cacheSweepInterval` 配置）；此外，在发起缓存请求时也会同步检查并清理该请求对应的过期条目。可通过 `cacheTimeout` 配置每条缓存的过期时间（全局或按请求）

## ⚙️ 动态配置

实例配置不是一次性的。`baseUrl`、`headers`、`timeout`、`retry`、`fetchOption` 和
`cacheTimeout` 可以传同步函数，每次请求发起时求值一次：

```ts
const http = new Http({
  baseUrl: () => currentTenant.apiOrigin,
  headers: () => ({ Authorization: `Bearer ${getToken()}` }),
})
```

也可以在运行时用 `setConfig` 更新任意构造字段，只影响之后发起的请求：

```ts
http.setConfig({
  baseUrl: '/v2',
  /** headers 增量合并，其余字段覆盖 */
  headers: { 'X-Tenant': 'acme' },
  /** 显式传 undefined 会删除该字段 */
  retry: undefined,
  /** 修改后会重启后台清扫定时器 */
  cacheSweepInterval: 5000,
})

/** 只读快照；函数形式的字段原样返回 */
http.getConfig()

/** 停止后台清扫并清空缓存，实例不再使用时调用 */
http.dispose()
```

语义说明：

- 优先级：单次请求参数 > 构造配置（含函数返回值） > 内置默认值
- 拦截器和 `Resp.request` 看到的始终是求值后的纯值，单次请求参数不接受函数
- 进行中的请求、SSE 流及其 `reopen()` 使用各自发起时的快照，不受 `setConfig` 影响
- `cacheTimeout` 的函数形式在每次过期判断时求值；`cacheSweepInterval` 只接受数字

## 🌊 SSE 增量流

`2.0.0` 起，`fetchSSE` 直接返回一次性异步迭代器。库内部只保存当前尚未被空行
完整终止的事件，不再累计 `allContent`、`allJson` 或原始事件历史

```ts
interface AgentEvent {
  type: string
  content?: string
}

const stream = await iotHttp.fetchSSE<AgentEvent>('/ai/chat', {
  method: 'POST',
  body: {
    messages: [{ role: 'user', content: '你好' }]
  },
  /** `[DONE]` 不是 SSE 标准，只有服务端使用时才显式配置 */
  doneSignal: '[DONE]',
  /** SSE 标准注释前缀为 `:` */
  commentPrefix: ':',
  onComment: comment => console.log('heartbeat:', comment),
  onActivity: ({ byteLength }) => console.log('received bytes:', byteLength),
})

try {
  for await (const message of stream) {
    console.log('当前事件文本:', message.dataText)
    console.log('当前事件 JSON:', message.data)
    console.log('event / id / retry:', message.event, message.id, message.retry)
  }
}
catch (error) {
  /** 网络、协议和 parseData 错误都会从迭代器抛出。 */
  console.error(error)
}
```

提前退出会取消当前响应体并释放 reader；也可以显式取消：

```ts
stream.cancel(new Error('用户停止'))
```

解析器也可以脱离请求独立使用，并从包根公开导出：

```ts
import { SSEParser } from '@jl-org/http'
import type { SSEParserOptions } from '@jl-org/http'

const options: SSEParserOptions = {
  /** 非标准流可使用精确分隔符；标准 SSE 不需要配置 */
  separator: '<END>',
  /** 自定义一行如何匹配和提取字段；undefined 会回落到标准规则 */
  matchField: ({ line }) => {
    const match = /^payload\s*=>\s?(.*)$/.exec(line)
    return match
      ? { type: 'data', value: match[1] }
      : undefined
  },
  isDone: message => message.event === 'close',
}

const parser = new SSEParser(options)
for (const result of parser.processChunk('payload => hello<END>'))
  console.log(result)
parser.finish()
```

### 协议与内存语义

- 支持 LF、CRLF、CR 以及任意传输 chunk 切分，包括跨 chunk 的 UTF-8 字符
- 只有空行完整终止的事件才会产出；EOF 时未完成尾部会被丢弃
- `event`、`id`、`retry` 和以 `:` 开头的 comment 按标准 SSE 语义解析
- `parseData` 默认是 `JSON.parse`，也可以返回 Promise；完成前不会解析下一事件，因此消费方可以产生背压
- 需要原始字符串时显式传入 `parseData: dataText => dataText`
- `maxBufferSize` 可以限制单个未完成事件；省略时不设置通用大小上限
- 普通 EOF 不会自动重连。错误拦截器只有显式调用 `reopen()` 才会重新打开物理连接；
  它不会回放已经收到的响应或事件

`reopen()` 默认完整沿用当前请求，并重新执行请求拦截器。需要为新连接增加游标或
替换请求体时，可显式覆盖物理请求参数：

```ts
const http = new BaseReq({
  respErrInterceptor: async (error) => {
    if (error.transport !== 'sse' || !error.reopen)
      return

    await error.reopen({
      request: {
        headers: { 'Last-Event-ID': 'event-42' },
        query: { cursor: 'next-page' },
      },
    })
  },
})
```

省略字段继承当前请求；`headers` 和 `query` 增量合并，其余字段覆盖。覆盖在当前逻辑流
后续连接中持续有效。`signal`、解析规则和拦截器属于逻辑流生命周期，不能通过
`reopen()` 替换。若 body 是一次性的 `ReadableStream`，调用方必须显式提供新的 body

### 从 1.x 迁移

- 删除 `fetchSSEAsIterator`；`fetchSSE` 本身就是 AsyncIterator
- 删除 `{ promise, cancel }` 返回结构；直接遍历返回的 stream，并使用 `stream.cancel()`
- 删除 `onMessage`、`onRawMessage`、`allContent`、`allJson`、`currentContent` 和
  `currentJson`。需要聚合时由业务层按实际语义保存
- 删除 `needParseData`、`needParseJSON` 和 `handleData`；默认使用 `JSON.parse`，其它转换通过 `parseData` 指定
- 标准 SSE 始终按行解析；只有适配非标准事件流时才显式配置精确 `separator`
- `[DONE]` 不再是默认值，需要时显式传入 `doneSignal`

---

## 🛑 中断请求

轻松取消正在进行的请求：

```ts
const controller = new AbortController()

iotHttp.get('/device/list', {
  query: {
    page: 1,
    size: 10,
  },
  signal: controller.signal
})

/** 在需要时中断请求 */
controller.abort()
```

`fetchSSE` 在建连阶段（Promise resolve 之前）只能通过 `signal` 取消；拿到 stream 之后，
`signal` 和 `stream.cancel()` 都会取消当前读取以及后续的 `reopen()`

> ⚠️ 注意：配置了signal后，timeout配置将无效，因为自定义控制器会覆盖超时控制器

## 🚦 并发请求控制

控制并发请求数量，并保持结果顺序：

```ts
import { concurrentTask } from '@jl-org/http'

/** 定义多个请求任务 */
const tasks = [
  () => iotHttp.get('/api/data1'),
  () => iotHttp.get('/api/data2'),
  () => iotHttp.get('/api/data3'),
  // ...更多任务
]

/** 最多同时执行2个请求，其余排队 */
const results = await concurrentTask(tasks, 2)

/** 处理结果（结果顺序与任务顺序一致） */
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`任务${index}成功:`, result.value)
  }
  else {
    console.log(`任务${index}失败:`, result.reason)
  }
})
```

## 📥 下载资源

```ts
import { downloadByData } from '@jl-org/tool'

const data = await iotHttp.get('/getImg', {
  /** 如果需要可读流，则设置为 stream */
  respType: 'blob'
})
downloadByData(blob.data as Blob, 'test.png')
```

## 🧩 CLI模板代码生成

快速生成API调用模板代码：

```bash
# 使用npx
npx jl-http ./test/template.ts ./test/output.ts

# 或使用项目的包管理器
pnpm jl-http ./test/template.ts ./test/output.ts
```

**模板配置文件示例：**

```ts
// template.ts
import { defineConfig } from '@jl-org/http'

export default defineConfig({
  className: 'Test',
  requestFnName: 'iotHttp',
  importPath: 'import { iotHttp } from \'@/http/iotHttp\'',
  fns: [
    {
      args: {
        age: 18,
        name: 'string',
        ids: 'number[]',
        money: BigInt(123),
        fn: 'function',
        isMan: true,
        isWoman: 'boolean',
      },
      name: 'getData',
      method: 'get',
      url: '/getList',
      isAsync: false,
      comment: '获取数据列表'
    },
    {
      method: 'post',
      name: 'postData',
      url: '/addList',
      isAsync: true,
      args: {
        id: 'number'
      },
      comment: '添加数据'
    }
  ],
})
```

**生成的代码：**

```ts
// output.ts
import { iotHttp } from '@/http/iotHttp'

export class Test {
  /** 获取数据列表 */
  static getData(data: {
    age: number
    name: string
    ids: number[]
    money: bigint
    fn: Function
    isMan: true
    isWoman: boolean
  }) {
    return iotHttp.get('/getList', { query: data })
  }

  /** 添加数据 */
  static async postData(data: {
    id: number
  }) {
    return iotHttp.post('/addList', data)
  }
}
```

## 📚 API文档

### Http类配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `baseUrl` | `string \| () => string` | `''` | 请求的基础URL |
| `timeout` | `number \| () => number` | `10000` | 请求超时时间(ms) |
| `retry` | `number \| RetryRequestOptions \| () => ...` | `0` | 请求失败重试次数 |
| `cacheTimeout` | `number \| () => number` | `1000` | 全局缓存过期时间(ms) |
| `cacheSweepInterval` | `number` | `2000` | 定期清理间隔(ms)，仅影响后台清扫频率 |
| `headers` | `HeadersInit \| () => HeadersInit` | `{}` | 默认请求头 |
| `fetchOption` | `RequestInit \| () => RequestInit` | `{}` | 透传给 fetch 的选项，优先级最低 |
| `reqInterceptor` | `function` | - | 请求拦截器 |
| `respInterceptor` | `function` | - | 响应拦截器 |
| `respErrInterceptor` | `function` | - | 错误拦截器 |
| `onProgress` | `function` | - | 进度回调函数 |

函数形式在每次请求发起时求值；运行时修改见「动态配置」章节的 `setConfig` / `getConfig` / `dispose`

### 请求方法

- **标准请求**: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`
- **缓存请求**: `cacheGet`, `cachePost`, `cachePut`, `cachePatch`
- **SSE 请求**: `fetchSSE`

### 工具函数

- **并发控制**: `concurrentTask`


---

## Node 环境使用代理

```bash
pnpm i undici
```

```ts
import { ProxyAgent } from 'undici'

fetchHackProxy()

/**
 * 全局替换
 */
function fetchHackProxy() {
  const proxy = process.env.HTTP_PROXY
  const agent = proxy
    ? new ProxyAgent(proxy)
    : undefined

  if (!agent) {
    return
  }

  const oldFetch = fetch
  globalThis.fetch = (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => {
    return oldFetch(input, {
      ...init,
      // @ts-ignore
      dispatcher: agent
    })
  }
}
```

## 常见问题

### 1. 无法获取 SSE 消息

默认配置按照 SSE 标准同时识别 LF、CRLF 和 CR。非标准事件边界可以通过
`separator` 显式指定：

```ts
const stream = await iotHttp.fetchSSE('/ai/chat', {
  method: 'POST',
  body: {
    messages: [{ role: 'user', content: '你好' }]
  },
})

for await (const message of stream)
  console.log(message.data)
```

流结束时，没有被空行完整终止的数据事件会被丢弃；传输 chunk 在事件内部任意位置切分则会自动缓冲，直到事件完整后再提交

你可以用下面的代码查看完整的输出
```ts
const resp = await fetch(
  url,
  {
    method: 'POST',
    body: JSON.stringify({ }),
    headers
  }
)

const reader = resp.body?.getReader()
if (!reader) {
  throw new Error('No reader')
}

let content = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) {
    console.log(content)
    break
  }
  content += new TextDecoder().decode(value)
}

/** 查看调试信息 */
console.log(content)
```

---

## 🧪 测试与调试

提供了完整的测试系统，包含Web页面交互式测试和自动化测试：

### Web页面测试

```bash
# 进入测试目录
cd packages/test

# 启动开发服务器
pnpm dev
```

访问 http://localhost:5173 可体验以下功能测试页面：

- **基础HTTP请求** - `/http-basic` - 测试基础请求方法
- **请求缓存** - `/http-cache` - 测试幂等请求缓存功能
- **请求重试** - `/http-retry` - 测试自动重试机制
- **请求中断** - `/http-abort` - 测试请求中断功能
- **并发请求** - `/http-concurrent` - 测试并发控制
- **SSE流处理** - `/http-sse` - 测试流式数据处理
- **进度测试** - `/http-progress` - 测试进度
- **拦截器** - `/http-interceptors` - 测试请求响应拦截

### 自动化测试

```bash
# 构建核心包
pnpm build

# 运行所有测试
pnpm test
# 运行 Web 页面测试
pnpm test:page
```

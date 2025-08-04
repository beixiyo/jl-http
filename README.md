# 现代化、通用的、灵活的请求库

<p align="center">
  <img alt="npm-version" src="https://img.shields.io/npm/v/@jl-org/http.svg" />
  <img alt="npm-download" src="https://img.shields.io/npm/dm/@jl-org/http?logo=npm" />
  <img alt="License" src="https://img.shields.io/npm/l/@jl-org/http?color=blue" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="github" src="https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white" />
</p>

> 一个功能强大的HTTP请求库，支持请求中断、缓存、重试、并发控制以及SSE流式数据处理

## ✨ 特性

- 🔄 **请求中断** - 随时取消进行中的请求
- 💾 **请求缓存** - 可选自动缓存请求，提高应用性能，减小服务端压力和潜在的多次错误调用
- 🔁 **请求重试** - 自动重试失败的请求，增强应用稳定性
- 🚦 **并发控制** - 轻松管理并发请求，保持结果顺序
- 🧩 **模板生成** - 通过 CLI 工具快速生成模板代码
- 📊 **SSE流处理** - 完美支持流式数据，特别适用于AI接口，自动字符串转 JSON，自动处理不完整的JSON（因为消息是一点点发的，不保证完整性）
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

> 📝 注意：缓存存储在内存中，页面刷新后会失效。系统会每隔2秒或调用接口时自动检查并清除过期缓存。

## 🌊 SSE流式数据处理

### 基础用法

完美支持SSE流式数据，特别适用于AI接口：

```ts
/** 实时处理流式数据 */
const { promise, cancel } = await iotHttp.fetchSSE('/ai/chat', {
  method: 'POST',
  body: {
    messages: [{ role: 'user', content: '你好' }]
  },
  /** 是否解析数据，删除 data: 前缀（默认为 true） */
  needParseData: true,
  /** 是否解析 JSON（默认为 true） */
  needParseJSON: true,
  /** 每次接收到新数据时触发 */
  onMessage: ({ currentContent, allContent, currentJson, allJson }) => {
    console.log('当前片段:', currentContent)
    console.log('累积内容:', allContent)

    /** 如果启用了 needParseJSON */
    console.log('当前 JSON:', currentJson)
    console.log('累积 JSON:', allJson)
  },
  /** 跟踪进度 */
  onProgress: (progress) => {
    console.log(`进度: ${progress * 100}%`)
  },
  /** 错误处理 */
  onError: (error) => {
    console.error(error)
  },
})

const data = await promise
console.log('最终数据:', data)
```

### 此库的 SSE 优势

在深入代码实现之前，我们先了解一下 **Server-Sent Events (SSE)** 的标准规范：

##### 🔧 SSE 协议格式

SSE 是一种单向通信协议，服务器可以主动向客户端推送数据。其数据格式遵循以下规范：

```txt
data: 这是数据内容
event: 事件名称（可选）
id: 消息ID（可选）
retry: 重连间隔（可选）

data: 另一条消息
```

每个字段都以换行符结尾，完整的消息块以**两个换行符**（`\n\n`）分隔。

##### ⚠️ SSE 数据传输的不可靠性

由于网络传输的特性，SSE 数据流存在以下不可靠问题：

1. **📦 数据分片传输**：一个完整的 JSON 可能被分成多个数据块传输
2. **🔀 消息边界模糊**：数据可能在任意位置被切断
3. **❌ 不完整的消息**：单次接收的数据可能不是完整的 SSE 消息
4. **🎭 格式不一致**：不同服务可能有不同的数据格式

例如，一个完整的消息：
```txt
data: {"name": "张三", "age": 25}

```

可能会被分成这样接收：
```txt
// 第一次接收
"data: {\"name\": \"张"

// 第二次接收
"三\", \"age\": 25}\n\n"
```

##### 5️⃣ 与市面上 SSE 库的对比

| 特性对比 | 🔥 本库 | 🌐 原生 EventSource | 📚 其他库 |
|---------|---------|---------------------|----------|
| **HTTP 方法** | ✅ 支持所有方法 | ❌ 仅 GET | ⚠️ 部分支持 |
| **请求体** | ✅ 支持任意格式 | ❌ 不支持 | ⚠️ 有限支持 |
| **自定义 Headers** | ✅ 完全支持 | ❌ 不支持 | ✅ 支持 |
| **拦截器** | ✅ 请求/响应拦截 | ❌ 不支持 | ❌ 不支持 |
| **自动 JSON 解析** | ✅ 智能解析 | ❌ 手动解析 | ⚠️ 基础解析 |
| **不完整数据处理** | ✅ 缓冲区机制 | ❌ 可能丢失 | ⚠️ 简单处理 |
| **进度追踪** | ✅ 实时进度 | ❌ 不支持 | ❌ 不支持 |
| **请求取消** | ✅ 随时取消 | ✅ 支持 | ⚠️ 有限支持 |
| **错误重试** | ✅ 自动重试 | ❌ 手动重连 | ⚠️ 基础重试 |
| **TypeScript** | ✅ 完整类型 | ⚠️ 基础类型 | ⚠️ 类型不全 |

##### 🏆 核心优势总结

1. **🔧 零配置智能解析**：自动处理 SSE 格式、JSON 解析、不完整数据
2. **🚀 全能请求支持**：突破原生 EventSource 的 GET 限制
3. **🛡️ 错误容错机制**：网络异常、数据格式错误不会中断整个流程
4. **📊 实时进度追踪**：知道数据传输进度，提升用户体验
5. **🎯 TypeScript 原生支持**：完整的类型提示，开发效率倍增
6. **🔄 灵活的拦截器**：可以在请求/响应的任何阶段进行自定义处理

这套 SSE 处理方案完美解决了传统方案的痛点，为现代 Web 应用提供了强大而可靠的实时数据处理能力

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

> ⚠️ 注意：配置了signal后，timeout配置将无效，因为自定义控制器会覆盖超时控制器。

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
| `baseUrl` | `string` | `''` | 请求的基础URL |
| `timeout` | `number` | `10000` | 请求超时时间(ms) |
| `retry` | `number` | `0` | 请求失败重试次数 |
| `cacheTimeout` | `number` | `1000` | 缓存过期时间(ms) |
| `headers` | `object` | `{}` | 默认请求头 |
| `reqInterceptor` | `function` | - | 请求拦截器 |
| `respInterceptor` | `function` | - | 响应拦截器 |
| `respErrInterceptor` | `function` | - | 错误拦截器 |
| `onProgress` | `function` | - | 进度回调函数 |

### 请求方法

- **标准请求**: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`
- **缓存请求**: `cacheGet`, `cachePost`, `cachePut`, `cachePatch`
- **SSE请求**: `fetchSSE`

### 工具函数

- **并发控制**: `concurrentTask`

## 🧪 测试与调试

提供了完整的测试系统，包含Web页面交互式测试和自动化测试：

### Web页面测试

```bash
# 进入测试目录
cd packages/test

# 启动开发服务器
pnpm dev
```

访问 `http://localhost:5173` 可体验以下功能测试页面：

- **基础HTTP请求** - `/http-basic` - 测试基础请求方法
- **请求缓存** - `/http-cache` - 测试幂等请求缓存功能
- **请求重试** - `/http-retry` - 测试自动重试机制
- **请求中断** - `/http-abort` - 测试请求中断功能
- **并发请求** - `/http-concurrent` - 测试并发控制
- **SSE流处理** - `/http-sse` - 测试流式数据处理
- **拦截器** - `/http-interceptors` - 测试请求响应拦截

### 自动化测试

```bash
# 运行所有测试
pnpm test

# 生成测试覆盖率报告
pnpm test:coverage

# 使用UI界面运行测试
pnpm test:ui
```

> 📊 测试覆盖率：85%+ 全局覆盖率，95%+ 核心模块覆盖率

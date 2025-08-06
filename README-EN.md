# Modern, Universal, and Flexible HTTP Request Library

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

## ✨ Features

- 🔄 **Request Cancellation** - Cancel ongoing requests at any time
- 💾 **Request Caching** - Optional automatic request caching to improve app performance, reduce server pressure and potential multiple error calls
- 🔁 **Request Retry** - Automatically retry failed requests to enhance application stability
- 🚦 **Concurrency Control** - Easily manage concurrent requests while maintaining result order
- 🧩 **Template Generation** - Quickly generate template code through CLI tools
- 📊 **SSE Stream Processing** - Perfect support for streaming data, especially suitable for AI interfaces, automatic string to JSON conversion, automatic handling of incomplete JSON (because messages are sent bit by bit, completeness is not guaranteed)
- ⏳ **Progress Tracking** - Real-time request progress monitoring for enhanced user experience
- 📦 **Lightweight** - Zero external dependencies, small size, fast loading
- 🔧 **Highly Configurable** - Flexible interceptors and configuration options

## 📦 Installation

```bash
# npm
npm install @jl-org/http

# yarn
yarn add @jl-org/http

# pnpm
pnpm add @jl-org/http
```

## 🚀 Basic Usage

```ts
import { Http } from '@jl-org/http'

/** Create HTTP instance, all default configurations can be overridden in actual requests */
export const iotHttp = new Http({
  /** Cache timeout, default 1 second */
  cacheTimeout: 1000,
  baseUrl: '/iot',
  /** Timeout duration */
  timeout: 10000,
  /** Request retry count on failure, default 0 */
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

// GET request example
iotHttp.get('/device/list', {
  query: {
    page: 1,
    size: 10,
  },
  retry: 5, // Override default retry count
}).then(console.log)

// POST request example
iotHttp.post(
  '/device/add',
  {
    name: 'device1',
    type: 'type1',
  },
  {
    timeout: 2000 // Override default timeout
  }
).then(console.log)
```

## 💾 Request Caching

When making multiple requests to the same endpoint with identical parameters within a short time, jl-http will automatically return cached results without sending new requests:

```ts
/** Cache POST request */
iotHttp.cachePost(
  '/device/add',
  {
    name: 'device1',
    type: 'type1',
  },
  {
    /** Cache timeout, default 1000ms */
    cacheTimeout: 2000
  }
).then(console.log)

/** Cache GET request */
iotHttp.cacheGet('/device/list', {
  query: { page: 1 },
  cacheTimeout: 5000
}).then(console.log)
```

> 📝 Note: Cache is stored in memory and will be lost after page refresh. The system automatically checks and clears expired cache every 2 seconds or when calling interfaces.

## 🌊 SSE Streaming Data Processing

### Basic Usage

Perfect support for SSE streaming data, especially suitable for AI interfaces:

```ts
/** Real-time processing of streaming data */
const { promise, cancel } = await iotHttp.fetchSSE('/ai/chat', {
  method: 'POST',
  body: {
    messages: [{ role: 'user', content: 'Hello' }]
  },
  /** Whether to parse data, remove data: prefix (default true) */
  needParseData: true,
  /** Whether to parse JSON (default true) */
  needParseJSON: true,
  /** Triggered when new data is received */
  onMessage: ({ currentContent, allContent, currentJson, allJson }) => {
    console.log('Current fragment:', currentContent)
    console.log('Accumulated content:', allContent)

    /** If needParseJSON is enabled */
    console.log('Current JSON:', currentJson)
    console.log('Accumulated JSON:', allJson)
  },
  /** Track progress */
  onProgress: (progress) => {
    console.log(`Progress: ${progress * 100}%`)
  },
  /** Error handling */
  onError: (error) => {
    console.error(error)
  },
})

const data = await promise
console.log('Final data:', data)
```

### SSE Advantages of This Library

Before diving into the code implementation, let's first understand the standard specification of **Server-Sent Events (SSE)**:

##### 🔧 SSE Protocol Format

SSE is a unidirectional communication protocol where servers can actively push data to clients. Its data format follows these specifications:

```txt
data: This is data content
event: Event name (optional)
id: Message ID (optional)
retry: Reconnection interval (optional)

data: Another message
```

Each field ends with a newline character, and complete message blocks are separated by **two newlines** (`\n\n`).

##### ⚠️ SSE Data Transmission Unreliability

Due to network transmission characteristics, SSE data streams have the following unreliability issues:

1. **📦 Data Fragment Transmission**: A complete JSON may be transmitted in multiple data chunks
2. **🔀 Ambiguous Message Boundaries**: Data may be cut off at any position
3. **❌ Incomplete Messages**: Data received in a single instance may not be a complete SSE message
4. **🎭 Inconsistent Formats**: Different services may have different data formats

For example, a complete message:
```txt
data: {"name": "John", "age": 25}
```

May be received like this:
```txt
// First reception
"data: {\"name\": \"John"

// Second reception
"\", \"age\": 25}\n\n"
```

##### 5️⃣ Comparison with Other SSE Libraries

| Feature Comparison | 🔥 This Library | 🌐 Native EventSource | 📚 Other Libraries |
|-------------------|-----------------|------------------------|-------------------|
| **HTTP Methods** | ✅ Supports all methods | ❌ GET only | ⚠️ Partial support |
| **Request Body** | ✅ Supports any format | ❌ Not supported | ⚠️ Limited support |
| **Custom Headers** | ✅ Full support | ❌ Not supported | ✅ Supported |
| **Interceptors** | ✅ Request/Response intercept | ❌ Not supported | ❌ Not supported |
| **Auto JSON Parsing** | ✅ Smart parsing | ❌ Manual parsing | ⚠️ Basic parsing |
| **Incomplete Data Handling** | ✅ Buffer mechanism | ❌ May lose data | ⚠️ Simple handling |
| **Progress Tracking** | ✅ Real-time progress | ❌ Not supported | ❌ Not supported |
| **Request Cancellation** | ✅ Cancel anytime | ✅ Supported | ⚠️ Limited support |
| **Error Retry** | ✅ Auto retry | ❌ Manual reconnect | ⚠️ Basic retry |
| **TypeScript** | ✅ Complete types | ⚠️ Basic types | ⚠️ Incomplete types |

##### 🏆 Core Advantages Summary

1. **🔧 Zero-config Smart Parsing**: Automatically handles SSE format, JSON parsing, incomplete data
2. **🚀 Universal Request Support**: Breaks through native EventSource GET limitations
3. **🛡️ Error Tolerance Mechanism**: Network exceptions and data format errors won't interrupt the entire process
4. **📊 Real-time Progress Tracking**: Know data transmission progress, enhance user experience
5. **🎯 Native TypeScript Support**: Complete type hints, multiply development efficiency
6. **🔄 Flexible Interceptors**: Custom processing at any stage of request/response

This SSE processing solution perfectly solves the pain points of traditional solutions, providing powerful and reliable real-time data processing capabilities for modern Web applications

---

## 🛑 Request Cancellation

Easily cancel ongoing requests:

```ts
const controller = new AbortController()

iotHttp.get('/device/list', {
  query: {
    page: 1,
    size: 10,
  },
  signal: controller.signal
})

/** Cancel request when needed */
controller.abort()
```

> ⚠️ Note: When signal is configured, timeout configuration will be ineffective because custom controllers will override timeout controllers.

## 🚦 Concurrent Request Control

Control the number of concurrent requests while maintaining result order:

```ts
import { concurrentTask } from '@jl-org/http'

/** Define multiple request tasks */
const tasks = [
  () => iotHttp.get('/api/data1'),
  () => iotHttp.get('/api/data2'),
  () => iotHttp.get('/api/data3'),
  // ...more tasks
]

/** Execute maximum 2 requests simultaneously, others queue */
const results = await concurrentTask(tasks, 2)

/** Handle results (result order matches task order) */
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Task ${index} succeeded:`, result.value)
  }
  else {
    console.log(`Task ${index} failed:`, result.reason)
  }
})
```

## 📥 Download Resources

```ts
import { downloadByData } from '@jl-org/tool'

const data = await iotHttp.get('/getImg', {
  /** Set to stream if readable stream is needed */
  respType: 'blob'
})
downloadByData(blob.data as Blob, 'test.png')
```

## 🧩 CLI Template Code Generation

Quickly generate API call template code:

```bash
# Using npx
npx jl-http ./test/template.ts ./test/output.ts

# Or using project package manager
pnpm jl-http ./test/template.ts ./test/output.ts
```

**Template Configuration File Example:**

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
      comment: 'Get data list'
    },
    {
      method: 'post',
      name: 'postData',
      url: '/addList',
      isAsync: true,
      args: {
        id: 'number'
      },
      comment: 'Add data'
    }
  ],
})
```

**Generated Code:**

```ts
// output.ts
import { iotHttp } from '@/http/iotHttp'

export class Test {
  /** Get data list */
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

  /** Add data */
  static async postData(data: {
    id: number
  }) {
    return iotHttp.post('/addList', data)
  }
}
```

## 📚 API Documentation

### Http Class Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | `''` | Base URL for requests |
| `timeout` | `number` | `10000` | Request timeout (ms) |
| `retry` | `number` | `0` | Retry count on request failure |
| `cacheTimeout` | `number` | `1000` | Cache expiration time (ms) |
| `headers` | `object` | `{}` | Default request headers |
| `reqInterceptor` | `function` | - | Request interceptor |
| `respInterceptor` | `function` | - | Response interceptor |
| `respErrInterceptor` | `function` | - | Error interceptor |
| `onProgress` | `function` | - | Progress callback function |

### Request Methods

- **Standard Requests**: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`
- **Cache Requests**: `cacheGet`, `cachePost`, `cachePut`, `cachePatch`
- **SSE Requests**: `fetchSSE`

### Utility Functions

- **Concurrency Control**: `concurrentTask`

---

## Node Environment Use Proxy

```bash
pnpm i undici
```

```ts
import { ProxyAgent } from 'undici'

fetchHackProxy()

/**
 * Global replacement
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

---

## 🧪 Testing and Debugging

Provides a complete testing system including interactive web page testing and automated testing:

### Web Page Testing

```bash
# Enter test directory
cd packages/test

# Start development server
pnpm dev
```

Visit http://localhost:5173 to experience the following functional test pages:

- **Basic HTTP Requests** - `/http-basic` - Test basic request methods
- **Request Caching** - `/http-cache` - Test idempotent request caching functionality
- **Request Retry** - `/http-retry` - Test automatic retry mechanism
- **Request Cancellation** - `/http-abort` - Test request cancellation functionality
- **Concurrent Requests** - `/http-concurrent` - Test concurrency control
- **SSE Stream Processing** - `/http-sse` - Test streaming data processing
- **Progress Testing** - `/http-progress` - Test progress tracking
- **Interceptors** - `/http-interceptors` - Test request response interception

### Automated Testing

```bash
# Build core package
pnpm build

# Run all tests
pnpm test
# Run web page tests
pnpm test:page
```

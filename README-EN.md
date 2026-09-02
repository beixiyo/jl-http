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
- 📊 **SSE Incremental Streams** - One-shot async iteration with standard SSE parsing, configurable protocol fields, JSON parsing by default, and configurable limits for incomplete events
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

> 📝 Note: Cache is in-memory and is lost after a page refresh. A global sweep runs every 2 seconds by default to remove expired entries; additionally, each cached request checks and cleans its own expired entry on access. You can configure per-entry TTL via `cacheTimeout` (globally or per request) and the sweep frequency via `cacheSweepInterval`.

## ⚙️ Dynamic Configuration

Instance configuration is not frozen at construction time. `baseUrl`, `headers`, `timeout`,
`retry`, `fetchOption` and `cacheTimeout` accept a synchronous function that is evaluated
once per request:

```ts
const http = new Http({
  baseUrl: () => currentTenant.apiOrigin,
  headers: () => ({ Authorization: `Bearer ${getToken()}` }),
})
```

Any constructor field can also be updated at runtime with `setConfig`. Changes only affect
requests started afterwards:

```ts
http.setConfig({
  baseUrl: '/v2',
  /** headers are merged incrementally; other fields are replaced */
  headers: { 'X-Tenant': 'acme' },
  /** passing undefined explicitly removes the field */
  retry: undefined,
  /** restarts the background sweep timer */
  cacheSweepInterval: 5000,
})

/** Read-only snapshot; function-valued fields are returned as-is */
http.getConfig()

/** Stop the background sweep and clear the cache when the instance is no longer used */
http.dispose()
```

Semantics:

- Priority: per-request options > constructor config (including function results) > built-in defaults
- Interceptors and `Resp.request` always see resolved plain values; per-request options do not accept functions
- In-flight requests, SSE streams and their `reopen()` keep the snapshot taken when they started and are not affected by `setConfig`
- A function-valued `cacheTimeout` is evaluated on every expiry check; `cacheSweepInterval` only accepts a number

## 🌊 SSE Incremental Streams

Starting with `2.0.0`, `fetchSSE` directly returns a one-shot async iterator. Internally, the
library keeps only the current event that has not yet been terminated by a blank line. It no
longer accumulates `allContent`, `allJson`, or raw event history.

```ts
interface AgentEvent {
  type: string
  content?: string
}

const stream = await iotHttp.fetchSSE<AgentEvent>('/ai/chat', {
  method: 'POST',
  body: {
    messages: [{ role: 'user', content: 'Hello' }]
  },
  /** `[DONE]` is not part of the SSE standard; configure it only when the server uses it. */
  doneSignal: '[DONE]',
  /** The standard SSE comment prefix is `:`. */
  commentPrefix: ':',
  onComment: comment => console.log('heartbeat:', comment),
  onActivity: ({ byteLength }) => console.log('received bytes:', byteLength),
})

try {
  for await (const message of stream) {
    console.log('Current event text:', message.dataText)
    console.log('Current event JSON:', message.data)
    console.log('event / id / retry:', message.event, message.id, message.retry)
  }
}
catch (error) {
  /** Network, protocol, and parseData errors are thrown by the iterator. */
  console.error(error)
}
```

Leaving the loop early cancels the current response body and releases its reader. You can also
cancel explicitly:

```ts
stream.cancel(new Error('Stopped by the user'))
```

The parser is also exported from the package root and can be used without making a request:

```ts
import { SSEParser } from '@jl-org/http'
import type { SSEParserOptions } from '@jl-org/http'

const options: SSEParserOptions = {
  /** Non-standard streams may use an exact separator; standard SSE needs no configuration. */
  separator: '<END>',
  /** Customize field matching; returning undefined falls back to the standard rules. */
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

### Protocol and Memory Semantics

- Supports LF, CRLF, CR, arbitrary transport chunk boundaries, and UTF-8 characters split across chunks
- Emits only events completely terminated by a blank line; an incomplete tail is discarded at EOF
- Parses `event`, `id`, `retry`, and comments beginning with `:` according to standard SSE semantics
- `parseData` defaults to `JSON.parse` and may return a Promise; the next event is not read until it settles, so consumers can apply backpressure
- To receive raw strings, explicitly pass `parseData: dataText => dataText`
- `maxBufferSize` limits a single incomplete event; omitting it applies no general size limit
- Normal EOF does not reconnect automatically. An error interceptor opens a new physical connection only when it explicitly calls `reopen()`; it does not replay responses or previously received events

`reopen()` preserves the current request by default and runs the request interceptor again. To
add a cursor or replace the body for the new connection, explicitly override physical request fields:

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

Omitted fields inherit their current values. `headers` and `query` are merged; all other fields are
replaced. Overrides remain active for subsequent connections in the same logical stream. `signal`,
parser options, and interceptors belong to the logical stream lifecycle and cannot be replaced by
`reopen()`. A one-shot `ReadableStream` body must be explicitly replaced by the caller

### Migrating from 1.x

- Remove `fetchSSEAsIterator`; `fetchSSE` itself is now the async iterator
- Remove the `{ promise, cancel }` return shape; iterate the returned stream directly and use `stream.cancel()`
- Remove `onMessage`, `onRawMessage`, `allContent`, `allJson`, `currentContent`, and `currentJson`; aggregate only what the application actually needs
- Remove `needParseData`, `needParseJSON`, and `handleData`; parsing defaults to `JSON.parse`, and other transformations use `parseData`
- Standard SSE is always parsed line by line; configure an exact `separator` only for non-standard event streams
- `[DONE]` is no longer a default; pass it explicitly as `doneSignal` when needed

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

While `fetchSSE` is still connecting (before its Promise resolves), `signal` is the only way to
cancel it. Once you have the stream, both `signal` and `stream.cancel()` stop the current read
and any subsequent `reopen()`.

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
| `baseUrl` | `string \| () => string` | `''` | Base URL for requests |
| `timeout` | `number \| () => number` | `10000` | Request timeout (ms) |
| `retry` | `number \| RetryRequestOptions \| () => ...` | `0` | Retry count on request failure |
| `cacheTimeout` | `number \| () => number` | `1000` | Cache expiration time (ms) |
| `cacheSweepInterval` | `number` | `2000` | Background sweep interval (ms); only affects sweep frequency |
| `headers` | `HeadersInit \| () => HeadersInit` | `{}` | Default request headers |
| `fetchOption` | `RequestInit \| () => RequestInit` | `{}` | Options passed through to fetch, lowest priority |
| `reqInterceptor` | `function` | - | Request interceptor |
| `respInterceptor` | `function` | - | Response interceptor |
| `respErrInterceptor` | `function` | - | Error interceptor |
| `onProgress` | `function` | - | Progress callback function |

Function-valued fields are evaluated once per request; see "Dynamic Configuration" for `setConfig` / `getConfig` / `dispose`.

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

## Common Issues

### 1. Unable to get SSE messages

The default parser follows the SSE standard and recognizes LF, CRLF, and CR line endings.
For a non-standard event boundary, configure an exact `separator` explicitly:

```ts
const stream = await iotHttp.fetchSSE('/ai/chat', {
  method: 'POST',
  body: {
    messages: [{ role: 'user', content: 'Hello' }]
  },
  separator: '<END>',
})

for await (const message of stream)
  console.log(message)
```

You can use the following code to see the complete output
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

/** see the complete output */
console.log(content)
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

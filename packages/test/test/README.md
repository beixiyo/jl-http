# jl-http Vitest 测试套件技术文档

这是 `@jl-org/http` 包的 Vitest 自动化测试套件的详细技术文档，包含测试实现细节、Mock 配置和调试指南

> 📖 **主要文档**: 请参考 `../README.md` 了解完整的测试系统概述和使用说明

## 🏗️ 测试架构

### 测试环境配置

- **测试框架**: Vitest 3.2.4
- **测试环境**: jsdom (模拟浏览器环境)
- **覆盖率工具**: @vitest/coverage-v8
- **Mock 策略**: 全局 Mock + 局部 Mock 结合

### 配置文件

- **vitest.config.ts**: Vitest 主配置文件
- **test/setup.ts**: 全局测试环境设置
- **test.config.ts**: 测试常量和配置

## 📁 详细测试结构

```
test/
├── core/                 # 核心功能测试
│   ├── BaseReq.test.ts   # 基础请求类测试 (95+ 覆盖率)
│   │   ├── 构造函数和配置测试
│   │   ├── HTTP 方法测试 (GET/POST/PUT/DELETE/HEAD/OPTIONS/PATCH)
│   │   ├── 响应类型处理 (JSON/Text/Blob/ArrayBuffer/FormData/Stream)
│   │   ├── 错误处理 (HTTP错误/网络错误/超时)
│   │   ├── 拦截器测试 (请求/响应/错误拦截器)
│   │   ├── 重试机制测试
│   │   ├── 请求中断测试
│   │   └── 自定义头部测试
│   └── Http.test.ts      # HTTP 缓存类测试 (95+ 覆盖率)
│       ├── 构造函数和配置测试
│       ├── 基础 HTTP 方法代理测试
│       ├── 缓存功能测试 (GET/POST/PUT/PATCH)
│       ├── 缓存清理机制测试
│       ├── 错误状态消息测试
│       ├── 缓存与拦截器结合测试
│       └── 缓存键生成测试
├── tools/                # 工具函数测试
│   ├── tool.test.ts      # 基础工具函数测试 (90+ 覆盖率)
│   │   ├── getType() - 类型检测函数
│   │   ├── isObj() - 对象判断函数
│   │   ├── wait() - 等待函数
│   │   └── deepCompare() - 深度比较函数
│   ├── retryTask.test.ts # 重试机制测试 (90+ 覆盖率)
│   │   ├── 成功重试场景
│   │   ├── 失败重试场景
│   │   ├── 延迟重试测试
│   │   └── 错误处理测试
│   ├── concurrentTask.test.ts # 并发任务测试 (90+ 覆盖率)
│   │   ├── 空任务处理
│   │   ├── 并发执行和顺序保持
│   │   ├── 任务失败处理
│   │   └── 并发数限制测试
│   ├── SSEParser.test.ts # SSE 增量协议解析测试
│   │   ├── 任意 chunk 切分与换行格式
│   │   ├── event / id / retry / comment 字段
│   │   ├── EOF 截断与显式结束信号
│   │   └── 单事件缓冲上限
│   └── defineConfig.test.ts # 配置定义测试 (85+ 覆盖率)
│       ├── 配置对象返回测试
│       ├── 完整配置选项测试
│       ├── HTTP 方法支持测试
│       ├── 复杂参数类型测试
│       └── RESTful API 模式测试
├── cli/                  # CLI 工具测试
│   ├── esmTocjs.test.ts  # ES6 到 CommonJS 转换测试 (85+ 覆盖率)
│   │   ├── import 语句转换测试
│   │   ├── export default 转换测试
│   │   ├── 文件写入功能测试
│   │   └── 边界情况处理测试
│   └── genType.test.ts   # 类型生成测试 (85+ 覆盖率)
│       ├── 基本类型生成测试
│       ├── 字面量值类型推断测试
│       ├── 格式化和结构测试
│       ├── 特殊情况处理测试
│       └── 复杂场景测试
├── integration/          # 集成测试
│   ├── http-integration.test.ts # HTTP 功能集成测试 (85+ 覆盖率)
│   │   ├── 缓存与重试集成测试
│   │   ├── 缓存与拦截器集成测试
│   │   ├── 并发请求与缓存集成测试
│   │   ├── 重试与并发集成测试
│   │   ├── 完整工作流集成测试
│   │   └── 性能和内存管理测试
│   └── sse-integration.test.ts  # SSE 功能集成测试 (85+ 覆盖率)
│       ├── BaseReq 与 SSEParser 增量集成测试
│       ├── 异步 parseData 背压
│       ├── 大量事件不累计历史
│       └── 不规则字节切分
├── setup.ts             # 全局测试环境设置
│   ├── Mock 配置 (fetch, performance, AbortController 等)
│   ├── 全局工具函数
│   ├── 自定义匹配器
│   └── 错误处理配置
└── README.md            # 本技术文档
```

## 🛠️ Mock 系统详解

### 全局 Mock 配置 (setup.ts)

```typescript
// 全局 fetch mock
global.fetch = vi.fn()

// performance.now mock
global.performance = {
  now: vi.fn(() => Date.now())
}

// AbortController mock
global.AbortController = class MockAbortController {
  signal = { aborted: false, addEventListener: vi.fn() }
  abort = vi.fn(() => { this.signal.aborted = true })
}

// TextEncoder/TextDecoder mock
global.TextEncoder = class MockTextEncoder {
  encode = vi.fn((text: string) => new Uint8Array([...text].map(c => c.charCodeAt(0))))
}

global.TextDecoder = class MockTextDecoder {
  decode = vi.fn((buffer: Uint8Array) => String.fromCharCode(...buffer))
}

// ReadableStream mock
global.ReadableStream = class MockReadableStream {
  constructor(source: any) {
    this.source = source
  }
  getReader() {
    return {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      releaseLock: vi.fn()
    }
  }
}
```

### 测试工具函数

```typescript
// 创建 mock HTTP 响应
export function createMockResponse(data: any, options: {
  status?: number
  headers?: Record<string, string>
  ok?: boolean
} = {}) {
  return {
    ok: options.ok ?? (options.status ?? 200) < 400,
    status: options.status ?? 200,
    statusText: options.status === 404 ? 'Not Found' : 'OK',
    headers: new Map(Object.entries(options.headers ?? {})),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(data)])),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    formData: vi.fn().mockResolvedValue(new FormData()),
    body: createMockReadableStream(JSON.stringify(data))
  }
}

// 创建 mock SSE 读取器
export function createMockSSEReader(chunks: string[]) {
  let index = 0
  return {
    read: vi.fn().mockImplementation(() => {
      if (index >= chunks.length) {
        return Promise.resolve({ done: true, value: undefined })
      }
      const chunk = chunks[index++]
      const encoder = new TextEncoder()
      return Promise.resolve({
        done: false,
        value: encoder.encode(chunk)
      })
    }),
    releaseLock: vi.fn()
  }
}

// 创建 mock ReadableStream
export function createMockReadableStream(data: string) {
  const chunks = [data]
  let index = 0

  return new ReadableStream({
    start(controller) {
      // 模拟流数据
    },
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[index++]))
      } else {
        controller.close()
      }
    }
  })
}
```

### 自定义匹配器

```typescript
// 扩展 expect 匹配器
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    return {
      message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass
    }
  },

  toBeValidHttpStatus(received: number) {
    const pass = received >= 100 && received < 600
    return {
      message: () => `expected ${received} to be a valid HTTP status code`,
      pass
    }
  },

  toHaveBeenCalledWithFetch(received: any, expectedUrl: string, expectedOptions?: any) {
    const calls = received.mock.calls
    const matchingCall = calls.find(([url, options]: [string, any]) => {
      return url === expectedUrl && (!expectedOptions ||
        JSON.stringify(options) === JSON.stringify(expectedOptions))
    })

    return {
      message: () => `expected fetch to have been called with ${expectedUrl}`,
      pass: !!matchingCall
    }
  }
})
```

## 🐛 调试和故障排除

### VS Code 调试配置

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Vitest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--no-coverage", "--reporter=verbose"],
      "cwd": "${workspaceFolder}/packages/test",
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "test"
      }
    },
    {
      "name": "Debug Single Test File",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}", "--no-coverage"],
      "cwd": "${workspaceFolder}/packages/test",
      "console": "integratedTerminal"
    }
  ]
}
```

### 调试技巧

```typescript
// 1. 使用 console.log 进行调试
it('应该正确处理请求', async () => {
  console.log('🔍 测试开始')
  const result = await http.get('/test')
  console.log('📊 请求结果:', JSON.stringify(result, null, 2))
  console.log('✅ 测试完成')
  expect(result).toBeDefined()
})

// 2. 使用 vi.spyOn 监控函数调用
it('应该调用正确的方法', async () => {
  const spy = vi.spyOn(http, 'get')
  await http.get('/test')

  console.log('🕵️ 函数调用次数:', spy.mock.calls.length)
  console.log('🔍 调用参数:', spy.mock.calls[0])

  expect(spy).toHaveBeenCalledWith('/test')
  spy.mockRestore()
})

// 3. 使用 expect.assertions 确保异步测试完整性
it('应该处理异步错误', async () => {
  expect.assertions(1) // 确保至少有一个断言被执行

  try {
    await http.get('/error')
  } catch (error) {
    console.log('❌ 捕获到错误:', error.message)
    expect(error).toBeInstanceOf(Error)
  }
})
```

### Vitest UI 调试

```bash
# 启动 Vitest UI
pnpm test:ui

# 在浏览器中打开 http://localhost:51204/__vitest__/
# 可以查看：
# - 测试执行状态
# - 测试覆盖率
# - 测试输出日志
# - 错误堆栈信息
```

## 📝 测试编写规范

### 文件命名规范

```
测试类型          | 命名规范                    | 示例
----------------|---------------------------|---------------------------
单元测试         | *.test.ts                 | BaseReq.test.ts
集成测试         | *-integration.test.ts     | http-integration.test.ts
CLI测试          | *.test.ts                 | esmTocjs.test.ts
Mock文件         | *.mock.ts                 | fetch.mock.ts
测试工具         | *.helper.ts               | test.helper.ts
```

### 标准测试结构

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BaseReq } from '@jl-org/http'

describe('BaseReq 基础请求类', () => {
  let baseReq: BaseReq

  beforeEach(() => {
    // 🔧 每个测试前的设置
    vi.clearAllMocks()
    baseReq = new BaseReq({ baseURL: 'https://api.example.com' })
  })

  afterEach(() => {
    // 🧹 每个测试后的清理
    vi.restoreAllMocks()
  })

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      // 📋 Arrange (准备)
      const defaultReq = new BaseReq()

      // 🎬 Act (执行)
      const config = defaultReq.getConfig()

      // ✅ Assert (断言)
      expect(config.timeout).toBe(10000)
      expect(config.responseType).toBe('json')
    })

    it('应该使用自定义配置创建实例', () => {
      // 📋 Arrange
      const customConfig = { timeout: 5000, baseURL: 'https://custom.api' }

      // 🎬 Act
      const customReq = new BaseReq(customConfig)

      // ✅ Assert
      expect(customReq.getConfig().timeout).toBe(5000)
      expect(customReq.getConfig().baseURL).toBe('https://custom.api')
    })
  })

  describe('HTTP 方法', () => {
    beforeEach(() => {
      // Mock fetch for HTTP method tests
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ success: true })
      )
    })

    it('应该正确发送 GET 请求', async () => {
      // 📋 Arrange
      const url = '/users'
      const expectedUrl = 'https://api.example.com/users'

      // 🎬 Act
      const result = await baseReq.get(url)

      // ✅ Assert
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({
        method: 'GET'
      }))
      expect(result).toEqual({ success: true })
    })

    it('应该正确处理请求错误', async () => {
      // 📋 Arrange
      const errorResponse = createMockResponse(
        { error: 'Not Found' },
        { status: 404, ok: false }
      )
      global.fetch = vi.fn().mockResolvedValue(errorResponse)

      // 🎬 Act & Assert
      await expect(baseReq.get('/not-found')).rejects.toThrow('HTTP Error: 404')
    })
  })
})
```

### 测试最佳实践

#### 1. AAA 模式 (Arrange-Act-Assert)

```typescript
it('应该正确计算重试延迟', () => {
  // 📋 Arrange - 准备测试数据和环境
  const retryCount = 3
  const baseDelay = 1000
  const expectedDelay = baseDelay * Math.pow(2, retryCount) // 指数退避

  // 🎬 Act - 执行被测试的功能
  const actualDelay = calculateRetryDelay(retryCount, baseDelay)

  // ✅ Assert - 验证结果
  expect(actualDelay).toBe(expectedDelay)
  expect(actualDelay).toBeWithinRange(8000, 8000) // 1000 * 2^3 = 8000
})
```

#### 2. 描述性测试命名

```typescript
// ❌ 不好的命名
it('test cache', () => {})
it('should work', () => {})

// ✅ 好的命名
it('应该在缓存未命中时发起新请求', () => {})
it('应该在缓存过期后清理过期数据', () => {})
it('应该在并发请求相同资源时返回相同的Promise', () => {})
```

#### 3. 边界情况测试

```typescript
describe('deepCompare 深度比较函数', () => {
  it('应该正确比较基本类型', () => {
    expect(deepCompare(1, 1)).toBe(true)
    expect(deepCompare('a', 'a')).toBe(true)
    expect(deepCompare(true, true)).toBe(true)
  })

  it('应该正确处理 null 和 undefined', () => {
    expect(deepCompare(null, null)).toBe(true)
    expect(deepCompare(undefined, undefined)).toBe(true)
    expect(deepCompare(null, undefined)).toBe(false)
  })

  it('应该正确比较嵌套对象', () => {
    const obj1 = { a: { b: { c: 1 } } }
    const obj2 = { a: { b: { c: 1 } } }
    const obj3 = { a: { b: { c: 2 } } }

    expect(deepCompare(obj1, obj2)).toBe(true)
    expect(deepCompare(obj1, obj3)).toBe(false)
  })

  it('应该正确处理循环引用', () => {
    const obj1: any = { a: 1 }
    obj1.self = obj1

    const obj2: any = { a: 1 }
    obj2.self = obj2

    expect(deepCompare(obj1, obj2)).toBe(true)
  })
})
```

### 常见故障排除

#### 1. 测试超时问题

```typescript
// 设置单个测试的超时时间
it('应该处理长时间运行的任务', async () => {
  // 设置超时时间为 30 秒
  vi.setConfig({ testTimeout: 30000 })

  const result = await longRunningTask()
  expect(result).toBeDefined()
}, 30000) // 也可以在这里设置超时时间

// 或者在配置文件中全局设置
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000
  }
})
```

#### 2. Mock 不生效问题

```typescript
describe('HTTP 请求测试', () => {
  beforeEach(() => {
    // ✅ 正确：在每个测试前清理 mock
    vi.clearAllMocks()

    // ✅ 正确：重新设置 mock
    global.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ data: 'test' })
    )
  })

  afterEach(() => {
    // ✅ 正确：在每个测试后恢复 mock
    vi.restoreAllMocks()
  })

  it('应该发送正确的请求', async () => {
    // 测试代码...
  })
})
```

#### 3. 异步测试问题

```typescript
// ❌ 错误：没有等待异步操作
it('应该处理异步请求', () => {
  http.get('/test').then(result => {
    expect(result).toBeDefined() // 这个断言可能不会执行
  })
})

// ✅ 正确：使用 async/await
it('应该处理异步请求', async () => {
  const result = await http.get('/test')
  expect(result).toBeDefined()
})

// ✅ 正确：使用 expect.assertions 确保断言执行
it('应该处理异步错误', async () => {
  expect.assertions(1) // 确保至少执行一个断言

  try {
    await http.get('/error')
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
  }
})
```

#### 4. 覆盖率问题

```typescript
// 确保测试覆盖所有分支
describe('错误处理', () => {
  it('应该处理网络错误', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'))

    await expect(http.get('/test')).rejects.toThrow('Network Error')
  })

  it('应该处理 HTTP 错误', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ error: 'Not Found' }, { status: 404, ok: false })
    )

    await expect(http.get('/test')).rejects.toThrow('HTTP Error: 404')
  })

  it('应该处理解析错误', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
    })

    await expect(http.get('/test')).rejects.toThrow('Invalid JSON')
  })
})
```

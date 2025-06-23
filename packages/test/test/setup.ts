import { afterEach, beforeEach, expect, vi } from 'vitest'

// 全局测试设置

// Mock console methods to reduce noise in tests
const originalConsole = { ...console }

beforeEach(() => {
  // 重置所有 mocks
  vi.clearAllMocks()

  // 重置 console
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
})

afterEach(() => {
  // 清理定时器
  vi.clearAllTimers()

  // 恢复所有 mocks
  vi.restoreAllMocks()
})

// 全局 fetch mock 设置
const mockFetch = vi.fn()
global.fetch = mockFetch

// 全局 performance mock 设置
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
}
global.performance = mockPerformance as any

// 全局 AbortController mock（如果需要）
if (!global.AbortController) {
  global.AbortController = class AbortController {
    signal = {
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }

    abort() {
      this.signal.aborted = true
    }
  } as any
}

// 全局 TextEncoder/TextDecoder mock（如果需要）
if (!global.TextEncoder) {
  global.TextEncoder = class TextEncoder {
    encode(input: string) {
      return new Uint8Array(Buffer.from(input, 'utf8'))
    }
  } as any
}

if (!global.TextDecoder) {
  global.TextDecoder = class TextDecoder {
    decode(input: Uint8Array) {
      return Buffer.from(input).toString('utf8')
    }
  } as any
}

// 全局 ReadableStream mock（用于 SSE 测试）
if (!global.ReadableStream) {
  global.ReadableStream = class ReadableStream {
    constructor(private source: any) { }

    getReader() {
      return {
        read: this.source?.read || vi.fn(),
        cancel: this.source?.cancel || vi.fn(),
        releaseLock: vi.fn(),
      }
    }
  } as any
}

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// 扩展 expect 匹配器（如果需要）
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },

  toBeValidHttpStatus(received: number) {
    const pass = received >= 100 && received < 600
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid HTTP status code`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid HTTP status code`,
        pass: false,
      }
    }
  },
})

// 类型声明扩展
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeWithinRange(floor: number, ceiling: number): any
      toBeValidHttpStatus(): any
    }
  }
}

// 测试工具函数
export const createMockResponse = (data: any, options: {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  ok?: boolean
} = {}) => {
  const {
    status = 200,
    statusText = 'OK',
    headers = {},
    ok = status >= 200 && status < 300,
  } = options

  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
      has: (name: string) => name.toLowerCase() in headers,
      ...headers,
    },
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
    blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(data)])),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    formData: vi.fn().mockResolvedValue(new FormData()),
  }
}

export const createMockSSEReader = (chunks: string[]) => {
  let index = 0

  return {
    read: vi.fn().mockImplementation(() => {
      if (index < chunks.length) {
        const chunk = chunks[index++]
        return Promise.resolve({
          done: false,
          value: new TextEncoder().encode(chunk),
        })
      } else {
        return Promise.resolve({
          done: true,
          value: undefined,
        })
      }
    }),
    cancel: vi.fn(),
    releaseLock: vi.fn(),
  }
}

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const flushPromises = () => new Promise(resolve => setImmediate(resolve))

// 导出常用的测试工具
export {
  vi,
  expect,
  describe,
  it,
  test,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest'

/**
 * 测试配置文件
 * 定义测试相关的常量和配置
 */

export const TEST_CONFIG = {
  // 测试超时时间
  TIMEOUT: {
    UNIT: 5000,      // 单元测试超时时间
    INTEGRATION: 10000, // 集成测试超时时间
    E2E: 30000,      // 端到端测试超时时间
  },
  
  // 测试环境配置
  ENV: {
    NODE_ENV: 'test',
    API_BASE_URL: 'https://api.test.example.com',
    MOCK_DELAY: 100, // mock 请求延迟时间
  },
  
  // 覆盖率要求
  COVERAGE: {
    GLOBAL: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    CORE: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    TOOLS: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // 测试数据
  MOCK_DATA: {
    USER: {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      active: true,
    },
    API_RESPONSE: {
      success: true,
      data: null,
      message: 'Success',
      code: 200,
    },
    ERROR_RESPONSE: {
      success: false,
      data: null,
      message: 'Error occurred',
      code: 500,
    },
  },
  
  // HTTP 状态码
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
  },
  
  // 测试用的 URL
  TEST_URLS: {
    BASE: '/api/v1',
    USERS: '/api/v1/users',
    USER_DETAIL: '/api/v1/users/:id',
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    UPLOAD: '/api/v1/upload',
    DOWNLOAD: '/api/v1/download/:id',
    SSE_STREAM: '/api/v1/stream',
    WEBSOCKET: '/api/v1/ws',
  },
  
  // 缓存配置
  CACHE: {
    DEFAULT_TIMEOUT: 1000,
    SHORT_TIMEOUT: 500,
    LONG_TIMEOUT: 5000,
  },
  
  // 重试配置
  RETRY: {
    DEFAULT_ATTEMPTS: 3,
    MAX_ATTEMPTS: 5,
    DELAY_MS: 100,
  },
  
  // 并发配置
  CONCURRENT: {
    DEFAULT_LIMIT: 4,
    MAX_LIMIT: 10,
    MIN_LIMIT: 1,
  },
} as const

// 测试工具函数类型
export type MockResponse = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  json: () => Promise<any>
  text: () => Promise<string>
  blob: () => Promise<Blob>
  arrayBuffer: () => Promise<ArrayBuffer>
  formData: () => Promise<FormData>
}

export type MockSSEChunk = {
  data: string
  event?: string
  id?: string
  retry?: number
}

export type TestScenario = {
  name: string
  description: string
  input: any
  expected: any
  shouldThrow?: boolean
  timeout?: number
}

// 常用的测试场景
export const COMMON_SCENARIOS = {
  HTTP_METHODS: [
    { method: 'GET', hasBody: false },
    { method: 'POST', hasBody: true },
    { method: 'PUT', hasBody: true },
    { method: 'PATCH', hasBody: true },
    { method: 'DELETE', hasBody: false },
    { method: 'HEAD', hasBody: false },
    { method: 'OPTIONS', hasBody: false },
  ],
  
  ERROR_SCENARIOS: [
    {
      name: 'Network Error',
      error: new Error('Network error'),
      shouldRetry: true,
    },
    {
      name: 'Timeout Error',
      error: new Error('Request timeout'),
      shouldRetry: true,
    },
    {
      name: 'Server Error',
      status: 500,
      shouldRetry: true,
    },
    {
      name: 'Bad Gateway',
      status: 502,
      shouldRetry: true,
    },
    {
      name: 'Service Unavailable',
      status: 503,
      shouldRetry: true,
    },
    {
      name: 'Gateway Timeout',
      status: 504,
      shouldRetry: true,
    },
    {
      name: 'Client Error',
      status: 400,
      shouldRetry: false,
    },
    {
      name: 'Unauthorized',
      status: 401,
      shouldRetry: false,
    },
    {
      name: 'Forbidden',
      status: 403,
      shouldRetry: false,
    },
    {
      name: 'Not Found',
      status: 404,
      shouldRetry: false,
    },
  ],
  
  CACHE_SCENARIOS: [
    {
      name: 'Cache Hit',
      description: '相同请求应该命中缓存',
      requests: [
        { url: '/test', params: { id: 1 } },
        { url: '/test', params: { id: 1 } },
      ],
      expectedFetchCalls: 1,
    },
    {
      name: 'Cache Miss - Different URL',
      description: '不同URL应该缓存隔离',
      requests: [
        { url: '/test1', params: { id: 1 } },
        { url: '/test2', params: { id: 1 } },
      ],
      expectedFetchCalls: 2,
    },
    {
      name: 'Cache Miss - Different Params',
      description: '不同参数应该缓存隔离',
      requests: [
        { url: '/test', params: { id: 1 } },
        { url: '/test', params: { id: 2 } },
      ],
      expectedFetchCalls: 2,
    },
  ],
  
  SSE_SCENARIOS: [
    {
      name: 'Simple SSE Stream',
      chunks: [
        'data: {"id": 1, "message": "hello"}\n\n',
        'data: {"id": 2, "message": "world"}\n\n',
        'data: [DONE]\n\n',
      ],
      expectedMessages: 2,
    },
    {
      name: 'SSE with Events',
      chunks: [
        'event: start\ndata: {"status": "started"}\n\n',
        'event: progress\ndata: {"percent": 50}\n\n',
        'event: complete\ndata: {"status": "completed"}\n\n',
        'data: [DONE]\n\n',
      ],
      expectedMessages: 3,
    },
    {
      name: 'SSE with Custom Done Signal',
      chunks: [
        'data: {"message": "test1"}\n\n',
        'data: {"message": "test2"}\n\n',
        'data: END\n\n',
      ],
      doneSignal: 'END',
      expectedMessages: 2,
    },
  ],
} as const

// 导出类型
export type HttpMethod = typeof COMMON_SCENARIOS.HTTP_METHODS[number]['method']
export type ErrorScenario = typeof COMMON_SCENARIOS.ERROR_SCENARIOS[number]
export type CacheScenario = typeof COMMON_SCENARIOS.CACHE_SCENARIOS[number]
export type SSEScenario = typeof COMMON_SCENARIOS.SSE_SCENARIOS[number]

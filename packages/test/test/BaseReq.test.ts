// @ts-nocheck
import type { BaseReqConfig } from '@/core/abs/AbsBaseReqType'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseReq } from '@/core/BaseReq'

// Mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// Mock dependencies
vi.mock('@/tools', () => ({
  retryTask: vi.fn(fn => fn()),
}))

vi.mock('@/tools/SSEStreamProcessor', () => ({
  SSEStreamProcessor: vi.fn().mockImplementation(() => ({
    processChunk: vi.fn(),
  })),
}))

vi.mock('@/constants', () => ({
  TIME_OUT: 10000,
}))

describe('baseReq', () => {
  let baseReq: BaseReq
  let mockResponse: Partial<Response>

  beforeEach(() => {
    vi.clearAllMocks()
    baseReq = new BaseReq()

    mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: 'test' }),
      text: vi.fn().mockResolvedValue('test text'),
      blob: vi.fn().mockResolvedValue(new Blob()),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      headers: new Headers(),
      body: null,
    }

    mockFetch.mockResolvedValue(mockResponse)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const req = new BaseReq()
      expect(req).toBeInstanceOf(BaseReq)
    })

    it('应该使用自定义配置创建实例', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: 5000,
        headers: { Authorization: 'Bearer token' },
      }
      const req = new BaseReq(config)
      expect(req).toBeInstanceOf(BaseReq)
    })
  })

  describe('request 方法', () => {
    it('应该发送基本的 GET 请求', async () => {
      const config: BaseReqConfig = {
        url: '/test',
        method: 'GET',
      }

      const result = await baseReq.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'GET',
          headers: {},
        }),
      )
      expect(result).toEqual({
        rawResp: mockResponse,
        data: { data: 'test' },
      })
    })

    it('应该处理带查询参数的请求', async () => {
      const config: BaseReqConfig = {
        url: '/test',
        method: 'GET',
        query: { page: 1, size: 10 },
      }

      await baseReq.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test?page=1&size=10',
        expect.any(Object),
      )
    })

    it('应该处理 POST 请求与 JSON 数据', async () => {
      const config: BaseReqConfig = {
        url: '/test',
        method: 'POST',
        body: { name: 'test', value: 123 },
      }

      await baseReq.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test', value: 123 }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      )
    })

    it('应该处理 FormData', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test']))

      const config: BaseReqConfig = {
        url: '/upload',
        method: 'POST',
        body: formData,
      }

      await baseReq.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        '/upload',
        expect.objectContaining({
          method: 'POST',
          body: formData,
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
        }),
      )
    })

    it('应该处理不同的响应类型', async () => {
      const config: BaseReqConfig = {
        url: '/test',
        method: 'GET',
        respType: 'text',
      }

      const result = await baseReq.request(config)

      expect(mockResponse.text).toHaveBeenCalled()
      expect(result.data).toBe('test text')
    })

    it('应该处理流响应', async () => {
      const mockReader = {
        read: vi.fn(),
        cancel: vi.fn(),
      }
      const mockBody = {
        getReader: vi.fn().mockReturnValue(mockReader),
      }
      mockResponse.body = mockBody as any

      const config: BaseReqConfig = {
        url: '/test',
        method: 'GET',
        respType: 'stream',
      }

      const result = await baseReq.request(config)

      expect(result.reader).toBe(mockReader)
      expect(result.data).toBeNull()
    })

    it('应该处理 HTTP 错误状态', async () => {
      mockResponse.status = 404
      mockResponse.ok = false

      const config: BaseReqConfig = {
        url: '/not-found',
        method: 'GET',
      }

      await expect(baseReq.request(config)).rejects.toBe(mockResponse)
    })

    it('应该使用 baseUrl', async () => {
      const req = new BaseReq({ baseUrl: 'https://api.example.com' })

      const config: BaseReqConfig = {
        url: '/test',
        method: 'GET',
      }

      await req.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.any(Object),
      )
    })

    it('应该处理请求拦截器', async () => {
      const reqInterceptor = vi.fn().mockImplementation(config => ({
        ...config,
        headers: { ...config.headers, 'X-Custom': 'test' },
      }))

      const req = new BaseReq({ reqInterceptor })

      const config: BaseReqConfig = {
        url: '/test',
        method: 'GET',
      }

      await req.request(config)

      expect(reqInterceptor).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'test',
          }),
        }),
      )
    })

    it('应该处理响应拦截器', async () => {
      const respInterceptor = vi.fn().mockImplementation(resp => ({
        ...resp,
        data: { ...resp.data, intercepted: true },
      }))

      const req = new BaseReq({ respInterceptor })

      const config: BaseReqConfig = {
        url: '/test',
        method: 'GET',
      }

      const result = await req.request(config)

      expect(respInterceptor).toHaveBeenCalled()
      expect(result.data.intercepted).toBe(true)
    })

    it('应该处理错误拦截器', async () => {
      const respErrInterceptor = vi.fn()
      mockResponse.status = 500
      mockResponse.ok = false

      const req = new BaseReq({ respErrInterceptor })

      const config: BaseReqConfig = {
        url: '/error',
        method: 'GET',
      }

      try {
        await req.request(config)
      }
      catch (error) {
        expect(respErrInterceptor).toHaveBeenCalledWith(mockResponse)
      }
    })
  })

  describe('hTTP 方法', () => {
    it('应该发送 GET 请求', async () => {
      await baseReq.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('应该发送 HEAD 请求', async () => {
      await baseReq.head('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({ method: 'HEAD' }),
      )
    })

    it('应该发送 POST 请求', async () => {
      const data = { name: 'test' }
      await baseReq.post('/test', data)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        }),
      )
    })

    it('应该发送 PUT 请求', async () => {
      const data = { id: 1, name: 'updated' }
      await baseReq.put('/test/1', data)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      )
    })

    it('应该发送 PATCH 请求', async () => {
      const data = { name: 'patched' }
      await baseReq.patch('/test/1', data)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      )
    })

    it('应该发送 DELETE 请求', async () => {
      await baseReq.delete('/test/1')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test/1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('应该发送 OPTIONS 请求', async () => {
      await baseReq.options('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({ method: 'OPTIONS' }),
      )
    })
  })

  describe('配置合并', () => {
    it('应该使用请求级别的 baseUrl 覆盖默认值', async () => {
      const req = new BaseReq({ baseUrl: 'https://api.example.com' })

      await req.get('/test', {
        baseUrl: 'https://other-api.com',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://other-api.com/test',
        expect.any(Object),
      )
    })
  })
})

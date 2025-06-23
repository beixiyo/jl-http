import { BaseReq } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('BaseReq', () => {
  let baseReq: BaseReq

  beforeEach(() => {
    vi.clearAllMocks()
    baseReq = new BaseReq()
  })

  describe('构造函数和配置', () => {
    it('应该使用默认配置创建实例', () => {
      const req = new BaseReq()
      expect(req).toBeInstanceOf(BaseReq)
    })

    it('应该使用自定义配置创建实例', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      }
      const req = new BaseReq(config)
      expect(req).toBeInstanceOf(BaseReq)
    })
  })

  describe('GET 请求', () => {
    it('应该发送 GET 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await baseReq.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'GET',
        })
      )
      expect(result.data).toEqual({ data: 'test' })
    })

    it('应该处理查询参数', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await baseReq.get('/test', {
        query: { page: 1, size: 10 },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/test?page=1&size=10',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('应该处理 baseUrl', async () => {
      const req = new BaseReq({ baseUrl: 'https://api.example.com' })
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await req.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })
  })

  describe('POST 请求', () => {
    it('应该发送 POST 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const data = { name: 'test', value: 123 }
      const result = await baseReq.post('/test', data)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result.data).toEqual({ success: true })
    })

    it('应该处理 FormData', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const formData = new FormData()
      formData.append('file', 'test')

      await baseReq.post('/upload', formData)

      expect(mockFetch).toHaveBeenCalledWith(
        '/upload',
        expect.objectContaining({
          method: 'POST',
          body: formData,
        })
      )
    })
  })

  describe('PUT 请求', () => {
    it('应该发送 PUT 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ updated: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const data = { id: 1, name: 'updated' }
      await baseReq.put('/test/1', data)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        })
      )
    })
  })

  describe('DELETE 请求', () => {
    it('应该发送 DELETE 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ deleted: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await baseReq.delete('/test/1')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('HEAD 请求', () => {
    it('应该发送 HEAD 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await baseReq.head('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'HEAD',
        })
      )
    })
  })

  describe('OPTIONS 请求', () => {
    it('应该发送 OPTIONS 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await baseReq.options('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'OPTIONS',
        })
      )
    })
  })

  describe('PATCH 请求', () => {
    it('应该发送 PATCH 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ patched: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const data = { name: 'patched' }
      await baseReq.patch('/test/1', data)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(data),
        })
      )
    })
  })

  describe('响应类型处理', () => {
    it('应该处理 JSON 响应', async () => {
      const mockData = { message: 'success' }
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await baseReq.get('/test', { respType: 'json' })
      expect(result.data).toEqual(mockData)
    })

    it('应该处理文本响应', async () => {
      const mockText = 'plain text response'
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockText),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await baseReq.get('/test', { respType: 'text' })
      expect(result.data).toBe(mockText)
    })

    it('应该处理 Blob 响应', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/plain' })
      const mockResponse = {
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(mockBlob),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await baseReq.get('/test', { respType: 'blob' })
      expect(result.data).toBe(mockBlob)
    })

    it('应该处理 ArrayBuffer 响应', async () => {
      const mockBuffer = new ArrayBuffer(8)
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await baseReq.get('/test', { respType: 'arrayBuffer' })
      expect(result.data).toBe(mockBuffer)
    })

    it('应该处理 FormData 响应', async () => {
      const mockFormData = new FormData()
      const mockResponse = {
        ok: true,
        status: 200,
        formData: vi.fn().mockResolvedValue(mockFormData),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await baseReq.get('/test', { respType: 'formData' })
      expect(result.data).toBe(mockFormData)
    })

    it('应该处理流响应', async () => {
      const mockReader = { read: vi.fn() }
      const mockResponse = {
        ok: true,
        status: 200,
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await baseReq.get('/test', { respType: 'stream' })
      expect(result.reader).toBe(mockReader)
      expect(result.data).toBeNull()
    })
  })

  describe('错误处理', () => {
    it('应该处理 HTTP 错误状态', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(baseReq.get('/test')).rejects.toEqual(mockResponse)
    })

    it('应该处理网络错误', async () => {
      const networkError = new Error('Network error')
      mockFetch.mockRejectedValue(networkError)

      await expect(baseReq.get('/test')).rejects.toThrow('Network error')
    })

    it('应该处理超时', async () => {
      vi.useFakeTimers()

      // 模拟一个永远不会 resolve 的 Promise
      mockFetch.mockImplementation(() =>
        new Promise(() => {}) // 永远不会 resolve
      )

      const promise = baseReq.get('/test', { timeout: 1000 })

      // 快进时间触发超时
      await vi.advanceTimersByTimeAsync(1001) // 使用异步版本并稍微超过超时时间

      await expect(promise).rejects.toMatchObject({
        code: 408,
        msg: expect.stringContaining('请求超时'),
      })

      vi.useRealTimers()
    }, 20000) // 增加测试超时时间
  })

  describe('拦截器', () => {
    it('应该执行请求拦截器', async () => {
      const reqInterceptor = vi.fn((config) => {
        config.headers = { ...config.headers, 'X-Custom': 'test' }
        return config
      })

      const req = new BaseReq({ reqInterceptor })

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await req.get('/test')

      expect(reqInterceptor).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'test',
          }),
        })
      )
    })

    it('应该执行响应拦截器', async () => {
      const respInterceptor = vi.fn((resp) => {
        return { ...resp, data: { transformed: true, original: resp.data } }
      })

      const req = new BaseReq({ respInterceptor })

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await req.get('/test')

      expect(respInterceptor).toHaveBeenCalled()
      expect(result.data).toEqual({
        transformed: true,
        original: { data: 'test' },
      })
    })

    it('应该执行错误拦截器', async () => {
      const respErrInterceptor = vi.fn()

      const req = new BaseReq({ respErrInterceptor })

      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(req.get('/test')).rejects.toEqual(mockResponse)
      expect(respErrInterceptor).toHaveBeenCalledWith(mockResponse)
    })
  })

  describe('重试机制', () => {
    it('应该在失败后重试', async () => {
      const req = new BaseReq({ retry: 2 })

      // 模拟第一次失败，第二次成功
      mockFetch
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ success: true }),
        })

      const result = await req.get('/test')

      expect(mockFetch).toHaveBeenCalledTimes(2) // 1 次失败 + 1 次成功
      expect(result.data).toEqual({ success: true })
    })

    it('应该在重试次数用完后抛出错误', async () => {
      const req = new BaseReq({ retry: 2 }) // 设置为 2，意味着最多尝试 2 次（1 次初始 + 1 次重试）

      // 模拟持续的网络错误
      const persistentError = new Error('Persistent error')
      mockFetch.mockRejectedValue(persistentError)

      await expect(req.get('/test')).rejects.toMatchObject({
        name: 'RetryError',
        attempts: 2, // 总尝试次数
        lastError: persistentError,
      })
      expect(mockFetch).toHaveBeenCalledTimes(2) // 1 次初始请求 + 1 次重试
    })
  })

  describe('请求中断', () => {
    it('应该支持请求中断', async () => {
      const controller = new AbortController()

      // 模拟 fetch 被中断
      mockFetch.mockImplementation(() => {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
      })

      // 立即中断信号
      controller.abort()

      await expect(baseReq.get('/test', { signal: controller.signal }))
        .rejects.toThrow('The operation was aborted.')
    }, 15000) // 增加测试超时时间
  })

  describe('自定义头部', () => {
    it('应该设置自定义头部', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await baseReq.get('/test', {
        headers: {
          'Authorization': 'Bearer token',
          'X-Custom-Header': 'custom-value',
        },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token',
            'X-Custom-Header': 'custom-value',
          }),
        })
      )
    })

    it('应该使用请求头部覆盖默认头部', async () => {
      const req = new BaseReq({
        headers: { 'X-Default': 'default-value' },
      })

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await req.get('/test', {
        headers: { 'X-Request': 'request-value' },
      })

      // 根据实际实现，请求头部会覆盖默认头部，而不是合并
      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request': 'request-value',
          }),
        })
      )
    })
  })
})

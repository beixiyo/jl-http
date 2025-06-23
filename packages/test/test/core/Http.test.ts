import { Http } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock performance.now for consistent timing
const mockPerformanceNow = vi.fn()
global.performance = { now: mockPerformanceNow } as any

describe('Http (缓存功能)', () => {
  let http: Http

  beforeEach(() => {
    vi.clearAllMocks()
    mockPerformanceNow.mockReturnValue(1000) // 固定时间戳
    http = new Http({ cacheTimeout: 2000 })
  })

  describe('构造函数和配置', () => {
    it('应该使用默认缓存配置创建实例', () => {
      const instance = new Http({})
      expect(instance).toBeInstanceOf(Http)
    })

    it('应该使用自定义缓存配置创建实例', () => {
      const config = {
        baseUrl: 'https://api.example.com',
        cacheTimeout: 5000,
        timeout: 10000,
      }
      const instance = new Http(config)
      expect(instance).toBeInstanceOf(Http)
    })

    it('应该设置缓存超时时间', () => {
      const instance = new Http({ cacheTimeout: 3000 })
      instance.cacheTimeout = 5000
      // 缓存超时时间应该被更新（通过后续测试验证）
    })

    it('应该拒绝小于1毫秒的缓存时间', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const instance = new Http({})

      instance.cacheTimeout = 0

      expect(consoleSpy).toHaveBeenCalledWith('缓存时间不能小于 1 毫秒')
      consoleSpy.mockRestore()
    })
  })

  describe('基础 HTTP 方法', () => {
    it('应该代理 GET 请求到 BaseReq', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await http.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'GET',
        })
      )
      expect(result.data).toEqual({ data: 'test' })
    })

    it('应该代理 POST 请求到 BaseReq', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const data = { name: 'test' }
      await http.post('/test', data)

      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        })
      )
    })
  })

  describe('缓存 GET 请求', () => {
    it('应该缓存 GET 请求结果', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'cached' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 第一次请求
      const result1 = await http.cacheGet('/test', { query: { page: 1 } })

      // 第二次相同请求应该从缓存返回
      const result2 = await http.cacheGet('/test', { query: { page: 1 } })

      expect(mockFetch).toHaveBeenCalledTimes(1) // 只调用一次 fetch
      expect(result1).toBe(result2) // 返回相同的缓存结果
    })

    it('应该区分不同的查询参数', async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'page1' }),
      }
      const mockResponse2 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'page2' }),
      }

      mockFetch
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)

      // 不同的查询参数应该分别缓存
      const result1 = await http.cacheGet('/test', { query: { page: 1 } })
      const result2 = await http.cacheGet('/test', { query: { page: 2 } })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result1.data).toEqual({ data: 'page1' })
      expect(result2.data).toEqual({ data: 'page2' })
    })

    it('应该在缓存过期后重新请求', async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'first' }),
      }
      const mockResponse2 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'second' }),
      }

      mockFetch
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)

      // 第一次请求
      mockPerformanceNow.mockReturnValue(1000)
      const result1 = await http.cacheGet('/test')

      // 模拟时间过去，缓存过期
      mockPerformanceNow.mockReturnValue(4000) // 超过 2000ms 缓存时间
      const result2 = await http.cacheGet('/test')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result1.data).toEqual({ data: 'first' })
      expect(result2.data).toEqual({ data: 'second' })
    })

    it('应该支持自定义缓存超时时间', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 使用自定义缓存时间
      mockPerformanceNow.mockReturnValue(1000)
      await http.cacheGet('/test', { cacheTimeout: 5000 })

      // 在默认缓存时间内，但在自定义缓存时间内
      mockPerformanceNow.mockReturnValue(3000)
      await http.cacheGet('/test', { cacheTimeout: 5000 })

      expect(mockFetch).toHaveBeenCalledTimes(1) // 应该使用缓存
    })
  })

  describe('缓存 POST 请求', () => {
    it('应该缓存 POST 请求结果', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const data = { name: 'test' }

      // 第一次请求
      const result1 = await http.cachePost('/test', data)

      // 第二次相同请求应该从缓存返回
      const result2 = await http.cachePost('/test', data)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result1).toBe(result2)
    })

    it('应该区分不同的请求体', async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: 'first' }),
      }
      const mockResponse2 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: 'second' }),
      }

      mockFetch
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)

      // 不同的请求体应该分别缓存
      const result1 = await http.cachePost('/test', { id: 1 })
      const result2 = await http.cachePost('/test', { id: 2 })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result1.data).toEqual({ result: 'first' })
      expect(result2.data).toEqual({ result: 'second' })
    })
  })

  describe('缓存 PUT 请求', () => {
    it('应该缓存 PUT 请求结果', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ updated: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const data = { id: 1, name: 'updated' }

      const result1 = await http.cachePut('/test/1', data)
      const result2 = await http.cachePut('/test/1', data)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result1).toBe(result2)
    })
  })

  describe('缓存 PATCH 请求', () => {
    it('应该缓存 PATCH 请求结果', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ patched: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const data = { name: 'patched' }

      const result1 = await http.cachePatch('/test/1', data)
      const result2 = await http.cachePatch('/test/1', data)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result1).toBe(result2)
    })
  })

  describe('缓存清理机制', () => {
    it('应该在缓存过期后重新请求', async () => {
      const mockResponse1 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'first' }),
      }
      const mockResponse2 = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'second' }),
      }

      mockFetch
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)

      // 第一次请求
      mockPerformanceNow.mockReturnValue(1000)
      const result1 = await http.cacheGet('/test')

      // 模拟时间过去，缓存过期
      mockPerformanceNow.mockReturnValue(4000) // 超过 2000ms 缓存时间
      const result2 = await http.cacheGet('/test')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result1.data).toEqual({ data: 'first' })
      expect(result2.data).toEqual({ data: 'second' })
    })

    it('应该正确处理缓存比较', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 相同的复杂对象应该命中缓存
      const complexQuery = {
        filters: { status: 'active', type: 'user' },
        sort: { field: 'name', order: 'asc' },
        pagination: { page: 1, size: 10 }
      }

      const result1 = await http.cacheGet('/test', { query: complexQuery })
      const result2 = await http.cacheGet('/test', { query: { ...complexQuery } })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result1).toBe(result2)
    })
  })

  describe('错误状态消息', () => {
    it('应该返回正确的错误消息', () => {
      expect(Http.getErrMsg(400)).toBe('请求参数错误')
      expect(Http.getErrMsg(401)).toBe('未授权，请重新登录')
      expect(Http.getErrMsg(403)).toBe('禁止访问')
      expect(Http.getErrMsg(404)).toBe('资源不存在')
      expect(Http.getErrMsg(500)).toBe('服务器内部错误')
      expect(Http.getErrMsg(502)).toBe('网关错误')
      expect(Http.getErrMsg(503)).toBe('服务不可用')
      expect(Http.getErrMsg(504)).toBe('网关超时')
    })

    it('应该使用自定义错误消息', () => {
      const customMsg = '自定义错误消息'
      expect(Http.getErrMsg(500, customMsg)).toBe(customMsg)
    })

    it('应该处理未知状态码', () => {
      expect(Http.getErrMsg(999)).toBeUndefined()
    })
  })

  describe('缓存与拦截器结合', () => {
    it('应该在缓存请求中应用拦截器', async () => {
      const reqInterceptor = vi.fn((config) => {
        config.headers = { ...config.headers, 'X-Cache-Test': 'true' }
        return config
      })

      const respInterceptor = vi.fn((resp) => {
        return { ...resp, data: { cached: true, original: resp.data } }
      })

      const httpWithInterceptors = new Http({
        cacheTimeout: 2000,
        reqInterceptor,
        respInterceptor,
      })

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await httpWithInterceptors.cacheGet('/test')

      expect(reqInterceptor).toHaveBeenCalled()
      expect(respInterceptor).toHaveBeenCalled()
      expect(result.data).toEqual({
        cached: true,
        original: { data: 'test' },
      })
    })
  })

  describe('缓存键生成', () => {
    it('应该为相同URL和参数生成相同的缓存键', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 使用不同的对象引用但相同的内容
      const params1 = { page: 1, size: 10 }
      const params2 = { page: 1, size: 10 }

      await http.cacheGet('/test', { query: params1 })
      await http.cacheGet('/test', { query: params2 })

      expect(mockFetch).toHaveBeenCalledTimes(1) // 应该命中缓存
    })

    it('应该为不同URL生成不同的缓存键', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await http.cacheGet('/test1')
      await http.cacheGet('/test2')

      expect(mockFetch).toHaveBeenCalledTimes(2) // 不同URL不应该共享缓存
    })
  })
})

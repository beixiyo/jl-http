import { Http, concurrentTask, retryTask } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock performance.now for consistent timing
const mockPerformanceNow = vi.fn()
global.performance = { now: mockPerformanceNow } as any

describe('HTTP 集成测试', () => {
  let http: Http

  beforeEach(() => {
    vi.clearAllMocks()
    mockPerformanceNow.mockReturnValue(1000)
    http = new Http({
      baseUrl: 'https://api.example.com',
      cacheTimeout: 2000,
      timeout: 5000,
      retry: 2,
    })
  })

  describe('缓存与重试集成', () => {
    it('应该在重试成功后缓存结果', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'success' }),
      }

      // 前两次失败，第三次成功
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockResponse)

      // 第一次请求（会重试）
      const result1 = await http.cacheGet('/test')
      
      // 第二次相同请求应该从缓存返回，不会重新发起请求
      const result2 = await http.cacheGet('/test')

      expect(mockFetch).toHaveBeenCalledTimes(3) // 2次失败 + 1次成功
      expect(result1).toBe(result2) // 返回相同的缓存结果
    })

    it('应该在缓存过期后重新重试', async () => {
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
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse1)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse2)

      // 第一次请求
      mockPerformanceNow.mockReturnValue(1000)
      const result1 = await http.cacheGet('/test')

      // 缓存过期
      mockPerformanceNow.mockReturnValue(4000)
      const result2 = await http.cacheGet('/test')

      expect(mockFetch).toHaveBeenCalledTimes(4) // 第一次：1失败+1成功，第二次：1失败+1成功
      expect(result1.data).toEqual({ data: 'first' })
      expect(result2.data).toEqual({ data: 'second' })
    })
  })

  describe('缓存与拦截器集成', () => {
    it('应该在缓存请求中正确应用拦截器', async () => {
      const reqInterceptor = vi.fn((config) => {
        config.headers = { ...config.headers, 'X-Request-ID': '123' }
        return config
      })
      
      const respInterceptor = vi.fn((resp) => {
        return { ...resp, data: { transformed: true, original: resp.data } }
      })

      const httpWithInterceptors = new Http({
        baseUrl: 'https://api.example.com',
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

      // 第一次请求
      const result1 = await httpWithInterceptors.cacheGet('/test')
      
      // 第二次请求（缓存命中）
      const result2 = await httpWithInterceptors.cacheGet('/test')

      expect(reqInterceptor).toHaveBeenCalledTimes(1) // 只在第一次请求时调用
      expect(respInterceptor).toHaveBeenCalledTimes(1) // 只在第一次请求时调用
      expect(result1).toBe(result2) // 返回相同的缓存结果
      expect(result1.data).toEqual({
        transformed: true,
        original: { data: 'test' },
      })
    })
  })

  describe('并发请求与缓存集成', () => {
    it('应该正确处理并发的缓存请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'concurrent' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 创建多个并发任务
      const tasks = Array.from({ length: 5 }, (_, i) => 
        () => http.cacheGet('/concurrent', { query: { id: i } })
      )

      const results = await concurrentTask(tasks, 3)

      // 所有任务都应该成功
      expect(results.every(r => r.status === 'fulfilled')).toBe(true)
      
      // 每个不同的查询参数都应该发起一次请求
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it('应该正确处理相同参数的并发缓存请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'same-params' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 创建多个相同参数的并发任务
      const tasks = Array.from({ length: 5 }, () => 
        () => http.cacheGet('/same', { query: { id: 1 } })
      )

      const results = await concurrentTask(tasks, 3)

      // 所有任务都应该成功
      expect(results.every(r => r.status === 'fulfilled')).toBe(true)
      
      // 相同参数的请求应该只发起一次（第一个请求），其他的应该等待并使用缓存
      // 注意：由于并发执行，可能会有竞态条件，但至少不会超过任务数
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('重试与并发集成', () => {
    it('应该在并发任务中正确处理重试', async () => {
      // 模拟不稳定的网络环境
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        if (callCount <= 3) {
          return Promise.reject(new Error('Network unstable'))
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ data: `success-${callCount}` }),
        })
      })

      const tasks = [
        () => retryTask(() => http.get('/retry1'), 3),
        () => retryTask(() => http.get('/retry2'), 3),
        () => retryTask(() => http.get('/retry3'), 3),
      ]

      const results = await concurrentTask(tasks, 2)

      // 所有任务最终都应该成功
      expect(results.every(r => r.status === 'fulfilled')).toBe(true)
      
      // 应该有多次重试调用
      expect(mockFetch).toHaveBeenCalledTimes(6) // 3次失败 + 3次成功
    })
  })

  describe('完整工作流集成', () => {
    it('应该支持完整的 HTTP 工作流', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // 配置带有完整功能的 HTTP 实例
      const fullHttp = new Http({
        baseUrl: 'https://api.example.com',
        cacheTimeout: 3000,
        timeout: 10000,
        retry: 2,
        reqInterceptor: (config) => {
          config.headers = { ...config.headers, 'Authorization': 'Bearer token' }
          return config
        },
        respInterceptor: (resp) => {
          return { ...resp, data: { success: true, result: resp.data } }
        },
        respErrInterceptor: (error) => {
          console.log('Request failed:', error)
        },
      })

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ user: { id: 1, name: 'John' } }),
      }

      // 第一次失败，第二次成功
      mockFetch
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(mockResponse)

      // 执行缓存请求（会重试）
      const result = await fullHttp.cacheGet('/user/1', {
        query: { include: 'profile' },
        cacheTimeout: 5000, // 覆盖默认缓存时间
      })

      expect(result.data).toEqual({
        success: true,
        result: { user: { id: 1, name: 'John' } },
      })

      // 验证请求拦截器被调用
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/user/1?include=profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token',
          }),
        })
      )

      // 第二次相同请求应该从缓存返回
      const cachedResult = await fullHttp.cacheGet('/user/1', {
        query: { include: 'profile' },
      })

      expect(cachedResult).toBe(result) // 相同的缓存对象
      expect(mockFetch).toHaveBeenCalledTimes(2) // 1次失败 + 1次成功，没有额外调用

      consoleSpy.mockRestore()
    })

    it('应该处理复杂的错误场景', async () => {
      const respErrInterceptor = vi.fn()
      
      const errorHttp = new Http({
        baseUrl: 'https://api.example.com',
        retry: 1,
        respErrInterceptor,
      })

      // 模拟持续失败
      const mockErrorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }
      mockFetch.mockResolvedValue(mockErrorResponse)

      await expect(errorHttp.get('/error')).rejects.toEqual(mockErrorResponse)
      
      // 错误拦截器应该被调用
      expect(respErrInterceptor).toHaveBeenCalledWith(mockErrorResponse)
      
      // 应该重试一次
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('性能和内存管理', () => {
    it('应该正确清理过期缓存', async () => {
      vi.useFakeTimers()
      
      const testHttp = new Http({ cacheTimeout: 1000 })
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 创建缓存
      mockPerformanceNow.mockReturnValue(1000)
      await testHttp.cacheGet('/test1')
      await testHttp.cacheGet('/test2')
      await testHttp.cacheGet('/test3')

      // 模拟时间过去，触发缓存清理
      mockPerformanceNow.mockReturnValue(3000)
      vi.advanceTimersByTime(2000)

      // 再次请求应该重新发起网络请求
      await testHttp.cacheGet('/test1')

      expect(mockFetch).toHaveBeenCalledTimes(4) // 3次初始 + 1次重新请求
      
      vi.useRealTimers()
    })
  })
})

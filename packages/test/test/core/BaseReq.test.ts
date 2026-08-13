import { BaseReq } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('baseReq', () => {
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

  describe('gET 请求', () => {
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
        }),
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
        }),
      )
    })

    it('应该在已有查询参数后追加 query 并保留 fragment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      })

      await baseReq.get('/test?token=abc#result', {
        query: { page: 1 },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/test?token=abc&page=1#result',
        expect.objectContaining({
          method: 'GET',
        }),
      )
    })

    it('应该使用标准 URL 编码并将数组展开为重复参数', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      })

      await baseReq.get('/test', {
        query: {
          keyword: '中文 + &',
          tag: ['one', 'two'],
          empty: null,
          omitted: undefined,
        },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/test?keyword=%E4%B8%AD%E6%96%87+%2B+%26&tag=one&tag=two',
        expect.objectContaining({
          method: 'GET',
        }),
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
        }),
      )
    })
  })

  describe('pOST 请求', () => {
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
        }),
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
        }),
      )
    })

    it('应该原样上传 Blob 而不是 JSON 序列化', async () => {
      mockFetch.mockResolvedValue(new Response('', { status: 200 }))
      const blob = new Blob(['audio'], { type: 'audio/mp4' })

      await baseReq.put('/upload', blob, {
        headers: { 'Content-Type': blob.type },
        respType: 'text',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/upload',
        expect.objectContaining({
          body: blob,
          headers: expect.objectContaining({ 'Content-Type': 'audio/mp4' }),
        }),
      )
    })
  })

  describe('pUT 请求', () => {
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
        }),
      )
    })
  })

  describe('dELETE 请求', () => {
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
        }),
      )
    })
  })

  describe('hEAD 请求', () => {
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
        }),
      )
    })
  })

  describe('oPTIONS 请求', () => {
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
        }),
      )
    })
  })

  describe('pATCH 请求', () => {
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
        }),
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

      mockFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal.reason))
      }))

      const promise = baseReq.get('/test', { timeout: 1000 })
      const assertion = expect(promise).rejects.toMatchObject({
        code: 408,
        message: expect.stringContaining('请求超时'),
      })

      /** 快进时间触发超时 */
      await vi.advanceTimersByTimeAsync(1001) // 使用异步版本并稍微超过超时时间

      await assertion

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
        }),
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

      /** 创建一个真正的Response对象 */
      const mockResponse = new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
      Object.defineProperty(mockResponse, 'ok', { value: false, writable: false })
      mockFetch.mockResolvedValue(mockResponse)

      await expect(req.get('/test')).rejects.toEqual(mockResponse)
      expect(respErrInterceptor).toHaveBeenCalled()
    })
  })

  describe('重试机制', () => {
    it('应该在失败后重试', async () => {
      const req = new BaseReq({ retry: 2 })

      /** 模拟第一次失败，第二次成功 */
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

      /** 模拟持续的网络错误 */
      const persistentError = new Error('Persistent error')
      mockFetch.mockRejectedValue(persistentError)

      await expect(req.get('/test')).rejects.toMatchObject({
        name: 'RetryError',
        attempts: 2, // 总尝试次数
        lastError: persistentError,
      })
      expect(mockFetch).toHaveBeenCalledTimes(2) // 1 次初始请求 + 1 次重试
    })

    it('不应重试不可恢复的 HTTP 403', async () => {
      mockFetch.mockResolvedValue(new Response('forbidden', { status: 403 }))

      await expect(baseReq.put('/upload', new Blob(['audio']), {
        respType: 'text',
        retry: 3,
      })).rejects.toMatchObject({ attempts: 1 })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('每次超时重试应该使用新的未中止 signal', async () => {
      vi.useFakeTimers()
      const signals: AbortSignal[] = []
      mockFetch
        .mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
          signals.push(options.signal)
          options.signal.addEventListener('abort', () => reject(options.signal.reason))
        }))
        .mockImplementationOnce((_url, options) => {
          signals.push(options.signal)
          return Promise.resolve(new Response('', { status: 200 }))
        })

      const promise = baseReq.put('/upload', new Blob(['audio']), {
        respType: 'text',
        timeout: 1000,
        retry: 2,
      })
      await vi.advanceTimersByTimeAsync(1001)
      await expect(promise).resolves.toMatchObject({ data: '' })
      expect(signals).toHaveLength(2)
      expect(signals[0].aborted).toBe(true)
      expect(signals[1].aborted).toBe(false)
      vi.useRealTimers()
    })

    it('外部取消不应该继续重试', async () => {
      const controller = new AbortController()
      mockFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason))
      }))

      const promise = baseReq.get('/test', { signal: controller.signal, retry: 3 })
      controller.abort()

      await expect(promise).rejects.toMatchObject({ name: 'RetryError', attempts: 1 })
      expect(mockFetch).toHaveBeenCalledTimes(0)
    })
  })

  describe('请求中断', () => {
    it('应该支持请求中断', async () => {
      const controller = new AbortController()

      /** 模拟 fetch 被中断 */
      mockFetch.mockImplementation(() => {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
      })

      /** 立即中断信号 */
      controller.abort()

      await expect(baseReq.get('/test', { signal: controller.signal }))
        .rejects
        .toMatchObject({ name: 'AbortError' })
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
        }),
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

      /** 根据实际实现，请求头部会覆盖默认头部，而不是合并 */
      expect(mockFetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request': 'request-value',
          }),
        }),
      )
    })
  })

  describe('覆盖率补充', () => {
    describe('signal Abort', () => {
      it('应该在外部 signal abort 时中断请求', async () => {
        const controller = new AbortController()
        mockFetch.mockImplementation((_url, options) => {
          const signal = options?.signal
          return new Promise((_resolve, reject) => {
            if (signal?.aborted) {
              reject(new Error('Aborted'))
              return
            }
            signal?.addEventListener('abort', () => reject(new Error('Aborted')))
          })
        })

        const promise = baseReq.get('/test', { signal: controller.signal })
        controller.abort()

        await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
      })
    })

    describe('进度处理 (onProgress)', () => {
      it('当存在 content-length 时，应该正确报告进度', async () => {
        const onProgress = vi.fn()
        const mockReader = {
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2]) })
            .mockResolvedValueOnce({ done: false, value: new Uint8Array([3, 4]) })
            .mockResolvedValueOnce({ done: true }),
        }

        const mockResponse = {
          ok: true,
          headers: new Headers({ 'content-length': '4' }),
          body: {
            getReader: vi.fn().mockReturnValue(mockReader),
          },
          clone() { return this },
          json: vi.fn().mockResolvedValue({ success: true }),
        }
        mockFetch.mockResolvedValue(mockResponse)

        await baseReq.get('/test', { onProgress })

        expect(onProgress).toHaveBeenCalledWith(0.5)
        expect(onProgress).toHaveBeenCalledWith(1.0)
      })

      it('当没有 content-length 时，应该调用 onProgress(-1)', async () => {
        const onProgress = vi.fn()
        const mockResponse = {
          ok: true,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue({ success: true }),
        }
        mockFetch.mockResolvedValue(mockResponse)

        await baseReq.get('/test', { onProgress })

        expect(onProgress).toHaveBeenCalledWith(-1)
      })
    })

    describe('maybeIsConfig 分支', () => {
      it('should handle options with config as second argument', async () => {
        mockFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
        await baseReq.options('/test', { timeout: 1000 })
        expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'OPTIONS' }))
      })

      it('should handle put with config as second argument', async () => {
        mockFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
        await baseReq.put('/test', { timeout: 1000 })
        expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'PUT' }))
      })

      it('should handle patch with config as second argument', async () => {
        mockFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
        await baseReq.patch('/test', { timeout: 1000 })
        expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'PATCH' }))
      })

      it('should handle delete with config as second argument', async () => {
        mockFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
        await baseReq.delete('/test', { timeout: 1000 })
        expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'DELETE' }))
      })
    })

    describe('响应错误适配', () => {
      it('handleRespErrInterceptor 应处理非 Response 错误并提供 text/json 方法', async () => {
        const respErrInterceptor = vi.fn(async (err) => {
          await err.rawResp.text()
          await err.rawResp.json()
        })
        const req = new BaseReq({ respErrInterceptor })

        /** 在 fetchSSE 中，catch 块会调用 handleRespErrInterceptor */
        mockFetch.mockRejectedValue(new Error('SSE Network Error'))

        const { promise } = await req.fetchSSE('/sse')
        await expect(promise).rejects.toThrow('SSE Network Error')
        expect(respErrInterceptor).toHaveBeenCalled()
      })

      it('handleRespErrInterceptor 应处理 error 为 Response 的情况', async () => {
        const respErrInterceptor = vi.fn()
        const req = new BaseReq({ respErrInterceptor })

        const mockResp = { ok: false, status: 401 }
        mockFetch.mockResolvedValue(mockResp)

        await expect(req.get('/test')).rejects.toEqual(mockResp)
        expect(respErrInterceptor).toHaveBeenCalled()
      })
    })

    describe('sSE 异常处理', () => {
      it('fetchSSE 响应不 OK 时应触发 onError 和拦截器', async () => {
        const onError = vi.fn()
        const respErrInterceptor = vi.fn()
        const mockResponse = {
          ok: false,
          status: 500,
        }
        mockFetch.mockResolvedValue(mockResponse)

        const req = new BaseReq({ respErrInterceptor })
        const { promise } = await req.fetchSSE('/sse', { onError })

        await expect(promise).rejects.toEqual(mockResponse)
        expect(onError).toHaveBeenCalledWith(mockResponse)
        expect(respErrInterceptor).toHaveBeenCalled()
      })

      it('fetchSSE 取消应调用 reader.cancel', async () => {
        const mockReader = {
          read: vi.fn().mockReturnValue(new Promise(() => { })),
          cancel: vi.fn(),
        }
        const mockResponse = {
          ok: true,
          body: {
            getReader: vi.fn().mockReturnValue(mockReader),
          },
          headers: new Headers(),
        }
        mockFetch.mockResolvedValue(mockResponse)

        const { promise, cancel } = await baseReq.fetchSSE('/sse')
        cancel()

        expect(mockReader.cancel).toHaveBeenCalled()
        await expect(promise).rejects.toThrow('Request canceled by user')
      })
    })

    describe('sSE Iterator 异常处理', () => {
      it('fetchSSEAsIterator 初始化失败应触发 onError', async () => {
        const onError = vi.fn()
        /** 让 normalizeSSEOpts -> getReqConfig -> reqInterceptor 抛出错误 */
        const req = new BaseReq({
          reqInterceptor: () => { throw new Error('Interceptor failed') },
        })

        const iterator = req.fetchSSEAsIterator('/sse', { onError })
        const result = await iterator.next()

        expect(result.done).toBe(true)
        expect(onError).toHaveBeenCalled()
      })

      it('fetchSSEAsIterator 取消应调用 cancelFn', async () => {
        const mockReader = {
          read: vi.fn().mockReturnValue(new Promise(() => { })),
          cancel: vi.fn(),
        }
        mockFetch.mockResolvedValue({
          ok: true,
          body: { getReader: vi.fn().mockReturnValue(mockReader) },
          headers: new Headers(),
        })

        const iterator = baseReq.fetchSSEAsIterator('/sse')
        /** 启动请求 */
        iterator.next()

        /** 等待 fetchSSE 完成并设置 cancelFn */
        await new Promise(resolve => setTimeout(resolve, 0))

        await iterator.return?.()
        expect(mockReader.cancel).toHaveBeenCalled()
      })
    })

    describe('sSE POST Content-Type', () => {
      it('sSE POST 请求应自动设置 Content-Type', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          body: { getReader: vi.fn().mockReturnValue({ read: vi.fn().mockResolvedValue({ done: true }) }) },
          headers: new Headers(),
        })

        await baseReq.fetchSSE('/sse', { method: 'POST' })

        expect(mockFetch).toHaveBeenCalledWith(
          '/sse',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          }),
        )
      })
    })

    describe('拦截器覆盖', () => {
      it('请求配置中的拦截器应覆盖默认拦截器', async () => {
        const defaultReqInt = vi.fn(c => c)
        const requestReqInt = vi.fn(c => c)
        const defaultRespInt = vi.fn(r => r)
        const requestRespInt = vi.fn(r => r)
        const defaultErrInt = vi.fn()
        const requestErrInt = vi.fn()

        const req = new BaseReq({
          reqInterceptor: defaultReqInt,
          respInterceptor: defaultRespInt,
          respErrInterceptor: defaultErrInt,
        })

        mockFetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ data: 'ok' }),
        })

        await req.get('/test', {
          reqInterceptor: requestReqInt,
          respInterceptor: requestRespInt,
          respErrInterceptor: requestErrInt,
        })

        expect(requestReqInt).toHaveBeenCalled()
        expect(defaultReqInt).not.toHaveBeenCalled()
        expect(requestRespInt).toHaveBeenCalled()
        expect(defaultRespInt).not.toHaveBeenCalled()
      })
    })
  })
})

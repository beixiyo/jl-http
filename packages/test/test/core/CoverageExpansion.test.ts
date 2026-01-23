import { BaseReq } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('baseReq Coverage Expansion', () => {
  let baseReq: BaseReq
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    vi.clearAllMocks()
    baseReq = new BaseReq()
  })

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

      await expect(promise).rejects.toThrow('Aborted')
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

  describe('reqTool 覆盖', () => {
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

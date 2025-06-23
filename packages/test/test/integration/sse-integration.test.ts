import { BaseReq, SSEStreamProcessor } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch and ReadableStream
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SSE 集成测试', () => {
  let baseReq: BaseReq

  beforeEach(() => {
    vi.clearAllMocks()
    baseReq = new BaseReq({
      baseUrl: 'https://api.example.com',
      timeout: 10000,
    })
  })

  describe('BaseReq 与 SSEStreamProcessor 集成', () => {
    it('应该正确处理 SSE 流数据', async () => {
      const sseData = [
        'data: {"id": 1, "message": "Hello"}\n\n',
        'data: {"id": 2, "message": "World"}\n\n',
        'data: [DONE]\n\n',
      ]

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(sseData[0]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(sseData[1]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(sseData[2]),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
        cancel: vi.fn(),
      }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('100'),
        },
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      }

      mockFetch.mockResolvedValue(mockResponse)

      const messages: any[] = []
      const progressUpdates: number[] = []

      const { promise } = await baseReq.fetchSSE('/stream', {
        onMessage: (data) => {
          messages.push(data)
        },
        onProgress: (progress) => {
          progressUpdates.push(progress)
        },
      })

      const finalData = await promise

      // 验证消息处理
      expect(messages).toHaveLength(2) // 不包括 [DONE] 消息
      expect(messages[0].currentJson[0]).toEqual({
        id: 1,
        message: 'Hello',
        __internal__event: '',
      })
      expect(messages[1].currentJson[0]).toEqual({
        id: 2,
        message: 'World',
        __internal__event: '',
      })

      // 验证最终数据
      expect(finalData.allJson).toHaveLength(2)

      // 验证进度更新
      expect(progressUpdates.length).toBeGreaterThan(0)
    })

    it('应该处理 SSE 错误和中断', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"id": 1}\n\n'),
          })
          .mockRejectedValue(new Error('Stream error')),
        cancel: vi.fn(),
      }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      }

      mockFetch.mockResolvedValue(mockResponse)

      const onError = vi.fn()

      const { promise, cancel } = await baseReq.fetchSSE('/stream', {
        onError,
      })

      // 测试中断功能
      setTimeout(() => cancel(), 100)

      await expect(promise).rejects.toThrow()
    })

    it('应该处理自定义 SSE 配置', async () => {
      const customData = [
        'event: custom\ndata: {"type": "custom", "data": "test"}\n\n',
        'event: update\ndata: {"type": "update", "data": "modified"}\n\n',
        'data: END\n\n',
      ]

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(customData[0]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(customData[1]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(customData[2]),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
        cancel: vi.fn(),
      }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      }

      mockFetch.mockResolvedValue(mockResponse)

      const messages: any[] = []

      const { promise } = await baseReq.fetchSSE('/stream', {
        doneSignal: 'END',
        onMessage: (data) => {
          messages.push(data)
        },
        handleData: (content) => content.toUpperCase(),
      })

      const finalData = await promise

      // 验证自定义处理
      expect(messages).toHaveLength(2)
      expect(messages[0].currentJson[0]).toEqual({
        type: 'custom',
        data: 'test',
        __internal__event: 'custom',
      })
      expect(messages[1].currentJson[0]).toEqual({
        type: 'update',
        data: 'modified',
        __internal__event: 'update',
      })

      // 验证自定义数据处理
      expect(finalData.allContent).toContain('{"TYPE": "CUSTOM"')
    })
  })

  describe('SSE 与重试机制集成', () => {
    it('应该在 SSE 连接失败时重试', async () => {
      const req = new BaseReq({
        baseUrl: 'https://api.example.com',
        retry: 2,
      })

      // 前两次失败，第三次成功
      mockFetch
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn().mockReturnValue(null),
          },
          body: {
            getReader: vi.fn().mockReturnValue({
              read: vi.fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode('data: {"success": true}\n\n'),
                })
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode('data: [DONE]\n\n'),
                })
                .mockResolvedValueOnce({
                  done: true,
                  value: undefined,
                }),
              cancel: vi.fn(),
            }),
          },
        })

      const messages: any[] = []

      const { promise } = await req.fetchSSE('/stream', {
        onMessage: (data) => {
          messages.push(data)
        },
      })

      const finalData = await promise

      expect(mockFetch).toHaveBeenCalledTimes(3) // 2次失败 + 1次成功
      expect(messages).toHaveLength(1)
      expect(finalData.allJson[0]).toEqual({
        success: true,
        __internal__event: '',
      })
    })
  })

  describe('SSE 性能和内存管理', () => {
    it('应该正确处理大量 SSE 数据', async () => {
      // 模拟大量数据流
      const largeDataChunks = Array.from({ length: 100 }, (_, i) =>
        `data: {"id": ${i}, "data": "chunk-${i}"}\n\n`
      ).concat(['data: [DONE]\n\n'])

      const mockReader = {
        read: vi.fn(),
        cancel: vi.fn(),
      }

      // 为每个数据块设置 mock 返回值
      largeDataChunks.forEach((chunk, index) => {
        if (index < largeDataChunks.length - 1) {
          mockReader.read.mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunk),
          })
        } else {
          mockReader.read.mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunk),
          })
          mockReader.read.mockResolvedValueOnce({
            done: true,
            value: undefined,
          })
        }
      })

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue(String(largeDataChunks.join('').length)),
        },
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      }

      mockFetch.mockResolvedValue(mockResponse)

      let messageCount = 0
      const progressUpdates: number[] = []

      const { promise } = await baseReq.fetchSSE('/large-stream', {
        onMessage: (data) => {
          messageCount++
          // 验证数据完整性
          expect(data.currentJson).toHaveLength(1)
          expect(data.allJson).toHaveLength(messageCount)
        },
        onProgress: (progress) => {
          progressUpdates.push(progress)
        },
      })

      const finalData = await promise

      expect(messageCount).toBe(100) // 不包括 [DONE]
      expect(finalData.allJson).toHaveLength(100)
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100) // 最终进度应该是 100%
    })

    it('应该正确处理 SSE 流的内存清理', async () => {
      const processor = new SSEStreamProcessor({
        onMessage: vi.fn(),
      })

      // 处理一些数据
      processor.processChunk('data: {"test": 1}\n\n')
      processor.processChunk('data: {"test": 2}\n\n')
      processor.processChunk('data: [DONE]\n\n')

      // 流结束后，处理器应该拒绝新数据
      const result = processor.processChunk('data: {"test": 3}\n\n')

      expect(result.currentRawPayload).toBe('')
      expect(result.currentJson).toEqual([])
      expect(result.isEnd).toBe(true)
    })
  })

  describe('SSE 边界情况', () => {
    it('应该处理不完整的 SSE 数据块', async () => {
      const incompleteData = [
        'data: {"incomplete":', // 不完整的 JSON
        ' "value"}\n\n',        // 完成 JSON
        'data: [DONE]\n\n',
      ]

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(incompleteData[0]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(incompleteData[1]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(incompleteData[2]),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
        cancel: vi.fn(),
      }

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      }

      mockFetch.mockResolvedValue(mockResponse)

      const messages: any[] = []

      const { promise } = await baseReq.fetchSSE('/incomplete-stream', {
        onMessage: (data) => {
          messages.push(data)
        },
      })

      const finalData = await promise

      // 应该正确处理完整的消息
      expect(messages).toHaveLength(1)
      expect(finalData.allJson[0]).toEqual({
        incomplete: 'value',
        __internal__event: '',
      })
    })
  })
})

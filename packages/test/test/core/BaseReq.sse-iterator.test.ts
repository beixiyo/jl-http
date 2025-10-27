import { BaseReq } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 基础流读取器 mock 工具
function createReadableStreamFromChunks(chunks: string[]) {
  const encoder = new TextEncoder()
  const encoded = chunks.map(c => encoder.encode(c))
  let index = 0
  return {
    getReader: () => ({
      read: vi.fn(async () => {
        if (index >= encoded.length) {
          return { done: true, value: undefined as any }
        }
        const value = encoded[index++]
        return { done: false, value }
      }),
      cancel: vi.fn(),
    }),
  }
}

describe('BaseReq.fetchSSEAsIterator', () => {
  const mockFetch = vi.fn()
  // @ts-ignore
  global.fetch = mockFetch

  let req: BaseReq

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    req = new BaseReq()
  })

  it('应该把 SSE 流转为异步迭代器并按消息产出', async () => {
    const chunks = [
      'data: {"step":1}\n\n',
      'data: {"step":2}\n\n',
      'data: [DONE]\n\n',
    ]

    const response = {
      ok: true,
      status: 200,
      headers: new Map([['content-length', '0']]),
      body: createReadableStreamFromChunks(chunks),
    }
    mockFetch.mockResolvedValue(response)

    const it = req.fetchSSEAsIterator('/sse')
    const got: any[] = []
    for await (const msg of it) {
      got.push(msg)
    }

    expect(got).toHaveLength(2)
    expect(got[0].currentJson).toEqual([{ step: 1 }])
    expect(got[1].currentJson).toEqual([{ step: 2 }])
  })

  it('应该在错误时结束迭代并调用 onError', async () => {
    const err = new Error('network')
    mockFetch.mockRejectedValue(err)

    const onError = vi.fn()
    const it = req.fetchSSEAsIterator('/sse', { onError })

    const results: any[] = []
    for await (const v of it) {
      results.push(v)
    }

    expect(onError).toHaveBeenCalled()
    expect(results).toHaveLength(0)
  })
})



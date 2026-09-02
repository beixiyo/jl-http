import { BaseReq } from '@jl-org/http'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('sse 端到端增量数据流', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('大量混合换行事件经过不规则字节分块后保持顺序和完整性', async () => {
    const lineEndings = ['\n', '\r\n', '\r']
    const messages = Array.from({ length: 2_000 }, (_, index) => {
      const eol = lineEndings[index % lineEndings.length]
      return `data: {"index":${index},"text":"消息-${index}"}${eol}${eol}`
    })
    const encoded = new TextEncoder().encode(messages.join(''))
    const chunks = splitBytes(encoded, [1, 2, 3, 5, 8, 13, 21])
    const activityBytes: number[] = []
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createResponse(chunks)))

    const stream = await new BaseReq().fetchSSE<{ index: number, text: string }>('/stream', {
      onActivity: ({ byteLength }) => activityBytes.push(byteLength),
    })
    const indexes: number[] = []
    for await (const message of stream)
      indexes.push(message.data.index)

    expect(indexes).toEqual(Array.from({ length: 2_000 }, (_, index) => index))
    expect(activityBytes.reduce((total, value) => total + value, 0)).toBe(encoded.byteLength)
  })

  it('异步 parseData 完成前不会解析或交付下一事件', async () => {
    const firstParse = Promise.withResolvers<number>()
    let parseCount = 0
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createResponse([
      new TextEncoder().encode('data: 1\n\ndata: 2\n\n'),
    ])))

    const stream = await new BaseReq().fetchSSE<number>('/stream', {
      parseData: async (text) => {
        parseCount++
        if (text === '1')
          return firstParse.promise
        return Number(text)
      },
    })
    const firstNext = stream.next()

    await vi.waitFor(() => expect(parseCount).toBe(1))
    expect(parseCount).toBe(1)
    firstParse.resolve(1)

    await expect(firstNext).resolves.toMatchObject({ value: { data: 1 } })
    expect(parseCount).toBe(1)
    await expect(stream.next()).resolves.toMatchObject({ value: { data: 2 } })
    expect(parseCount).toBe(2)
  })
})

function splitBytes(bytes: Uint8Array, sizes: number[]) {
  const chunks: Uint8Array[] = []
  let offset = 0
  let sizeIndex = 0
  while (offset < bytes.length) {
    const size = sizes[sizeIndex++ % sizes.length]
    chunks.push(bytes.slice(offset, offset + size))
    offset += size
  }
  return chunks
}

function createResponse(chunks: Uint8Array[]) {
  let index = 0
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++]
      if (chunk) {
        controller.enqueue(chunk)
        return
      }
      controller.close()
    },
  }), {
    headers: { 'content-type': 'text/event-stream' },
  })
}

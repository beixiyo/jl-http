import type { SSEMessage, SSEOptions } from '@jl-org/http'
import { BaseReq, SSEContentTypeError, SSEDataParseError } from '@jl-org/http'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('baseReq SSE 增量生命周期', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('默认使用 JSON.parse 逐条产出当前事件，不携带累计历史', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createStreamResponse([
        'data: {"index":1}\n\n',
        'data: {"index":2}\n\n',
      ])),
    )

    const messages = await collect(await new BaseReq().fetchSSE<{ index: number }>('/stream'))

    expect(messages).toEqual([
      {
        data: { index: 1 },
        dataText: '{"index":1}',
        event: 'message',
        id: '',
        retry: undefined,
      },
      {
        data: { index: 2 },
        dataText: '{"index":2}',
        event: 'message',
        id: '',
        retry: undefined,
      },
    ])
  })

  it('收到任意字节时报告活动，并解析跨 chunk 的注释心跳', async () => {
    const onActivity = vi.fn()
    const onComment = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createStreamResponse([
        ': pi',
        'ng\n\n',
        'data: ready\n\n',
      ])),
    )

    const messages = await collect(
      await new BaseReq().fetchSSE('/stream', {
        onActivity,
        onComment,
        parseData: dataText => dataText,
      }),
    )

    expect(messages.map(message => message.data)).toEqual(['ready'])
    expect(onActivity.mock.calls.map(([activity]) => activity.byteLength)).toEqual([4, 4, 13])
    expect(onComment).toHaveBeenCalledExactlyOnceWith('ping')
  })

  it('为 POST 请求设置 SSE 协议头并序列化请求体', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createStreamResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const stream = await new BaseReq().fetchSSE('/agent/run', {
      method: 'POST',
      body: { runId: 'run-1' },
    })
    await collect(stream)

    expect(fetchMock).toHaveBeenCalledWith(
      '/agent/run',
      expect.objectContaining({
        body: JSON.stringify({ runId: 'run-1' }),
        headers: expect.objectContaining({
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('错误拦截器显式 reopen 后重新执行请求拦截器和同一请求体', async () => {
    let tokenVersion = 1
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-1' })
        return Promise.resolve(new Response(null, { status: 401 }))
      })
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-2' })
        return Promise.resolve(createStreamResponse(['data: recovered\n\n']))
      })
    vi.stubGlobal('fetch', fetchMock)

    const req = new BaseReq({
      reqInterceptor: (config) => {
        config.headers.Authorization = `Bearer token-${tokenVersion}`
        return config
      },
      respErrInterceptor: async (error) => {
        expect(error.transport).toBe('sse')
        expect(error.phase).toBe('response')
        tokenVersion = 2
        await error.reopen?.()
      },
    })

    const stream = await req.fetchSSE<string>('/agent/run', {
      method: 'POST',
      body: { runId: 'run-1' },
      parseData: dataText => dataText,
    })

    await expect(collect(stream)).resolves.toMatchObject([{ data: 'recovered' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]?.body).toBe(fetchMock.mock.calls[1][1]?.body)
  })

  it('reopen 可显式覆盖物理请求参数，并继承未修改的 Header 和 Query', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(createStreamResponse(['data: reopened\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    const req = new BaseReq({
      headers: { Authorization: 'Bearer stale-default' },
      respErrInterceptor: async (error) => {
        await error.reopen?.({
          request: {
            url: '/agent/resume',
            query: { cursor: 'next' },
            headers: {
              'AUTHORIZATION': 'Bearer fresh-token',
              'X-Resume-Cursor': 'next',
            },
            body: { runId: 'run-1', attempt: 2 },
            credentials: 'include',
          },
        })
      },
    })

    const messages = await collect(
      await req.fetchSSE<string>('/agent/run', {
        method: 'POST',
        query: { cursor: 'initial', stable: 'yes' },
        headers: {
          'authorization': 'Bearer stale-request',
          'X-Client': 'desktop',
        },
        body: { runId: 'run-1', attempt: 1 },
        parseData: dataText => dataText,
      }),
    )

    expect(messages.map(message => message.data)).toEqual(['reopened'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe('/agent/run?cursor=initial&stable=yes')
    expect(fetchMock.mock.calls[1][0]).toBe('/agent/resume?cursor=next&stable=yes')

    const reopenedInit = fetchMock.mock.calls[1][1]
    const reopenedHeaders = new Headers(reopenedInit?.headers)
    expect(reopenedHeaders.get('Accept')).toBe('text/event-stream')
    expect(reopenedHeaders.get('Content-Type')).toBe('application/json')
    expect(reopenedHeaders.get('X-Client')).toBe('desktop')
    expect(reopenedHeaders.get('X-Resume-Cursor')).toBe('next')
    expect(reopenedHeaders.get('Authorization')).toBe('Bearer fresh-token')
    expect(reopenedInit).toMatchObject({
      body: JSON.stringify({ runId: 'run-1', attempt: 2 }),
      credentials: 'include',
    })
  })

  it('流读取失败可被显式 reopen，失败 reader 会释放锁', async () => {
    const releaseLock = vi.fn()
    const streamError = new Error('stream disconnected')
    const failedResponse = {
      ok: true,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: {
        getReader: () => ({
          read: vi.fn().mockRejectedValue(streamError),
          cancel: vi.fn(),
          releaseLock,
        }),
      },
    } as unknown as Response
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(failedResponse)
      .mockResolvedValueOnce(createStreamResponse(['data: recovered\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    const req = new BaseReq({
      respErrInterceptor: async (error) => {
        expect(error.phase).toBe('stream')
        expect(error.error).toBe(streamError)
        await error.reopen?.()
      },
    })

    const messages = await collect(
      await req.fetchSSE<string>('/agent/run', {
        parseData: dataText => dataText,
      }),
    )

    expect(messages.map(message => message.data)).toEqual(['recovered'])
    expect(releaseLock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('任意单点字节切分和逐字节输入都产生相同事件', async () => {
    const encoded = new TextEncoder().encode([
      ': heartbeat',
      'event: update',
      'id: event-1',
      'retry: 2500',
      'data: {"text":"你",',
      'data: "emoji":"🙂"}',
      '',
      '',
    ].join('\n'))
    const partitions = [
      [encoded],
      Array.from(encoded, byte => Uint8Array.of(byte)),
      ...Array.from(
        { length: encoded.length - 1 },
        (_, index) => [encoded.slice(0, index + 1), encoded.slice(index + 1)],
      ),
    ]

    for (const chunks of partitions) {
      const onComment = vi.fn()
      const messages = await fetchSSEChunks<{ text: string, emoji: string }>(chunks, {
        parseData: JSON.parse,
        onComment,
      })

      expect(messages).toEqual([{
        data: { text: '你', emoji: '🙂' },
        dataText: '{"text":"你",\n"emoji":"🙂"}',
        event: 'update',
        id: 'event-1',
        retry: 2500,
      }])
      expect(onComment).toHaveBeenCalledExactlyOnceWith('heartbeat')
    }
  })

  it('任意字节位置出现 EOF 时只丢弃未完成尾部', async () => {
    const encoder = new TextEncoder()
    const stableEvent = encoder.encode('data: {"stable":true}\n\n')
    const nextEvent = encoder.encode('data: {"text":"你🙂","complete":true}\n\n')

    for (let byteLength = 0; byteLength < nextEvent.byteLength; byteLength++) {
      const messages = await fetchSSEChunks<{ stable: boolean }>([
        stableEvent,
        nextEvent.slice(0, byteLength),
      ], { parseData: JSON.parse })

      expect(messages.map(message => message.data)).toEqual([{ stable: true }])
    }
  })

  it('一个传输 chunk 含大量事件时只按消费者请求解析下一条', async () => {
    const parseData = vi.fn((text: string) => Number(text))
    const body = Array.from({ length: 10_000 }, (_, index) => `data: ${index}\n\n`).join('')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createStreamResponse([body])))

    const stream = await new BaseReq().fetchSSE<number>('/stream', { parseData })
    await expect(stream.next()).resolves.toMatchObject({
      done: false,
      value: { data: 0 },
    })
    expect(parseData).toHaveBeenCalledOnce()

    await stream.return?.()
    expect(parseData).toHaveBeenCalledOnce()
  })

  it('cancel 幂等取消正在读取的 reader，并把标准 signal reason 抛给消费者', async () => {
    const readerStarted = Promise.withResolvers<void>()
    const readResult = Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>()
    const cancel = vi.fn(() => {
      readResult.resolve({ done: true, value: undefined })
    })
    const releaseLock = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: () => ({
            read: () => {
              readerStarted.resolve()
              return readResult.promise
            },
            cancel,
            releaseLock,
          }),
        },
      }),
    )
    const reason = new Error('stop stream')
    const stream = await new BaseReq().fetchSSE('/stream')
    const pendingNext = stream.next()
    await readerStarted.promise

    stream.cancel(reason)
    stream.cancel(reason)

    await expect(pendingNext).rejects.toBe(reason)
    expect(cancel).toHaveBeenCalledOnce()
    expect(releaseLock).toHaveBeenCalledOnce()
  })

  it('尚未开始迭代时 cancel 也会立即释放响应体', async () => {
    const cancel = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: { cancel },
      }),
    )

    const reason = new Error('unused stream')
    const stream = await new BaseReq().fetchSSE('/stream')
    stream.cancel(reason)
    stream.cancel(reason)
    await Promise.resolve()

    expect(cancel).toHaveBeenCalledExactlyOnceWith(reason)
  })

  it('reopen 后释放未消费的非 2xx 响应体', async () => {
    const cancel = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        body: { cancel },
      })
      .mockResolvedValueOnce(createStreamResponse(['data: ok\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    const req = new BaseReq({
      respErrInterceptor: async (error) => {
        await error.reopen?.()
      },
    })
    const stream = await req.fetchSSE<string>('/stream', { parseData: dataText => dataText })

    await expect(collect(stream)).resolves.toMatchObject([{ data: 'ok' }])
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancel 后不再交付同一 chunk 中已解析的剩余事件', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createStreamResponse(['data: 1\n\ndata: 2\n\n'])))
    const reason = new Error('stop stream')
    const received: string[] = []

    const stream = await new BaseReq().fetchSSE<string>('/stream', {
      parseData: (dataText) => {
        stream.cancel(reason)
        return dataText
      },
    })
    const consume = async () => {
      for await (const message of stream) received.push(message.data)
    }

    await expect(consume()).rejects.toBe(reason)
    expect(received).toEqual([])
  })

  it('请求拦截器的修改只作用于当前物理请求，不会累积到 reopen', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(createStreamResponse(['data: ok\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    let attempt = 0
    const req = new BaseReq({
      reqInterceptor: (config) => {
        attempt++
        config.headers['X-Attempt'] = String(attempt)
        config.query = { ...config.query, attempt }
        return config
      },
      respErrInterceptor: async (error) => {
        await error.reopen?.()
      },
    })
    const stream = await req.fetchSSE<string>('/stream', {
      query: { page: 1 },
      parseData: dataText => dataText,
    })

    await expect(collect(stream)).resolves.toMatchObject([{ data: 'ok' }])
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/stream?page=1', '/stream?page=1'])
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ 'Accept': 'text/event-stream', 'X-Attempt': '1' })
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ 'Accept': 'text/event-stream', 'X-Attempt': '2' })
  })

  it('外部 AbortSignal 会取消正在读取的 reader 并透传标准 reason', async () => {
    const readerStarted = Promise.withResolvers<void>()
    const readResult = Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>()
    const cancel = vi.fn(() => {
      readResult.resolve({ done: true, value: undefined })
    })
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: () => ({
            read: () => {
              readerStarted.resolve()
              return readResult.promise
            },
            cancel,
            releaseLock: vi.fn(),
          }),
        },
      }),
    )
    const stream = await new BaseReq().fetchSSE('/stream', { signal: controller.signal })
    const pendingNext = stream.next()
    await readerStarted.promise

    const reason = new Error('external abort')
    controller.abort(reason)

    await expect(pendingNext).rejects.toBe(reason)
    expect(cancel).toHaveBeenCalledExactlyOnceWith(reason)
  })

  it('parseData 错误和错误 Content-Type 都以明确错误类型结束', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(createStreamResponse([
        'data: invalid-json\n\n',
      ])),
    )
    const parseStream = await new BaseReq().fetchSSE('/stream')
    await expect(parseStream.next()).rejects.toBeInstanceOf(SSEDataParseError)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response('{}', {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    await expect(new BaseReq().fetchSSE('/stream')).rejects.toBeInstanceOf(SSEContentTypeError)
  })
})

async function fetchSSEChunks<T = unknown>(chunks: Uint8Array[], config: SSEOptions<T> = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createByteStreamResponse(chunks)))
  return collect(await new BaseReq().fetchSSE<T>('/stream', config))
}

async function collect<T>(stream: AsyncIterable<SSEMessage<T>>) {
  const messages: SSEMessage<T>[] = []
  for await (const message of stream) messages.push(message)
  return messages
}

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return createByteStreamResponse(chunks.map(chunk => encoder.encode(chunk)))
}

function createByteStreamResponse(chunks: Uint8Array[]): Response {
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++]
      if (chunk) {
        controller.enqueue(chunk)
        return
      }

      controller.close()
    },
  })

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream',
    },
  })
}

import { BaseReq, Http } from '@jl-org/http'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('动态实例配置', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('函数形式的 baseUrl 和 headers 在每次请求发起时重新求值', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(createJsonResponse()))
    vi.stubGlobal('fetch', fetchMock)

    let origin = 'https://a.example.com'
    let token = 'token-1'
    const req = new BaseReq({
      baseUrl: () => origin,
      headers: () => ({ Authorization: `Bearer ${token}` }),
    })

    await req.get('/users')
    origin = 'https://b.example.com'
    token = 'token-2'
    await req.get('/users')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://a.example.com/users',
      'https://b.example.com/users',
    ])
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer token-1' })
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer token-2' })
  })

  it('setConfig 只影响之后的请求：headers 增量合并，undefined 删除字段', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(createJsonResponse()))
    vi.stubGlobal('fetch', fetchMock)

    const req = new BaseReq({
      baseUrl: '/v1',
      headers: { 'X-Client': 'desktop', 'X-Trace': 'old' },
    })
    await req.get('/users')

    req.setConfig({
      baseUrl: undefined,
      headers: { 'x-trace': 'new', 'X-Tenant': 'acme' },
    })
    await req.get('/users')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/v1/users', '/users'])
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({
      'X-Client': 'desktop',
      'x-trace': 'new',
      'X-Tenant': 'acme',
    })
    expect(req.getConfig()).toEqual({
      headers: {
        'X-Client': 'desktop',
        'x-trace': 'new',
        'X-Tenant': 'acme',
      },
    })
  })

  it('进行中的 SSE 流 reopen 时沿用发起时的配置快照', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(createSSEResponse('data: ok\n\n'))
    vi.stubGlobal('fetch', fetchMock)

    const req = new BaseReq({
      baseUrl: '/v1',
      respErrInterceptor: async (error) => {
        req.setConfig({ baseUrl: '/v2' })
        await error.reopen?.()
      },
    })
    const stream = await req.fetchSSE<string>('/stream', { parseData: dataText => dataText })
    const messages: string[] = []
    for await (const message of stream) messages.push(message.data)

    expect(messages).toEqual(['ok'])
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/v1/stream', '/v1/stream'])
  })

  it('http.setConfig 转发请求字段，cacheSweepInterval 重启定时器，dispose 幂等释放', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(createJsonResponse()))
    vi.stubGlobal('fetch', fetchMock)

    const http = new Http({ baseUrl: '/v1' })
    expect(vi.getTimerCount()).toBe(1)

    http.setConfig({ baseUrl: '/v2', cacheSweepInterval: 5000 })
    expect(vi.getTimerCount()).toBe(1)
    expect(http.getConfig()).toMatchObject({ baseUrl: '/v2', cacheSweepInterval: 5000 })

    await http.get('/users')
    expect(fetchMock).toHaveBeenLastCalledWith('/v2/users', expect.anything())

    http.dispose()
    http.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('函数形式的 cacheTimeout 在每次过期判断时求值', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(createJsonResponse()))
    vi.stubGlobal('fetch', fetchMock)
    const now = vi.spyOn(performance, 'now')

    let timeout = 5000
    const http = new Http({ cacheTimeout: () => timeout })

    now.mockReturnValue(1000)
    await http.cacheGet('/users')
    now.mockReturnValue(3000)
    await http.cacheGet('/users')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    timeout = 1000
    await http.cacheGet('/users')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    http.dispose()
    now.mockRestore()
  })
})

function createJsonResponse(body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function createSSEResponse(text: string) {
  return new Response(new TextEncoder().encode(text), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

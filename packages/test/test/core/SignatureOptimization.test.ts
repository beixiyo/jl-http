import { Http } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('method Signature Optimization: POST/PUT/PATCH/DELETE', () => {
  let http: Http

  beforeEach(() => {
    vi.clearAllMocks()
    http = new Http({})
  })

  it('should include query parameters in DELETE request when passed as second argument', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    })

    await http.delete('/api/test', { query: { id: 123 } })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('id=123'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('should include query parameters in POST request when passed as second argument (body-less POST)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    })

    await http.post('/api/test', { query: { action: 'sync' } })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('action=sync'),
      expect.objectContaining({
        method: 'POST',
        // When treated as config, body should NOT be the config object itself
        body: undefined,
      }),
    )
  })

  it('should still treat second argument as body if it doesn NOT look like a config', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    })

    const body = { name: 'test' }
    await http.post('/api/test', body)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    )
  })

  it('should work with both body and config in POST', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    })

    const body = { name: 'test' }
    const config = { query: { v: '1' } }
    await http.post('/api/test', body, config)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('v=1'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    )
  })
})

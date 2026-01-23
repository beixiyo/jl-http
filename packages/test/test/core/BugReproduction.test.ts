import { Http } from '@jl-org/http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('bug Reproduction: DELETE with query parameters', () => {
  let http: Http

  beforeEach(() => {
    vi.clearAllMocks()
    http = new Http({})
  })

  it('should include query parameters in DELETE request when passed in config', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const url = '/api/resource'
    const clientId = '12345'

    // According to user's report, they are calling it like this:
    // this.http.delete(url, { query: { client_id: clientId } })
    // @ts-ignore
    await http.delete(url, { query: { client_id: clientId } })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('client_id=12345'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    )
  })

  it('should include query parameters in DELETE request when passed correctly as third argument', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const url = '/api/resource'
    const clientId = '12345'

    // If the user should have passed it as the third argument:
    await http.delete(url, undefined, { query: { client_id: clientId } })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('client_id=12345'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    )
  })
})

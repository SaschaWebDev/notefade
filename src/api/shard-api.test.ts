import { describe, expect, it, vi, beforeEach } from 'vitest'
import { storeShard, fetchShard } from './shard-api'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('storeShard', () => {
  it('sends correct POST request and returns ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'abc12345' }),
    })

    const id = await storeShard('c2hhcmQ', 86400)
    expect(id).toBe('abc12345')

    expect(mockFetch).toHaveBeenCalledWith(
      '/shard',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shard: 'c2hhcmQ', ttl: 86400 }),
      }),
    )
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    await expect(storeShard('shard', 86400)).rejects.toThrow('Failed to store shard: 500')
  })

  it('throws on malformed response (Zod validation)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ wrong: 'shape' }),
    })

    await expect(storeShard('shard', 86400)).rejects.toThrow()
  })
})

describe('fetchShard', () => {
  it('sends correct GET request and returns shard', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ shard: 'c2hhcmQ' }),
    })

    const shard = await fetchShard('abc12345')
    expect(shard).toBe('c2hhcmQ')
    expect(mockFetch).toHaveBeenCalledWith('/shard/abc12345')
  })

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const shard = await fetchShard('nonexistent')
    expect(shard).toBeNull()
  })

  it('throws on non-404 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    await expect(fetchShard('id')).rejects.toThrow('Failed to fetch shard: 500')
  })

  it('throws on malformed response (Zod validation)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ invalid: true }),
    })

    await expect(fetchShard('id')).rejects.toThrow()
  })
})

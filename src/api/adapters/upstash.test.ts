import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createUpstashAdapter } from './upstash'
import type { UpstashConfig } from '../provider-types'

const mockFetch = vi.fn()

const config: UpstashConfig = {
  t: 'upstash',
  u: 'https://test.upstash.io',
  k: 'test-token',
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('upstash adapter', () => {
  it('store: sends POST with shard in body, not URL path', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const adapter = createUpstashAdapter(config)
    const id = await adapter.store('shard-data', 3600)

    expect(id).toMatch(/^[a-f0-9]{16}$/)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.upstash.io',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('"SET"'),
      }),
    )
    // Verify shard is NOT in the URL
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(calledUrl).not.toContain('shard-data')
    // Verify shard IS in the body
    const calledBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string) as string[]
    expect(calledBody).toEqual(['SET', id, 'shard-data', 'EX', '3600'])
  })

  it('store: throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const adapter = createUpstashAdapter(config)
    await expect(adapter.store('shard', 3600)).rejects.toThrow('Upstash store failed: 401')
  })

  it('check: returns true when key exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 1 }),
    })
    const adapter = createUpstashAdapter(config)
    const exists = await adapter.check('abc123')
    expect(exists).toBe(true)
  })

  it('check: returns false when key does not exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 0 }),
    })
    const adapter = createUpstashAdapter(config)
    const exists = await adapter.check('abc123')
    expect(exists).toBe(false)
  })

  it('fetch: uses atomic GETDEL to read and delete in one call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'shard-value' }),
    })
    const adapter = createUpstashAdapter(config)
    const shard = await adapter.fetch('abc123')

    expect(shard).toBe('shard-value')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]?.[0]).toBe('https://test.upstash.io/getdel/abc123')
  })

  it('fetch: returns null when key does not exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: null }),
    })
    const adapter = createUpstashAdapter(config)
    const shard = await adapter.fetch('nonexistent')
    expect(shard).toBeNull()
  })
})

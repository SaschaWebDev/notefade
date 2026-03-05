import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createCloudflareD1Adapter } from '@/api/adapters/cloudflare-d1'
import type { CloudflareD1Config } from '@/api/provider-types'

vi.mock('@/api/shard-id', () => ({
  generateShardId: vi.fn().mockReturnValue('d1testid12345678'),
}))

const mockFetch = vi.fn()

const config: CloudflareD1Config = {
  t: 'cf-d1',
  a: 'test-account',
  d: 'test-db-id',
  k: 'test-token',
}

const expectedUrl = `https://api.cloudflare.com/client/v4/accounts/test-account/d1/database/test-db-id/query`

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('cloudflare-d1 adapter', () => {
  // --- store ---

  it('store: sends POST with SQL INSERT and returns generated ID', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const adapter = createCloudflareD1Adapter(config)
    const id = await adapter.store('shard-data', 3600)

    expect(id).toBe('d1testid12345678')
    expect(mockFetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      }),
    )

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string)
    expect(body.sql).toContain('INSERT INTO shards')
    expect(body.params[0]).toBe('d1testid12345678')
    expect(body.params[1]).toBe('shard-data')
  })

  it('store: throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const adapter = createCloudflareD1Adapter(config)
    await expect(adapter.store('shard', 3600)).rejects.toThrow(
      'Cloudflare D1 store failed: 500',
    )
  })

  // --- check ---

  it('check: returns true when rows found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: [{ results: [{ '1': 1 }] }] }),
    })
    const adapter = createCloudflareD1Adapter(config)
    expect(await adapter.check('abc123')).toBe(true)
  })

  it('check: returns false when results empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: [{ results: [] }] }),
    })
    const adapter = createCloudflareD1Adapter(config)
    expect(await adapter.check('abc123')).toBe(false)
  })

  it('check: returns false on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const adapter = createCloudflareD1Adapter(config)
    expect(await adapter.check('abc123')).toBe(false)
  })

  // --- fetch ---

  it('fetch: returns shard and sends DELETE after', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: [{ results: [{ shard: 'shard-value' }] }],
          }),
      })
      .mockResolvedValueOnce({ ok: true }) // DELETE call

    const adapter = createCloudflareD1Adapter(config)
    const shard = await adapter.fetch('abc123')

    expect(shard).toBe('shard-value')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const deleteBody = JSON.parse(mockFetch.mock.calls[1]?.[1]?.body as string)
    expect(deleteBody.sql).toContain('DELETE FROM shards')
  })

  it('fetch: returns null when no rows', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: [{ results: [] }] }),
    })
    const adapter = createCloudflareD1Adapter(config)
    expect(await adapter.fetch('abc123')).toBeNull()
  })

  it('fetch: returns null when shard is not a string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          result: [{ results: [{ shard: 123 }] }],
        }),
    })
    const adapter = createCloudflareD1Adapter(config)
    expect(await adapter.fetch('abc123')).toBeNull()
  })

  it('fetch: throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    const adapter = createCloudflareD1Adapter(config)
    await expect(adapter.fetch('abc123')).rejects.toThrow(
      'Cloudflare D1 fetch failed: 403',
    )
  })

  // --- delete ---

  it('delete: checks existence then deletes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: [{ results: [{ '1': 1 }] }] }),
      })
      .mockResolvedValueOnce({ ok: true }) // DELETE

    const adapter = createCloudflareD1Adapter(config)
    expect(await adapter.delete('abc123')).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('delete: returns false when not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: [{ results: [] }] }),
    })
    const adapter = createCloudflareD1Adapter(config)
    expect(await adapter.delete('abc123')).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('delete: returns false on non-ok check response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const adapter = createCloudflareD1Adapter(config)
    expect(await adapter.delete('abc123')).toBe(false)
  })
})

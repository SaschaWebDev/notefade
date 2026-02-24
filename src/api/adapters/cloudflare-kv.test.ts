import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createCloudflareKVAdapter } from './cloudflare-kv'
import type { CloudflareKVConfig } from '../provider-types'

const mockFetch = vi.fn()

const config: CloudflareKVConfig = {
  t: 'cf-kv',
  a: 'test-account',
  n: 'test-namespace',
  k: 'test-token',
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('cloudflare-kv adapter', () => {
  it('store: sends PUT with correct URL, headers, and body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const adapter = createCloudflareKVAdapter(config)
    const id = await adapter.store('shard-data', 3600)

    expect(id).toMatch(/^[a-f0-9]{16}$/)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/accounts/test-account/storage/kv/namespaces/test-namespace/values/${id}?expiration_ttl=3600`),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'text/plain',
        }),
        body: 'shard-data',
      }),
    )
  })

  it('store: throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    const adapter = createCloudflareKVAdapter(config)
    await expect(adapter.store('shard', 3600)).rejects.toThrow('Cloudflare KV store failed: 403')
  })

  it('check: returns true on 200', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, ok: true })
    const adapter = createCloudflareKVAdapter(config)
    const exists = await adapter.check('abc123')
    expect(exists).toBe(true)
  })

  it('check: returns false on 404', async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, ok: false })
    const adapter = createCloudflareKVAdapter(config)
    const exists = await adapter.check('abc123')
    expect(exists).toBe(false)
  })

  it('fetch: reads value and deletes after', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('shard-value') })
      .mockResolvedValueOnce({ ok: true }) // DELETE
    const adapter = createCloudflareKVAdapter(config)
    const shard = await adapter.fetch('abc123')

    expect(shard).toBe('shard-value')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const deleteCall = mockFetch.mock.calls[1]
    expect(deleteCall).toBeDefined()
    expect(deleteCall?.[1]).toEqual(
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('fetch: returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const adapter = createCloudflareKVAdapter(config)
    const shard = await adapter.fetch('nonexistent')
    expect(shard).toBeNull()
  })
})

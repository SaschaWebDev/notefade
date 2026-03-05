import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createSupabaseAdapter } from '@/api/adapters/supabase'
import type { SupabaseConfig } from '@/api/provider-types'

const mockFetch = vi.fn()

const config: SupabaseConfig = {
  t: 'supabase',
  u: 'https://test.supabase.co',
  k: 'anon-key',
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('supabase adapter', () => {
  it('store: sends POST with correct body and headers', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const adapter = createSupabaseAdapter(config)
    const id = await adapter.store('shard-data', 3600)

    expect(id).toMatch(/^[a-f0-9]{16}$/)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.supabase.co/rest/v1/shards',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'anon-key',
          Authorization: 'Bearer anon-key',
        }),
      }),
    )

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body)
    expect(body.id).toBe(id)
    expect(body.shard).toBe('shard-data')
    expect(body.expires_at).toBeDefined()
  })

  it('store: throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const adapter = createSupabaseAdapter(config)
    await expect(adapter.store('shard', 3600)).rejects.toThrow('Supabase store failed: 401')
  })

  it('check: returns true when row exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 'abc123' }]),
    })
    const adapter = createSupabaseAdapter(config)
    const exists = await adapter.check('abc123')
    expect(exists).toBe(true)
  })

  it('check: returns false when no rows', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })
    const adapter = createSupabaseAdapter(config)
    const exists = await adapter.check('abc123')
    expect(exists).toBe(false)
  })

  it('fetch: returns shard and deletes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ shard: 'shard-value' }]),
      })
      .mockResolvedValueOnce({ ok: true }) // DELETE
    const adapter = createSupabaseAdapter(config)
    const shard = await adapter.fetch('abc123')

    expect(shard).toBe('shard-value')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const deleteCall = mockFetch.mock.calls[1]
    expect(deleteCall).toBeDefined()
    expect(deleteCall?.[1]).toEqual(
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('fetch: returns null when no rows', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })
    const adapter = createSupabaseAdapter(config)
    const shard = await adapter.fetch('nonexistent')
    expect(shard).toBeNull()
  })
})

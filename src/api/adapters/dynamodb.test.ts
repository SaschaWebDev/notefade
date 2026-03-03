import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createDynamoDBAdapter } from './dynamodb'
import type { DynamoDBConfig } from '../provider-types'

const mockFetch = vi.fn()

const config: DynamoDBConfig = {
  t: 'dynamodb',
  u: 'https://test.execute-api.example.com/prod',
  k: 'test-api-key',
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('dynamodb adapter', () => {
  it('store: injects x-api-key header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'ddb-id-123' }),
    })

    const adapter = createDynamoDBAdapter(config)
    const id = await adapter.store('shard-data', 3600)

    expect(id).toBe('ddb-id-123')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.execute-api.example.com/prod/shard',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'test-api-key',
        }),
      }),
    )
  })

  it('store: does not patch globalThis.fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'ddb-id-123' }),
    })

    const adapter = createDynamoDBAdapter(config)
    const fetchBefore = globalThis.fetch
    await adapter.store('shard-data', 3600)
    expect(globalThis.fetch).toBe(fetchBefore)
  })

  it('check: injects x-api-key header', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 })

    const adapter = createDynamoDBAdapter(config)
    const exists = await adapter.check('test-id')

    expect(exists).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('test.execute-api.example.com/prod/shard/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'test-api-key',
        }),
      }),
    )
  })

  it('fetch: injects x-api-key header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ shard: 'fetched-shard' }),
    })

    const adapter = createDynamoDBAdapter(config)
    const shard = await adapter.fetch('test-id')

    expect(shard).toBe('fetched-shard')
  })

  it('delete: injects x-api-key header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const adapter = createDynamoDBAdapter(config)
    const deleted = await adapter.delete('test-id')

    expect(deleted).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('test.execute-api.example.com/prod/shard/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'test-api-key',
        }),
      }),
    )
  })

  it('check: returns false on non-200', async () => {
    mockFetch.mockResolvedValueOnce({ status: 404 })

    const adapter = createDynamoDBAdapter(config)
    expect(await adapter.check('missing')).toBe(false)
  })

  it('fetch: returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    const adapter = createDynamoDBAdapter(config)
    expect(await adapter.fetch('missing')).toBeNull()
  })
})

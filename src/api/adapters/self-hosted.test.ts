import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../shard-api', () => ({
  storeShard: vi.fn(),
  checkShard: vi.fn(),
  fetchShard: vi.fn(),
  deleteShard: vi.fn(),
}))

import { createSelfHostedAdapter } from './self-hosted'
import { storeShard, checkShard, fetchShard, deleteShard } from '../shard-api'
import type { SelfHostedConfig } from '../provider-types'

const mockStoreShard = vi.mocked(storeShard)
const mockCheckShard = vi.mocked(checkShard)
const mockFetchShard = vi.mocked(fetchShard)
const mockDeleteShard = vi.mocked(deleteShard)

const config: SelfHostedConfig = {
  t: 'self',
  u: 'https://my-server.example.com',
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('self-hosted adapter', () => {
  it('store: delegates to storeShard with config.u', async () => {
    mockStoreShard.mockResolvedValueOnce('new-id')
    const adapter = createSelfHostedAdapter(config)
    const id = await adapter.store('shard-data', 3600)

    expect(id).toBe('new-id')
    expect(mockStoreShard).toHaveBeenCalledWith(
      'shard-data',
      3600,
      'https://my-server.example.com',
    )
  })

  it('check: delegates to checkShard with config.u', async () => {
    mockCheckShard.mockResolvedValueOnce(true)
    const adapter = createSelfHostedAdapter(config)
    const exists = await adapter.check('test-id')

    expect(exists).toBe(true)
    expect(mockCheckShard).toHaveBeenCalledWith(
      'test-id',
      'https://my-server.example.com',
    )
  })

  it('fetch: delegates to fetchShard with config.u', async () => {
    mockFetchShard.mockResolvedValueOnce('shard-value')
    const adapter = createSelfHostedAdapter(config)
    const shard = await adapter.fetch('test-id')

    expect(shard).toBe('shard-value')
    expect(mockFetchShard).toHaveBeenCalledWith(
      'test-id',
      'https://my-server.example.com',
    )
  })

  it('delete: delegates to deleteShard with config.u', async () => {
    mockDeleteShard.mockResolvedValueOnce(true)
    const adapter = createSelfHostedAdapter(config)
    const deleted = await adapter.delete('test-id')

    expect(deleted).toBe(true)
    expect(mockDeleteShard).toHaveBeenCalledWith(
      'test-id',
      'https://my-server.example.com',
    )
  })
})

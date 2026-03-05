import { describe, expect, it } from 'vitest'
import { InMemoryShardStore } from '@worker/shard-store'

describe('InMemoryShardStore', () => {
  it('put/get round-trip returns the shard', async () => {
    const store = new InMemoryShardStore()
    await store.put('abc', 'shard-data', 86400)
    const result = await store.get('abc')
    expect(result).toBe('shard-data')
  })

  it('get returns null for missing shard', async () => {
    const store = new InMemoryShardStore()
    const result = await store.get('nonexistent')
    expect(result).toBeNull()
  })

  it('get deletes shard after first read (one-time)', async () => {
    const store = new InMemoryShardStore()
    await store.put('xyz', 'one-time-data', 3600)

    const first = await store.get('xyz')
    expect(first).toBe('one-time-data')

    const second = await store.get('xyz')
    expect(second).toBeNull()
  })

  it('different IDs are independent', async () => {
    const store = new InMemoryShardStore()
    await store.put('a', 'data-a', 86400)
    await store.put('b', 'data-b', 86400)

    expect(await store.get('a')).toBe('data-a')
    expect(await store.get('b')).toBe('data-b')
    // Both consumed
    expect(await store.get('a')).toBeNull()
    expect(await store.get('b')).toBeNull()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { deriveKvKey } from '@worker/kv-key'
import { CloudflareKVShardStore } from '@worker/shard-store'

const SECRET = 'a0b1c2d3e4f5061728394a5b6c7d8e9fa0b1c2d3e4f5061728394a5b6c7d8e9f'
const OTHER_SECRET = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
const SHARD_ID = 'aabbccdd11223344'

describe('deriveKvKey', () => {
  it('returns the input unchanged when secret is undefined', async () => {
    expect(await deriveKvKey(undefined, SHARD_ID)).toBe(SHARD_ID)
  })

  it('returns the input unchanged when secret is empty string', async () => {
    expect(await deriveKvKey('', SHARD_ID)).toBe(SHARD_ID)
  })

  it('returns a base64url string when a secret is provided', async () => {
    const key = await deriveKvKey(SECRET, SHARD_ID)
    expect(key).not.toBe(SHARD_ID)
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/)
    // HMAC-SHA256 → 32 bytes → 43 chars base64url (no padding)
    expect(key.length).toBe(43)
  })

  it('is deterministic — same input produces same output', async () => {
    const a = await deriveKvKey(SECRET, SHARD_ID)
    const b = await deriveKvKey(SECRET, SHARD_ID)
    expect(a).toBe(b)
  })

  it('different secrets produce different keys for the same id', async () => {
    const a = await deriveKvKey(SECRET, SHARD_ID)
    const b = await deriveKvKey(OTHER_SECRET, SHARD_ID)
    expect(a).not.toBe(b)
  })

  it('different ids produce different keys for the same secret', async () => {
    const a = await deriveKvKey(SECRET, 'aabbccdd11223344')
    const b = await deriveKvKey(SECRET, 'ffeeddcc99887766')
    expect(a).not.toBe(b)
  })

  it('separates the activated marker namespace from the shard namespace', async () => {
    const shardKey = await deriveKvKey(SECRET, SHARD_ID)
    const markerKey = await deriveKvKey(SECRET, `activated:${SHARD_ID}`)
    expect(shardKey).not.toBe(markerKey)
  })
})

describe('CloudflareKVShardStore HMAC indirection', () => {
  function mockKv() {
    return {
      put: vi.fn<KVNamespace['put']>().mockResolvedValue(undefined),
      get: vi.fn<(key: string) => Promise<string | null>>().mockResolvedValue(null),
      delete: vi.fn<KVNamespace['delete']>().mockResolvedValue(undefined),
    } as unknown as KVNamespace
  }

  it('without secret: stores under the literal shardId', async () => {
    const kv = mockKv()
    const store = new CloudflareKVShardStore(kv)
    await store.put(SHARD_ID, 'shard-data', 3600)
    expect(kv.put).toHaveBeenCalledWith(SHARD_ID, 'shard-data', { expirationTtl: 3600 })
  })

  it('with secret: stores under HMAC(secret, shardId), not the literal id', async () => {
    const kv = mockKv()
    const store = new CloudflareKVShardStore(kv, SECRET)
    await store.put(SHARD_ID, 'shard-data', 3600)

    const expectedKey = await deriveKvKey(SECRET, SHARD_ID)
    expect(kv.put).toHaveBeenCalledWith(expectedKey, 'shard-data', { expirationTtl: 3600 })
    // sanity: the literal shardId must NOT appear as a KV key
    expect((kv.put as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).not.toBe(SHARD_ID)
  })

  it('with secret: get reads under HMAC(secret, shardId) and round-trips', async () => {
    const kv = mockKv()
    ;(kv.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('shard-data')
    const store = new CloudflareKVShardStore(kv, SECRET)
    const value = await store.get(SHARD_ID)
    expect(value).toBe('shard-data')

    const expectedKey = await deriveKvKey(SECRET, SHARD_ID)
    expect(kv.get).toHaveBeenCalledWith(expectedKey)
    expect(kv.delete).toHaveBeenCalledWith(expectedKey)
  })

  it('with secret: exists checks under HMAC(secret, shardId)', async () => {
    const kv = mockKv()
    ;(kv.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('shard-data')
    const store = new CloudflareKVShardStore(kv, SECRET)
    const found = await store.exists(SHARD_ID)
    expect(found).toBe(true)

    const expectedKey = await deriveKvKey(SECRET, SHARD_ID)
    expect(kv.get).toHaveBeenCalledWith(expectedKey)
    // exists must NOT delete
    expect(kv.delete).not.toHaveBeenCalled()
  })

  it('with secret: delete works against HMAC(secret, shardId)', async () => {
    const kv = mockKv()
    ;(kv.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('shard-data')
    const store = new CloudflareKVShardStore(kv, SECRET)
    const deleted = await store.delete(SHARD_ID)
    expect(deleted).toBe(true)

    const expectedKey = await deriveKvKey(SECRET, SHARD_ID)
    expect(kv.get).toHaveBeenCalledWith(expectedKey)
    expect(kv.delete).toHaveBeenCalledWith(expectedKey)
  })

  it('with secret: put then get round-trips against the same derived key', async () => {
    const kv = mockKv()
    let stored: string | null = null
    ;(kv.put as ReturnType<typeof vi.fn>).mockImplementation(async (_key, value) => {
      stored = value as string
    })
    ;(kv.get as ReturnType<typeof vi.fn>).mockImplementation(async () => stored)

    const store = new CloudflareKVShardStore(kv, SECRET)
    await store.put(SHARD_ID, 'one-time-data', 3600)
    const got = await store.get(SHARD_ID)
    expect(got).toBe('one-time-data')
  })
})

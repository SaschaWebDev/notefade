import { describe, expect, it, vi, beforeEach } from 'vitest'
import { checkKeyRateLimit } from '@worker/rate-limit-kv'

function createMockKv() {
  const store = new Map<string, string>()
  return {
    get: vi.fn<(key: string) => Promise<string | null>>().mockImplementation(
      async (key: string) => store.get(key) ?? null,
    ),
    put: vi.fn<(key: string, value: string, options?: object) => Promise<void>>().mockImplementation(
      async (key: string, value: string) => { store.set(key, value) },
    ),
    _store: store,
  }
}

describe('checkKeyRateLimit', () => {
  it('allows first request and returns remaining count', async () => {
    const kv = createMockKv()
    const result = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001')

    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(60)
    expect(result.remaining).toBe(59)
    expect(result.resetAt).toBeGreaterThan(0)
  })

  it('allows requests under the limit', async () => {
    const kv = createMockKv()

    // Simulate 5 prior requests in the same bucket
    const bucket = Math.floor(Date.now() / 60000)
    kv._store.set(`rl:k_001:${bucket}`, '5')

    const result = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(54) // 60 - 6
  })

  it('blocks requests at the limit', async () => {
    const kv = createMockKv()
    const bucket = Math.floor(Date.now() / 60000)
    kv._store.set(`rl:k_001:${bucket}`, '60')

    const result = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('blocks requests over the limit', async () => {
    const kv = createMockKv()
    const bucket = Math.floor(Date.now() / 60000)
    kv._store.set(`rl:k_001:${bucket}`, '100')

    const result = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('uses custom limit when provided', async () => {
    const kv = createMockKv()
    const bucket = Math.floor(Date.now() / 60000)
    kv._store.set(`rl:k_001:${bucket}`, '10')

    const result = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001', 10)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(10)
  })

  it('allows under custom limit', async () => {
    const kv = createMockKv()
    const bucket = Math.floor(Date.now() / 60000)
    kv._store.set(`rl:k_001:${bucket}`, '5')

    const result = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001', 10)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(4) // 10 - 6
  })

  it('writes counter to KV with expiration TTL', async () => {
    const kv = createMockKv()
    await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001')

    expect(kv.put).toHaveBeenCalledWith(
      expect.stringMatching(/^rl:k_001:\d+$/),
      '1',
      { expirationTtl: 120 },
    )
  })

  it('fail-open: allows request when KV read throws', async () => {
    const kv = createMockKv()
    kv.get.mockRejectedValueOnce(new Error('KV unavailable'))

    const result = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(60)
  })

  it('fail-open: allows request when KV write throws', async () => {
    const kv = createMockKv()
    kv.put.mockRejectedValueOnce(new Error('KV write failed'))

    // This should still allow since the error is caught
    const result = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001')
    expect(result.allowed).toBe(true)
  })

  it('isolates rate limits between different keys', async () => {
    const kv = createMockKv()
    const bucket = Math.floor(Date.now() / 60000)
    kv._store.set(`rl:k_001:${bucket}`, '60')

    // k_001 should be blocked
    const result1 = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_001')
    expect(result1.allowed).toBe(false)

    // k_002 should be allowed (separate counter)
    const result2 = await checkKeyRateLimit(kv as unknown as KVNamespace, 'k_002')
    expect(result2.allowed).toBe(true)
  })
})

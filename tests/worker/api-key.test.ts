import { describe, expect, it, vi, beforeEach } from 'vitest'
import { validateApiKey } from '@worker/api-key'

function createMockKv() {
  const store = new Map<string, string>()
  return {
    get: vi.fn<(key: string) => Promise<string | null>>().mockImplementation(
      async (key: string) => store.get(key) ?? null,
    ),
    put: vi.fn<(key: string, value: string, options?: object) => Promise<void>>().mockResolvedValue(undefined),
    _store: store,
  }
}

// Pre-computed: SHA-256 of "nfk_00112233445566778899aabbccddeeff"
const TEST_KEY = 'nfk_00112233445566778899aabbccddeeff'
let TEST_KEY_HASH: string

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i]! >>> 0).toString(16).padStart(2, '0')
  }
  return hex
}

beforeEach(async () => {
  TEST_KEY_HASH = await sha256Hex(TEST_KEY)
})

describe('validateApiKey', () => {
  it('returns key result for valid key', async () => {
    const kv = createMockKv()
    kv._store.set(`apikeylookup:${TEST_KEY_HASH}`, 'k_001')
    kv._store.set('apikey:k_001', JSON.stringify({
      hash: TEST_KEY_HASH,
      name: 'TestApp',
      createdAt: 1710000000,
    }))

    const result = await validateApiKey(kv as unknown as KVNamespace, TEST_KEY)
    expect(result).toEqual({
      keyId: 'k_001',
      name: 'TestApp',
      limits: undefined,
    })
  })

  it('returns key result with custom limits', async () => {
    const kv = createMockKv()
    kv._store.set(`apikeylookup:${TEST_KEY_HASH}`, 'k_002')
    kv._store.set('apikey:k_002', JSON.stringify({
      hash: TEST_KEY_HASH,
      name: 'LimitedApp',
      createdAt: 1710000000,
      limits: { postPerMin: 30 },
    }))

    const result = await validateApiKey(kv as unknown as KVNamespace, TEST_KEY)
    expect(result).toEqual({
      keyId: 'k_002',
      name: 'LimitedApp',
      limits: { postPerMin: 30 },
    })
  })

  it('returns null for revoked key', async () => {
    const kv = createMockKv()
    kv._store.set(`apikeylookup:${TEST_KEY_HASH}`, 'k_001')
    kv._store.set('apikey:k_001', JSON.stringify({
      hash: TEST_KEY_HASH,
      name: 'TestApp',
      createdAt: 1710000000,
      revokedAt: 1710100000,
    }))

    const result = await validateApiKey(kv as unknown as KVNamespace, TEST_KEY)
    expect(result).toBeNull()
  })

  it('returns null for unknown key (hash not in lookup)', async () => {
    const kv = createMockKv()
    const result = await validateApiKey(kv as unknown as KVNamespace, TEST_KEY)
    expect(result).toBeNull()
  })

  it('returns null for malformed key (wrong prefix)', async () => {
    const kv = createMockKv()
    const result = await validateApiKey(kv as unknown as KVNamespace, 'bad_00112233445566778899aabbccddeeff')
    expect(result).toBeNull()
    // Should not even attempt KV lookup
    expect(kv.get).not.toHaveBeenCalled()
  })

  it('returns null for malformed key (too short)', async () => {
    const kv = createMockKv()
    const result = await validateApiKey(kv as unknown as KVNamespace, 'nfk_0011223344')
    expect(result).toBeNull()
    expect(kv.get).not.toHaveBeenCalled()
  })

  it('returns null for malformed key (uppercase hex)', async () => {
    const kv = createMockKv()
    const result = await validateApiKey(kv as unknown as KVNamespace, 'nfk_00112233445566778899AABBCCDDEEFF')
    expect(result).toBeNull()
    expect(kv.get).not.toHaveBeenCalled()
  })

  it('returns null when metadata JSON is invalid', async () => {
    const kv = createMockKv()
    kv._store.set(`apikeylookup:${TEST_KEY_HASH}`, 'k_001')
    kv._store.set('apikey:k_001', 'not-json')

    const result = await validateApiKey(kv as unknown as KVNamespace, TEST_KEY)
    expect(result).toBeNull()
  })

  it('returns null when keyId exists but metadata missing', async () => {
    const kv = createMockKv()
    kv._store.set(`apikeylookup:${TEST_KEY_HASH}`, 'k_001')
    // No apikey:k_001 entry

    const result = await validateApiKey(kv as unknown as KVNamespace, TEST_KEY)
    expect(result).toBeNull()
  })
})

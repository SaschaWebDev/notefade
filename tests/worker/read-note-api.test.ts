import { describe, expect, it, vi, beforeEach } from 'vitest'
import { handleRequest } from '@worker/index'
import type { ShardStore } from '@worker/shard-store'
import { createNote, computeCheck } from '../../src/crypto/crypto'

function mockStore(): ShardStore {
  return {
    put: vi.fn<ShardStore['put']>().mockResolvedValue(undefined),
    get: vi.fn<ShardStore['get']>().mockResolvedValue(null),
    exists: vi.fn<ShardStore['exists']>().mockResolvedValue(false),
    delete: vi.fn<ShardStore['delete']>().mockResolvedValue(false),
  }
}

const VALID_API_KEY = 'nfk_00112233445566778899aabbccddeeff'

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

let keyHash: string
let mockShards: {
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

function setupKvWithValidKey(): void {
  mockShards.get.mockImplementation(async (key: string) => {
    if (key === `apikeylookup:${keyHash}`) return 'k_001'
    if (key === 'apikey:k_001') {
      return JSON.stringify({
        hash: keyHash,
        name: 'TestApp',
        createdAt: 1710000000,
      })
    }
    // Rate limit keys — return null (no prior requests)
    return null
  })
}

function req(
  method: string,
  path: string,
  opts?: { body?: string; apiKey?: string; origin?: string },
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts?.apiKey) headers['X-Api-Key'] = opts.apiKey

  const r = new Request(`https://api.notefade.com${path}`, {
    method,
    headers,
    body: opts?.body,
  })

  const origin = opts?.origin ?? 'https://notefade.com'
  const originalGet = r.headers.get.bind(r.headers)
  r.headers.get = (name: string) => {
    if (name.toLowerCase() === 'origin') return origin
    return originalGet(name)
  }
  return r
}

/** Create a real encrypted note and return its URL + shard for testing */
async function createTestNote(text: string): Promise<{ url: string; shardId: string; serverShard: string }> {
  const { urlPayload, serverShard } = await createNote(text)
  const shardId = 'aabbccdd11223344'
  const check = computeCheck(urlPayload)
  const url = `https://notefade.com/#${shardId}:${check}:${urlPayload}`
  return { url, shardId, serverShard }
}

beforeEach(async () => {
  keyHash = await sha256Hex(VALID_API_KEY)
  mockShards = {
    get: vi.fn<(key: string) => Promise<string | null>>().mockResolvedValue(null),
    put: vi.fn<(key: string, value: string, options?: object) => Promise<void>>().mockResolvedValue(undefined),
  }
})

describe('POST /api/v1/read-note', () => {
  it('returns 401 when no API key provided', async () => {
    const store = mockStore()
    const body = JSON.stringify({ url: 'https://notefade.com/#test' })
    const env = { SHARDS: mockShards }

    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body }),
      store,
      env,
    )

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Missing API key')
  })

  it('returns 401 for invalid API key', async () => {
    const store = mockStore()
    const body = JSON.stringify({ url: 'https://notefade.com/#test' })
    const env = { SHARDS: mockShards }

    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: 'nfk_invalid0000000000000000000000' }),
      store,
      env,
    )

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid API key')
  })

  it('returns 200 with decrypted text for valid request', async () => {
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const testText = 'secret message for API test'
    const { url, shardId, serverShard } = await createTestNote(testText)

    const store = mockStore()
    vi.mocked(store.get).mockResolvedValue(serverShard)

    const body = JSON.stringify({ url })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { text: string; shardId: string }
    expect(json.text).toBe(testText)
    expect(json.shardId).toBe(shardId)
    // Shard should have been fetched (destructive read)
    expect(store.get).toHaveBeenCalledWith(shardId)
  })

  it('includes rate limit headers on success', async () => {
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const { url, serverShard } = await createTestNote('hello')
    const store = mockStore()
    vi.mocked(store.get).mockResolvedValue(serverShard)

    const body = JSON.stringify({ url })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy()
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
  })

  it('returns 400 for URL without fragment', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ url: 'https://notefade.com/' })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('URL must contain a fragment (#)')
  })

  it('returns 400 for multi-chunk URL', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ url: 'https://notefade.com/#multi:chunk1|chunk2' })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Multi-chunk notes are not supported by this endpoint')
  })

  it('returns 400 for custom provider URL', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ url: 'https://notefade.com/#aabbccdd11223344:check:payload@provider' })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Custom provider notes are not supported by this endpoint')
  })

  it('returns 400 for invalid shard ID in URL', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ url: 'https://notefade.com/#INVALID:check:payload' })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid shard ID in URL')
  })

  it('returns 400 for bad integrity check', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const { url } = await createTestNote('hello')
    // Tamper with the check portion
    const hashIndex = url.indexOf('#')
    const fragment = url.slice(hashIndex + 1)
    const parts = fragment.split(':')
    const tamperedUrl = `https://notefade.com/#${parts[0]}:WRONG_:${parts.slice(2).join(':')}`

    const body = JSON.stringify({ url: tamperedUrl })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('URL integrity check failed')
  })

  it('returns 404 when shard not found', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const { url } = await createTestNote('hello')

    // store.get returns null (shard already consumed)
    const body = JSON.stringify({ url })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(404)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Note not found or already read')
  })

  it('returns 400 for invalid JSON', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body: 'not json{', apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 413 for body exceeding 16KB', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = 'x'.repeat(16385)
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(413)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Body too large')
  })

  it('returns 429 when rate limited', async () => {
    const store = mockStore()
    const bucket = Math.floor(Date.now() / 60000)

    mockShards.get.mockImplementation(async (key: string) => {
      if (key === `apikeylookup:${keyHash}`) return 'k_001'
      if (key === 'apikey:k_001') {
        return JSON.stringify({
          hash: keyHash,
          name: 'TestApp',
          createdAt: 1710000000,
        })
      }
      // Rate limit bucket is full
      if (key === `rl:k_001:${bucket}`) return '60'
      return null
    })

    const env = { SHARDS: mockShards }
    const body = JSON.stringify({ url: 'https://notefade.com/#test' })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Rate limit exceeded')
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('returns 400 for missing url field', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ noteUrl: 'wrong field' })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for fragment with fewer than 3 parts', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ url: 'https://notefade.com/#onlyonepart' })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
  })

  it('reflects Origin for API-key-authenticated requests', async () => {
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const { url, serverShard } = await createTestNote('hello')
    const store = mockStore()
    vi.mocked(store.get).mockResolvedValue(serverShard)

    const body = JSON.stringify({ url })
    const res = await handleRequest(
      req('POST', '/api/v1/read-note', {
        body,
        apiKey: VALID_API_KEY,
        origin: 'https://myapp.example.com',
      }),
      store,
      env,
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.example.com')
  })
})

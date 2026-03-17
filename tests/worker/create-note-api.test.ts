import { describe, expect, it, vi, beforeEach } from 'vitest'
import { handleRequest } from '@worker/index'
import type { ShardStore } from '@worker/shard-store'

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

beforeEach(async () => {
  keyHash = await sha256Hex(VALID_API_KEY)
  mockShards = {
    get: vi.fn<(key: string) => Promise<string | null>>().mockResolvedValue(null),
    put: vi.fn<(key: string, value: string, options?: object) => Promise<void>>().mockResolvedValue(undefined),
  }

  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    'aabbccdd-1122-3344-5566-778899aabbcc',
  )
})

describe('POST /api/v1/create-note', () => {
  it('returns 401 when no API key provided', async () => {
    const store = mockStore()
    const body = JSON.stringify({ text: 'hello' })
    const env = { SHARDS: mockShards }

    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body }),
      store,
      env,
    )

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Missing API key')
  })

  it('returns 401 for invalid API key', async () => {
    const store = mockStore()
    const body = JSON.stringify({ text: 'hello' })
    const env = { SHARDS: mockShards }

    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: 'nfk_invalid0000000000000000000000' }),
      store,
      env,
    )

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid API key')
  })

  it('returns 401 for malformed API key', async () => {
    const store = mockStore()
    const body = JSON.stringify({ text: 'hello' })
    const env = { SHARDS: mockShards }

    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: 'not-valid' }),
      store,
      env,
    )

    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid API key')
  })

  it('returns 201 with URL for valid request', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ text: 'secret message' })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(201)
    const json = (await res.json()) as { url: string; shardId: string; expiresAt: number }
    expect(json.url).toMatch(/^https:\/\/notefade\.com\/#[a-f0-9]{16}:.+:.+$/)
    expect(json.shardId).toBe('aabbccdd11223344')
    expect(json.expiresAt).toBeGreaterThan(Date.now())
    // Shard should have been stored
    expect(store.put).toHaveBeenCalledWith(
      'aabbccdd11223344',
      expect.any(String),
      86400,
    )
  })

  it('includes rate limit headers on success', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ text: 'secret message' })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(201)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy()
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
  })

  it('returns 400 for empty text', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ text: '' })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid request')
  })

  it('returns 400 for missing text field', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ message: 'wrong field' })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for text exceeding 1800 chars', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ text: 'a'.repeat(1801) })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid request')
  })

  it('returns 400 for invalid JSON', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body: 'not json{', apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 413 for body exceeding 4KB', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = 'x'.repeat(4097)
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
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
    const body = JSON.stringify({ text: 'hello' })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Rate limit exceeded')
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('uses WEB_ORIGIN env override in URL', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards, WEB_ORIGIN: 'https://staging.notefade.com' }
    setupKvWithValidKey()

    const body = JSON.stringify({ text: 'hello' })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(201)
    const json = (await res.json()) as { url: string }
    expect(json.url).toMatch(/^https:\/\/staging\.notefade\.com\/#/)
  })

  it('reflects Origin for API-key-authenticated requests', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ text: 'hello' })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', {
        body,
        apiKey: VALID_API_KEY,
        origin: 'https://chat.example.com',
      }),
      store,
      env,
    )

    expect(res.status).toBe(201)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://chat.example.com')
  })

  it('accepts text at exactly 1800 chars', async () => {
    const store = mockStore()
    const env = { SHARDS: mockShards }
    setupKvWithValidKey()

    const body = JSON.stringify({ text: 'a'.repeat(1800) })
    const res = await handleRequest(
      req('POST', '/api/v1/create-note', { body, apiKey: VALID_API_KEY }),
      store,
      env,
    )

    expect(res.status).toBe(201)
  })
})

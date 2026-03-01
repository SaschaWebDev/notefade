import { describe, expect, it, vi, beforeEach } from 'vitest'
import { handleRequest } from './index'
import type { ShardStore } from './shard-store'

function mockStore(): ShardStore {
  return {
    put: vi.fn<ShardStore['put']>().mockResolvedValue(undefined),
    get: vi.fn<ShardStore['get']>().mockResolvedValue(null),
    exists: vi.fn<ShardStore['exists']>().mockResolvedValue(false),
    delete: vi.fn<ShardStore['delete']>().mockResolvedValue(false),
  }
}

function req(
  method: string,
  path: string,
  opts?: { body?: string; origin?: string },
): Request {
  const r = new Request(`https://api.notefade.com${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: opts?.body,
  })

  // Origin is a forbidden header — happy-dom strips it from Request.
  // Patch headers.get to return it for our CORS tests.
  const origin = opts?.origin ?? 'https://notefade.com'
  const originalGet = r.headers.get.bind(r.headers)
  r.headers.get = (name: string) => {
    if (name.toLowerCase() === 'origin') return origin
    return originalGet(name)
  }
  return r
}

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    'aabbccdd-1122-3344-5566-778899aabbcc',
  )
})

describe('worker handleRequest', () => {
  // --- CORS / OPTIONS ---

  it('OPTIONS returns 204 with CORS headers', async () => {
    const store = mockStore()
    const res = await handleRequest(req('OPTIONS', '/shard'), store)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://notefade.com',
    )
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('CORS reflects localhost origin', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('OPTIONS', '/shard', { origin: 'http://localhost:5173' }),
      store,
    )
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5173',
    )
  })

  it('CORS reflects www.notefade.com origin', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('OPTIONS', '/shard', { origin: 'https://www.notefade.com' }),
      store,
    )
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://www.notefade.com',
    )
  })

  it('CORS defaults to notefade.com for unknown origin', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('OPTIONS', '/shard', { origin: 'https://evil.com' }),
      store,
    )
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://notefade.com',
    )
  })

  // --- POST /shard ---

  it('POST /shard with valid body returns 201 and id', async () => {
    const store = mockStore()
    const body = JSON.stringify({ shard: 'ABCDEFGHIJKLMNOPQRSTU', ttl: 3600 })
    const res = await handleRequest(req('POST', '/shard', { body }), store)

    expect(res.status).toBe(201)
    const json = (await res.json()) as { id: string }
    expect(json.id).toBe('aabbccdd11223344')
    expect(store.put).toHaveBeenCalledWith(
      'aabbccdd11223344',
      'ABCDEFGHIJKLMNOPQRSTU',
      3600,
    )
  })

  it('POST /shard with invalid JSON returns 400', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('POST', '/shard', { body: 'not json{' }),
      store,
    )
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid JSON')
  })

  it('POST /shard with missing fields returns 400', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('POST', '/shard', { body: JSON.stringify({ shard: 'abc' }) }),
      store,
    )
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid request')
  })

  it('POST /shard with body too large returns 413', async () => {
    const store = mockStore()
    const body = 'x'.repeat(1025)
    const res = await handleRequest(
      req('POST', '/shard', { body }),
      store,
    )
    expect(res.status).toBe(413)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Body too large')
  })

  it('POST /shard with invalid TTL returns 400', async () => {
    const store = mockStore()
    const body = JSON.stringify({
      shard: 'ABCDEFGHIJKLMNOPQRSTU',
      ttl: 9999,
    })
    const res = await handleRequest(req('POST', '/shard', { body }), store)
    expect(res.status).toBe(400)
  })

  it('POST /shard with invalid shard format returns 400', async () => {
    const store = mockStore()
    const body = JSON.stringify({ shard: '!!!', ttl: 3600 })
    const res = await handleRequest(req('POST', '/shard', { body }), store)
    expect(res.status).toBe(400)
  })

  it('POST /shard calls store.put with correct args', async () => {
    const store = mockStore()
    const body = JSON.stringify({
      shard: 'ABCDEFGHIJKLMNOPQRSTU',
      ttl: 86400,
    })
    await handleRequest(req('POST', '/shard', { body }), store)
    expect(store.put).toHaveBeenCalledWith(
      'aabbccdd11223344',
      'ABCDEFGHIJKLMNOPQRSTU',
      86400,
    )
  })

  // --- HEAD /shard/:id ---

  it('HEAD /shard/:id returns 200 when shard exists', async () => {
    const store = mockStore()
    ;(store.exists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    const res = await handleRequest(
      req('HEAD', '/shard/aabbccdd11223344'),
      store,
    )
    expect(res.status).toBe(200)
  })

  it('HEAD /shard/:id returns 404 when not found', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('HEAD', '/shard/aabbccdd11223344'),
      store,
    )
    expect(res.status).toBe(404)
  })

  it('HEAD /shard/:id returns 400 for invalid ID', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('HEAD', '/shard/INVALID!'),
      store,
    )
    expect(res.status).toBe(400)
  })

  // --- GET /shard/:id ---

  it('GET /shard/:id returns shard JSON when found', async () => {
    const store = mockStore()
    ;(store.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('shard-data')
    const res = await handleRequest(
      req('GET', '/shard/aabbccdd11223344'),
      store,
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { shard: string }
    expect(json.shard).toBe('shard-data')
  })

  it('GET /shard/:id returns 404 when not found', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('GET', '/shard/aabbccdd11223344'),
      store,
    )
    expect(res.status).toBe(404)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Not found')
  })

  it('GET /shard/:id returns 400 for invalid ID', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('GET', '/shard/INVALID!'),
      store,
    )
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid shard ID')
  })

  // --- DELETE /shard/:id ---

  it('DELETE /shard/:id returns deleted:true when found', async () => {
    const store = mockStore()
    ;(store.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    const res = await handleRequest(
      req('DELETE', '/shard/aabbccdd11223344'),
      store,
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { deleted: boolean }
    expect(json.deleted).toBe(true)
  })

  it('DELETE /shard/:id returns 404 when not found', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('DELETE', '/shard/aabbccdd11223344'),
      store,
    )
    expect(res.status).toBe(404)
  })

  it('DELETE /shard/:id returns 400 for invalid ID', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('DELETE', '/shard/INVALID!'),
      store,
    )
    expect(res.status).toBe(400)
  })

  // --- Unknown routes ---

  it('unknown route returns 404', async () => {
    const store = mockStore()
    const res = await handleRequest(req('GET', '/unknown'), store)
    expect(res.status).toBe(404)
  })

  it('POST to unknown path returns 404', async () => {
    const store = mockStore()
    const res = await handleRequest(
      req('POST', '/other', { body: '{}' }),
      store,
    )
    expect(res.status).toBe(404)
  })

  // --- Response headers ---

  it('all responses include Cache-Control no-store', async () => {
    const store = mockStore()
    ;(store.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('shard')
    const res = await handleRequest(
      req('GET', '/shard/aabbccdd11223344'),
      store,
    )
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('all responses include Pragma no-cache', async () => {
    const store = mockStore()
    const res = await handleRequest(req('GET', '/unknown'), store)
    expect(res.headers.get('Pragma')).toBe('no-cache')
  })

  // --- POST /shard with all valid TTLs ---

  it.each([3600, 86400, 604800])('POST /shard accepts TTL=%d', async (ttl) => {
    const store = mockStore()
    const body = JSON.stringify({
      shard: 'ABCDEFGHIJKLMNOPQRSTU',
      ttl,
    })
    const res = await handleRequest(req('POST', '/shard', { body }), store)
    expect(res.status).toBe(201)
  })
})

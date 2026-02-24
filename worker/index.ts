import { z } from 'zod'
import { CloudflareKVShardStore } from './shard-store'
import type { ShardStore } from './shard-store'

interface Env {
  SHARDS: KVNamespace
}

const VALID_TTLS = [3600, 86400, 604800] as const
const MAX_BODY_SIZE = 1024 // 1KB
const SHARD_ID_RE = /^[a-f0-9]{8,16}$/

// --- In-memory rate limiting (per-isolate) ---

const RATE_LIMITS: Record<string, number> = {
  POST: 10,    // 10 creates/min
  HEAD: 30,    // 30 probes/min
  GET: 10,     // 10 reads/min
  DELETE: 10,  // 10 deletes/min
}
const RATE_WINDOW_MS = 60_000

interface RateEntry {
  count: number
  resetAt: number
}

const rateCounts = new Map<string, RateEntry>()
let requestCount = 0

function cleanupRateCounts(): void {
  if (++requestCount % 500 !== 0) return
  const now = Date.now()
  for (const [key, entry] of rateCounts) {
    if (now >= entry.resetAt) rateCounts.delete(key)
  }
}

function checkRateLimit(
  request: Request,
  headers: Record<string, string>,
): Response | null {
  const method = request.method
  const limit = RATE_LIMITS[method]
  if (limit === undefined) return null

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const key = `${ip}:${method}`
  const now = Date.now()

  cleanupRateCounts()

  const entry = rateCounts.get(key)
  if (!entry || now >= entry.resetAt) {
    rateCounts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return null
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return Response.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: { ...headers, 'Retry-After': String(retryAfter) },
      },
    )
  }

  entry.count++
  return null
}

const StoreShardSchema = z.object({
  shard: z.string().regex(/^[A-Za-z0-9_-]{20,24}$/, 'Invalid shard format'),
  ttl: z.number().refine((v): v is (typeof VALID_TTLS)[number] =>
    (VALID_TTLS as readonly number[]).includes(v),
    { message: `ttl must be one of: ${VALID_TTLS.join(', ')}` },
  ),
})

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
  }
}

function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get('Origin') ?? ''
  // In production, restrict to notefade.com
  // For dev, allow all origins
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return origin
  }
  if (origin === 'https://notefade.com' || origin === 'https://www.notefade.com') {
    return origin
  }
  return 'https://notefade.com'
}

async function handleRequest(
  request: Request,
  store: ShardStore,
): Promise<Response> {
  const url = new URL(request.url)
  const origin = getAllowedOrigin(request)
  const headers = corsHeaders(origin)

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  // POST /shard — store a shard
  if (request.method === 'POST' && url.pathname === '/shard') {
    const rawBody = await request.text()
    if (rawBody.length > MAX_BODY_SIZE) {
      return Response.json(
        { error: 'Body too large' },
        { status: 413, headers },
      )
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers },
      )
    }
    const parsed = StoreShardSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400, headers },
      )
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    await store.put(id, parsed.data.shard, parsed.data.ttl)
    return Response.json({ id }, { status: 201, headers })
  }

  // HEAD /shard/:id — check if shard exists (non-destructive)
  if (request.method === 'HEAD' && url.pathname.startsWith('/shard/')) {
    const id = url.pathname.slice('/shard/'.length)
    if (!id || !SHARD_ID_RE.test(id)) {
      return new Response(null, { status: 400, headers })
    }

    const found = await store.exists(id)
    return new Response(null, { status: found ? 200 : 404, headers })
  }

  // GET /shard/:id — fetch and delete shard
  if (request.method === 'GET' && url.pathname.startsWith('/shard/')) {
    const id = url.pathname.slice('/shard/'.length)
    if (!id || !SHARD_ID_RE.test(id)) {
      return Response.json(
        { error: 'Invalid shard ID' },
        { status: 400, headers },
      )
    }

    const shard = await store.get(id)
    if (shard === null) {
      return Response.json(
        { error: 'Not found' },
        { status: 404, headers },
      )
    }

    return Response.json({ shard }, { headers })
  }

  // DELETE /shard/:id — destroy shard without reading
  if (request.method === 'DELETE' && url.pathname.startsWith('/shard/')) {
    const id = url.pathname.slice('/shard/'.length)
    if (!id || !SHARD_ID_RE.test(id)) {
      return Response.json(
        { error: 'Invalid shard ID' },
        { status: 400, headers },
      )
    }

    const deleted = await store.delete(id)
    if (!deleted) {
      return Response.json(
        { error: 'Not found' },
        { status: 404, headers },
      )
    }

    return Response.json({ deleted: true }, { headers })
  }

  return Response.json({ error: 'Not found' }, { status: 404, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Rate limit before any business logic (skip preflight)
    if (request.method !== 'OPTIONS') {
      const origin = getAllowedOrigin(request)
      const headers = corsHeaders(origin)
      const limited = checkRateLimit(request, headers)
      if (limited) return limited
    }

    const store = new CloudflareKVShardStore(env.SHARDS)
    return handleRequest(request, store)
  },
}

// Exported for testing
export { handleRequest }

import { z } from 'zod'
import { CloudflareKVShardStore } from './shard-store'
import type { ShardStore } from './shard-store'
import { createDeferToken, openDeferToken } from './defer-token'
import { createNote, openNote, computeCheck } from '../src/crypto/crypto'
import { validateApiKey } from './api-key'
import { checkKeyRateLimit } from './rate-limit-kv'

interface Env {
  SHARDS: KVNamespace
  DEFER_SECRET?: string  // 64 hex chars (32 bytes), set via `wrangler secret put`
  WEB_ORIGIN?: string    // Override for dev/staging (defaults to https://notefade.com)
}

const VALID_TTLS = [3600, 86400, 604800] as const
const MAX_BODY_SIZE = 1024 // 1KB
const MAX_API_BODY_SIZE = 4096 // 4KB (1800-char API message + JSON overhead; web app supports up to 50,000 chars via multi-chunk)
const MAX_READ_API_BODY_SIZE = 16384 // 16KB (padded single-note URLs can reach ~7.5KB)
const SHARD_ID_RE = /^[a-f0-9]{8,16}$/
const API_DEFAULT_TTL = 86400 // 24 hours

// --- In-memory rate limiting (per-isolate) ---

const RATE_LIMITS: Record<string, number> = {
  POST: 60,    // 60 creates/min (multi-chunk notes can need 28+ sequential stores)
  HEAD: 30,    // 30 probes/min
  GET: 15,     // 15 reads/min (multi-read notes may have several near-simultaneous readers)
  DELETE: 10,  // 10 deletes/min
}
const RATE_WINDOW_MS = 60_000

interface RateEntry {
  count: number
  resetAt: number
}

const CLEANUP_INTERVAL = 500

const rateCounts = new Map<string, RateEntry>()
let requestCount = 0

function cleanupRateCounts(): void {
  if (++requestCount % CLEANUP_INTERVAL !== 0) return
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

const DeferShardSchema = z.object({
  shard: z.string().regex(/^[A-Za-z0-9_-]{20,24}$/, 'Invalid shard format'),
  ttl: z.number().refine((v): v is (typeof VALID_TTLS)[number] =>
    (VALID_TTLS as readonly number[]).includes(v),
    { message: `ttl must be one of: ${VALID_TTLS.join(', ')}` },
  ),
})

const ActivateTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

const CreateNoteSchema = z.object({
  text: z.string().min(1).max(1800),
})

const ReadNoteSchema = z.object({
  url: z.string().min(1),
})

/** Maximum token age: 30 days */
const MAX_TOKEN_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Activation marker TTL: 31 days (outlives max token age, then auto-expires) */
const ACTIVATED_MARKER_TTL = 31 * 24 * 60 * 60

function generateShardId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
  }
}

const ALLOWED_ORIGINS = new Set([
  'https://notefade.com',
  'https://www.notefade.com',
])

const DEV_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/

function getAllowedOrigin(request: Request, hasApiKey = false): string {
  const origin = request.headers.get('Origin') ?? ''
  if (ALLOWED_ORIGINS.has(origin) || DEV_ORIGIN_RE.test(origin)) {
    return origin
  }
  // API-key-authenticated requests: reflect the request's Origin
  if (hasApiKey && origin) {
    return origin
  }
  return 'https://notefade.com'
}

async function handleRequest(
  request: Request,
  store: ShardStore,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url)
  const hasApiKey = request.headers.get('X-Api-Key') !== null
  const origin = getAllowedOrigin(request, hasApiKey)
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
        { error: 'Invalid request' },
        { status: 400, headers },
      )
    }

    const id = generateShardId()
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

  // POST /shard/defer — create an encrypted defer token (does NOT store the shard)
  if (request.method === 'POST' && url.pathname === '/shard/defer') {
    if (!env.DEFER_SECRET) {
      return Response.json(
        { error: 'Deferred activation is not configured on this server' },
        { status: 501, headers },
      )
    }

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

    const parsed = DeferShardSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request' },
        { status: 400, headers },
      )
    }

    const id = generateShardId()
    const token = await createDeferToken(env.DEFER_SECRET, {
      id,
      shard: parsed.data.shard,
      ttl: parsed.data.ttl,
      ts: Date.now(),
    })

    return Response.json({ token, id }, { status: 201, headers })
  }

  // POST /shard/activate — decrypt a defer token and store the shard
  if (request.method === 'POST' && url.pathname === '/shard/activate') {
    if (!env.DEFER_SECRET) {
      return Response.json(
        { error: 'Deferred activation is not configured on this server' },
        { status: 501, headers },
      )
    }

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

    const parsed = ActivateTokenSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request' },
        { status: 400, headers },
      )
    }

    let payload
    try {
      payload = await openDeferToken(env.DEFER_SECRET, parsed.data.token)
    } catch {
      return Response.json(
        { error: 'Invalid or tampered token' },
        { status: 400, headers },
      )
    }

    // Validate inner payload fields
    if (!SHARD_ID_RE.test(payload.id)) {
      return Response.json(
        { error: 'Invalid token payload' },
        { status: 400, headers },
      )
    }

    if (!(VALID_TTLS as readonly number[]).includes(payload.ttl)) {
      return Response.json(
        { error: 'Invalid token payload' },
        { status: 400, headers },
      )
    }

    // Check token age
    if (Date.now() - payload.ts > MAX_TOKEN_AGE_MS) {
      return Response.json(
        { error: 'Token invalid or expired' },
        { status: 410, headers },
      )
    }

    // Prevent replay: reject if this token was already activated
    const markerKey = `activated:${payload.id}`
    const alreadyUsed = await env.SHARDS.get(markerKey)
    if (alreadyUsed !== null) {
      return Response.json(
        { error: 'Token invalid or expired' },
        { status: 410, headers },
      )
    }

    // Write activation marker before storing shard to minimize replay window
    await env.SHARDS.put(markerKey, '1', { expirationTtl: ACTIVATED_MARKER_TTL })
    await store.put(payload.id, payload.shard, payload.ttl)
    return Response.json({ id: payload.id }, { status: 201, headers })
  }

  // POST /api/v1/create-note — integration API (requires API key)
  if (request.method === 'POST' && url.pathname === '/api/v1/create-note') {
    // Require API key
    const rawKey = request.headers.get('X-Api-Key')
    if (!rawKey) {
      return Response.json(
        { error: 'Missing API key' },
        { status: 401, headers },
      )
    }

    const keyResult = await validateApiKey(env.SHARDS, rawKey)
    if (!keyResult) {
      return Response.json(
        { error: 'Invalid API key' },
        { status: 401, headers },
      )
    }

    // Per-key rate limit
    const rateLimit = await checkKeyRateLimit(
      env.SHARDS,
      keyResult.keyId,
      keyResult.limits?.postPerMin,
    )
    const rlHeaders = {
      ...headers,
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(rateLimit.resetAt),
    }

    if (!rateLimit.allowed) {
      const retryAfter = rateLimit.resetAt - Math.floor(Date.now() / 1000)
      return Response.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { ...rlHeaders, 'Retry-After': String(Math.max(1, retryAfter)) },
        },
      )
    }

    // Body size check (larger limit for API)
    const rawBody = await request.text()
    if (rawBody.length > MAX_API_BODY_SIZE) {
      return Response.json(
        { error: 'Body too large' },
        { status: 413, headers: rlHeaders },
      )
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: rlHeaders },
      )
    }

    const parsed = CreateNoteSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400, headers: rlHeaders },
      )
    }

    // Encrypt and split
    const { urlPayload, serverShard } = await createNote(parsed.data.text)
    const id = generateShardId()
    await store.put(id, serverShard, API_DEFAULT_TTL)

    // Build URL
    const check = computeCheck(urlPayload)
    const webOrigin = env.WEB_ORIGIN ?? 'https://notefade.com'
    const noteUrl = `${webOrigin}/#${id}:${check}:${urlPayload}`
    const expiresAt = Date.now() + API_DEFAULT_TTL * 1000

    return Response.json(
      { url: noteUrl, shardId: id, expiresAt },
      { status: 201, headers: rlHeaders },
    )
  }

  // POST /api/v1/read-note — integration API (requires API key)
  if (request.method === 'POST' && url.pathname === '/api/v1/read-note') {
    // Require API key
    const rawKey = request.headers.get('X-Api-Key')
    if (!rawKey) {
      return Response.json(
        { error: 'Missing API key' },
        { status: 401, headers },
      )
    }

    const keyResult = await validateApiKey(env.SHARDS, rawKey)
    if (!keyResult) {
      return Response.json(
        { error: 'Invalid API key' },
        { status: 401, headers },
      )
    }

    // Per-key rate limit
    const rateLimit = await checkKeyRateLimit(
      env.SHARDS,
      keyResult.keyId,
      keyResult.limits?.postPerMin,
    )
    const rlHeaders = {
      ...headers,
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(rateLimit.resetAt),
    }

    if (!rateLimit.allowed) {
      const retryAfter = rateLimit.resetAt - Math.floor(Date.now() / 1000)
      return Response.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { ...rlHeaders, 'Retry-After': String(Math.max(1, retryAfter)) },
        },
      )
    }

    // Body size check
    const rawBody = await request.text()
    if (rawBody.length > MAX_READ_API_BODY_SIZE) {
      return Response.json(
        { error: 'Body too large' },
        { status: 413, headers: rlHeaders },
      )
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: rlHeaders },
      )
    }

    const parsed = ReadNoteSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400, headers: rlHeaders },
      )
    }

    // Extract fragment from URL
    const hashIndex = parsed.data.url.indexOf('#')
    if (hashIndex === -1) {
      return Response.json(
        { error: 'URL must contain a fragment (#)' },
        { status: 400, headers: rlHeaders },
      )
    }

    let fragment = parsed.data.url.slice(hashIndex + 1)

    // Reject multi-chunk URLs
    if (fragment.startsWith('multi:')) {
      return Response.json(
        { error: 'Multi-chunk notes are not supported by this endpoint' },
        { status: 400, headers: rlHeaders },
      )
    }

    // Reject custom provider URLs
    if (fragment.includes('@')) {
      return Response.json(
        { error: 'Custom provider notes are not supported by this endpoint' },
        { status: 400, headers: rlHeaders },
      )
    }

    // Strip time-lock prefix (tl:timestamp:...)
    if (fragment.startsWith('tl:')) {
      const colonAfterTs = fragment.indexOf(':', 3)
      if (colonAfterTs === -1) {
        return Response.json(
          { error: 'Invalid URL fragment' },
          { status: 400, headers: rlHeaders },
        )
      }
      fragment = fragment.slice(colonAfterTs + 1)
    }

    // Parse: shardId(s):check:urlPayload
    const firstColon = fragment.indexOf(':')
    const secondColon = fragment.indexOf(':', firstColon + 1)
    if (firstColon === -1 || secondColon === -1) {
      return Response.json(
        { error: 'Invalid URL fragment' },
        { status: 400, headers: rlHeaders },
      )
    }

    const shardIdPart = fragment.slice(0, firstColon)
    const check = fragment.slice(firstColon + 1, secondColon)
    const urlPayload = fragment.slice(secondColon + 1)

    // For multi-read notes (shardId1~shardId2~...), use the first shard
    const shardId = shardIdPart.split('~')[0]!
    if (!SHARD_ID_RE.test(shardId)) {
      return Response.json(
        { error: 'Invalid shard ID in URL' },
        { status: 400, headers: rlHeaders },
      )
    }

    // Verify integrity check
    if (computeCheck(urlPayload) !== check) {
      return Response.json(
        { error: 'URL integrity check failed' },
        { status: 400, headers: rlHeaders },
      )
    }

    // Fetch shard (destructive — consumes one read)
    const shard = await store.get(shardId)
    if (shard === null) {
      return Response.json(
        { error: 'Note not found or already read' },
        { status: 404, headers: rlHeaders },
      )
    }

    // Decrypt
    let result: { plaintext: string }
    try {
      result = await openNote(urlPayload, shard)
    } catch {
      return Response.json(
        { error: 'Decryption failed' },
        { status: 400, headers: rlHeaders },
      )
    }

    return Response.json(
      { text: result.plaintext, shardId },
      { status: 200, headers: rlHeaders },
    )
  }

  return Response.json({ error: 'Not found' }, { status: 404, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const isApiRoute = new URL(request.url).pathname.startsWith('/api/')

    // Rate limit before any business logic (skip preflight and API routes — they have their own)
    if (request.method !== 'OPTIONS' && !isApiRoute) {
      const origin = getAllowedOrigin(request)
      const headers = corsHeaders(origin)
      const limited = checkRateLimit(request, headers)
      if (limited) return limited
    }

    const store = new CloudflareKVShardStore(env.SHARDS)
    return handleRequest(request, store, env)
  },
}

// Exported for testing
export { handleRequest }

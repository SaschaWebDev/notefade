import { z } from 'zod'
import { CloudflareKVShardStore } from './shard-store'
import type { ShardStore } from './shard-store'

interface Env {
  SHARDS: KVNamespace
}

const VALID_TTLS = [3600, 86400, 604800] as const
const MAX_BODY_SIZE = 1024 // 1KB

const StoreShardSchema = z.object({
  shard: z.string().min(1),
  ttl: z.number().refine((v): v is (typeof VALID_TTLS)[number] =>
    (VALID_TTLS as readonly number[]).includes(v),
    { message: `ttl must be one of: ${VALID_TTLS.join(', ')}` },
  ),
})

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
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
    const contentLength = request.headers.get('Content-Length')
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Response.json(
        { error: 'Body too large' },
        { status: 413, headers },
      )
    }

    const body: unknown = await request.json()
    const parsed = StoreShardSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400, headers },
      )
    }

    const id = crypto.randomUUID().slice(0, 8)
    await store.put(id, parsed.data.shard, parsed.data.ttl)
    return Response.json({ id }, { status: 201, headers })
  }

  // GET /shard/:id — fetch and delete shard
  if (request.method === 'GET' && url.pathname.startsWith('/shard/')) {
    const id = url.pathname.slice('/shard/'.length)
    if (!id) {
      return Response.json(
        { error: 'Missing shard ID' },
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

  return Response.json({ error: 'Not found' }, { status: 404, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const store = new CloudflareKVShardStore(env.SHARDS)
    return handleRequest(request, store)
  },
}

// Exported for testing
export { handleRequest }

import { z } from 'zod'

const DEFAULT_API_BASE = import.meta.env.VITE_API_URL ?? ''

const StoreResponseSchema = z.object({
  id: z.string().min(1),
})

const FetchResponseSchema = z.object({
  shard: z.string().min(1),
})

const DeferResponseSchema = z.object({
  token: z.string().min(1),
  id: z.string().min(1),
})

const ActivateResponseSchema = z.object({
  id: z.string().min(1),
})

function resolveBase(apiBase?: string): string {
  return apiBase ?? DEFAULT_API_BASE
}

/**
 * TODO(cleanup): The `id` parameter was used by the old deferred
 * activation flow (client-generated IDs). The new flow uses
 * POST /shard/defer instead. Remove this parameter once the old
 * flow is fully deprecated.
 */
export async function storeShard(
  shard: string,
  ttl: number,
  apiBase?: string,
  id?: string,
): Promise<string> {
  const base = resolveBase(apiBase)
  const body: Record<string, unknown> = { shard, ttl }
  if (id) {
    body.id = id
  }
  const res = await fetch(`${base}/shard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Failed to store shard: ${res.status}`)
  }

  const data: unknown = await res.json()
  const parsed = StoreResponseSchema.parse(data)
  return parsed.id
}

export async function checkShard(id: string, apiBase?: string): Promise<boolean> {
  const base = resolveBase(apiBase)
  const res = await fetch(`${base}/shard/${encodeURIComponent(id)}`, {
    method: 'HEAD',
  })
  return res.status === 200
}

export async function deleteShard(id: string, apiBase?: string): Promise<boolean> {
  const base = resolveBase(apiBase)
  const res = await fetch(`${base}/shard/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (res.status === 404) return false
  if (!res.ok) {
    throw new Error(`Failed to delete shard: ${res.status}`)
  }
  return true
}

export async function fetchShard(id: string, apiBase?: string): Promise<string | null> {
  const base = resolveBase(apiBase)
  const res = await fetch(`${base}/shard/${encodeURIComponent(id)}`)

  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch shard: ${res.status}`)
  }

  const data: unknown = await res.json()
  const parsed = FetchResponseSchema.parse(data)
  return parsed.shard
}

export async function deferShard(
  shard: string,
  ttl: number,
  apiBase?: string,
): Promise<{ token: string; id: string }> {
  const base = resolveBase(apiBase)
  const res = await fetch(`${base}/shard/defer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shard, ttl }),
  })

  if (!res.ok) {
    throw new Error(`Failed to create defer token: ${res.status}`)
  }

  const data: unknown = await res.json()
  return DeferResponseSchema.parse(data)
}

export async function activateShard(
  token: string,
  apiBase?: string,
): Promise<string> {
  const base = resolveBase(apiBase)
  const res = await fetch(`${base}/shard/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (res.status === 410) {
    throw new Error('Token expired')
  }

  if (!res.ok) {
    throw new Error(`Activation failed: ${res.status}`)
  }

  const data: unknown = await res.json()
  const parsed = ActivateResponseSchema.parse(data)
  return parsed.id
}

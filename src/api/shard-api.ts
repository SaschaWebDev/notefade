import { z } from 'zod'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const StoreResponseSchema = z.object({
  id: z.string().min(1),
})

const FetchResponseSchema = z.object({
  shard: z.string().min(1),
})

export async function storeShard(
  shard: string,
  ttl: number,
): Promise<string> {
  const res = await fetch(`${API_BASE}/shard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shard, ttl }),
  })

  if (!res.ok) {
    throw new Error(`Failed to store shard: ${res.status}`)
  }

  const data: unknown = await res.json()
  const parsed = StoreResponseSchema.parse(data)
  return parsed.id
}

export async function checkShard(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/shard/${encodeURIComponent(id)}`, {
    method: 'HEAD',
  })
  return res.status === 200
}

export async function fetchShard(id: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/shard/${encodeURIComponent(id)}`)

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

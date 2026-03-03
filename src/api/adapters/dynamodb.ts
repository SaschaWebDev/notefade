import { z } from 'zod'
import type { ProviderAdapter, DynamoDBConfig } from '../provider-types'

const StoreResponseSchema = z.object({ id: z.string().min(1) })
const FetchResponseSchema = z.object({ shard: z.string().min(1) })

/** DynamoDB adapter: calls the same shard API but injects x-api-key for API Gateway */
export function createDynamoDBAdapter(config: DynamoDBConfig): ProviderAdapter {
  const baseUrl = config.u.replace(/\/$/, '')

  function authHeaders(extra?: Record<string, string>): Record<string, string> {
    return { 'x-api-key': config.k, ...extra }
  }

  return {
    async store(shard, ttl) {
      const res = await fetch(`${baseUrl}/shard`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ shard, ttl }),
      })
      if (!res.ok) {
        throw new Error(`Failed to store shard: ${res.status}`)
      }
      const data: unknown = await res.json()
      return StoreResponseSchema.parse(data).id
    },

    async check(id) {
      const res = await fetch(`${baseUrl}/shard/${encodeURIComponent(id)}`, {
        method: 'HEAD',
        headers: authHeaders(),
      })
      return res.status === 200
    },

    async fetch(id) {
      const res = await fetch(`${baseUrl}/shard/${encodeURIComponent(id)}`, {
        headers: authHeaders(),
      })
      if (res.status === 404) return null
      if (!res.ok) {
        throw new Error(`Failed to fetch shard: ${res.status}`)
      }
      const data: unknown = await res.json()
      return FetchResponseSchema.parse(data).shard
    },

    async delete(id) {
      const res = await fetch(`${baseUrl}/shard/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.status === 404) return false
      if (!res.ok) {
        throw new Error(`Failed to delete shard: ${res.status}`)
      }
      return true
    },
  }
}

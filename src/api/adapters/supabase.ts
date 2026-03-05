import type { ProviderAdapter, SupabaseConfig } from '../provider-types'
import { generateShardId } from '../shard-id'
import { ttlToISOExpiry } from '@/utils/time'

const SHARDS_PATH = '/rest/v1/shards'

function headers(config: SupabaseConfig): Record<string, string> {
  return {
    apikey: config.k,
    Authorization: `Bearer ${config.k}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  }
}

export function createSupabaseAdapter(config: SupabaseConfig): ProviderAdapter {
  const baseUrl = config.u.replace(/\/$/, '')

  return {
    async store(shard, ttl) {
      const id = generateShardId()
      const expiresAt = ttlToISOExpiry(ttl)
      const res = await fetch(`${baseUrl}${SHARDS_PATH}`, {
        method: 'POST',
        headers: headers(config),
        body: JSON.stringify({ id, shard, expires_at: expiresAt }),
      })
      if (!res.ok) {
        throw new Error(`Supabase store failed: ${res.status}`)
      }
      return id
    },

    async check(id) {
      const now = new Date().toISOString()
      const res = await fetch(
        `${baseUrl}${SHARDS_PATH}?id=eq.${encodeURIComponent(id)}&expires_at=gt.${encodeURIComponent(now)}&select=id`,
        { headers: headers(config) },
      )
      if (!res.ok) return false
      const data: unknown = await res.json()
      return Array.isArray(data) && data.length > 0
    },

    async fetch(id) {
      const now = new Date().toISOString()
      const res = await fetch(
        `${baseUrl}${SHARDS_PATH}?id=eq.${encodeURIComponent(id)}&expires_at=gt.${encodeURIComponent(now)}&select=shard`,
        { headers: headers(config) },
      )
      if (!res.ok) {
        throw new Error(`Supabase fetch failed: ${res.status}`)
      }
      const data: unknown = await res.json()
      if (!Array.isArray(data) || data.length === 0) return null

      const row = data[0] as { shard?: string }
      if (typeof row.shard !== 'string') return null

      // Delete after read
      await fetch(
        `${baseUrl}${SHARDS_PATH}?id=eq.${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: headers(config) },
      )

      return row.shard
    },

    async delete(id) {
      const now = new Date().toISOString()
      const checkRes = await fetch(
        `${baseUrl}${SHARDS_PATH}?id=eq.${encodeURIComponent(id)}&expires_at=gt.${encodeURIComponent(now)}&select=id`,
        { headers: headers(config) },
      )
      if (!checkRes.ok) return false
      const checkData: unknown = await checkRes.json()
      if (!Array.isArray(checkData) || checkData.length === 0) return false

      await fetch(
        `${baseUrl}${SHARDS_PATH}?id=eq.${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: headers(config) },
      )
      return true
    },
  }
}

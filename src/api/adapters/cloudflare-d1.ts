import type { ProviderAdapter, CloudflareD1Config } from '../provider-types'
import { generateShardId } from '../shard-id'

function queryUrl(config: CloudflareD1Config): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.a}/d1/database/${config.d}/query`
}

function headers(config: CloudflareD1Config): Record<string, string> {
  return {
    Authorization: `Bearer ${config.k}`,
    'Content-Type': 'application/json',
  }
}

export function createCloudflareD1Adapter(config: CloudflareD1Config): ProviderAdapter {
  return {
    async store(shard, ttl) {
      const id = generateShardId()
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()
      const res = await fetch(queryUrl(config), {
        method: 'POST',
        headers: headers(config),
        body: JSON.stringify({
          sql: 'INSERT INTO shards (id, shard, expires_at) VALUES (?, ?, ?)',
          params: [id, shard, expiresAt],
        }),
      })
      if (!res.ok) {
        throw new Error(`Cloudflare D1 store failed: ${res.status}`)
      }
      return id
    },

    async check(id) {
      const now = new Date().toISOString()
      const res = await fetch(queryUrl(config), {
        method: 'POST',
        headers: headers(config),
        body: JSON.stringify({
          sql: 'SELECT 1 FROM shards WHERE id = ? AND expires_at > ?',
          params: [id, now],
        }),
      })
      if (!res.ok) return false
      const data: unknown = await res.json()
      const result = data as { result?: Array<{ results?: unknown[] }> }
      const rows = result.result?.[0]?.results
      return Array.isArray(rows) && rows.length > 0
    },

    async fetch(id) {
      const now = new Date().toISOString()
      const res = await fetch(queryUrl(config), {
        method: 'POST',
        headers: headers(config),
        body: JSON.stringify({
          sql: 'SELECT shard FROM shards WHERE id = ? AND expires_at > ?',
          params: [id, now],
        }),
      })
      if (!res.ok) {
        throw new Error(`Cloudflare D1 fetch failed: ${res.status}`)
      }
      const data: unknown = await res.json()
      const result = data as { result?: Array<{ results?: Array<{ shard?: string }> }> }
      const rows = result.result?.[0]?.results
      if (!Array.isArray(rows) || rows.length === 0) return null

      const shard = rows[0]?.shard
      if (typeof shard !== 'string') return null

      // Delete after read
      await fetch(queryUrl(config), {
        method: 'POST',
        headers: headers(config),
        body: JSON.stringify({
          sql: 'DELETE FROM shards WHERE id = ?',
          params: [id],
        }),
      })

      return shard
    },
  }
}

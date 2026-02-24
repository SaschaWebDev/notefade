import type { ProviderAdapter, UpstashConfig, VercelKVConfig } from '../provider-types'
import { generateShardId } from '../shard-id'

type UpstashLikeConfig = UpstashConfig | VercelKVConfig

function headers(config: UpstashLikeConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.k}`,
  }
}

export function createUpstashAdapter(config: UpstashLikeConfig): ProviderAdapter {
  const baseUrl = config.u.replace(/\/$/, '')

  return {
    async store(shard, ttl) {
      const id = generateShardId()
      const res = await fetch(`${baseUrl}/set/${id}/${encodeURIComponent(shard)}/ex/${ttl}`, {
        method: 'POST',
        headers: headers(config),
      })
      if (!res.ok) {
        throw new Error(`Upstash store failed: ${res.status}`)
      }
      return id
    },

    async check(id) {
      const res = await fetch(`${baseUrl}/exists/${id}`, {
        method: 'POST',
        headers: headers(config),
      })
      if (!res.ok) return false
      const data: unknown = await res.json()
      const result = data as { result?: number }
      return result.result === 1
    },

    async fetch(id) {
      const res = await fetch(`${baseUrl}/get/${id}`, {
        method: 'POST',
        headers: headers(config),
      })
      if (!res.ok) {
        throw new Error(`Upstash fetch failed: ${res.status}`)
      }
      const data: unknown = await res.json()
      const result = data as { result?: string | null }
      if (result.result === null || result.result === undefined) return null

      // Delete after read
      await fetch(`${baseUrl}/del/${id}`, {
        method: 'POST',
        headers: headers(config),
      })

      return result.result
    },

    async delete(id) {
      const checkRes = await fetch(`${baseUrl}/exists/${id}`, {
        method: 'POST',
        headers: headers(config),
      })
      if (!checkRes.ok) return false
      const checkData: unknown = await checkRes.json()
      const checkResult = checkData as { result?: number }
      if (checkResult.result !== 1) return false

      await fetch(`${baseUrl}/del/${id}`, {
        method: 'POST',
        headers: headers(config),
      })
      return true
    },
  }
}

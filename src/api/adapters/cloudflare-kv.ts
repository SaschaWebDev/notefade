import type { ProviderAdapter, CloudflareKVConfig } from '../provider-types'
import { generateShardId } from '../shard-id'

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

function kvUrl(config: CloudflareKVConfig, key: string): string {
  return `${CF_API_BASE}/accounts/${config.a}/storage/kv/namespaces/${config.n}/values/${key}`
}

function headers(config: CloudflareKVConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.k}`,
  }
}

export function createCloudflareKVAdapter(config: CloudflareKVConfig): ProviderAdapter {
  return {
    async store(shard, ttl) {
      const id = generateShardId()
      const url = `${kvUrl(config, id)}?expiration_ttl=${ttl}`
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers(config),
          'Content-Type': 'text/plain',
        },
        body: shard,
      })
      if (!res.ok) {
        throw new Error(`Cloudflare KV store failed: ${res.status}`)
      }
      return id
    },

    async check(id) {
      const res = await fetch(kvUrl(config, id), {
        method: 'GET',
        headers: headers(config),
      })
      return res.status === 200
    },

    async fetch(id) {
      const res = await fetch(kvUrl(config, id), {
        method: 'GET',
        headers: headers(config),
      })
      if (res.status === 404) return null
      if (!res.ok) {
        throw new Error(`Cloudflare KV fetch failed: ${res.status}`)
      }
      const text = await res.text()

      // Delete after read
      await fetch(kvUrl(config, id), {
        method: 'DELETE',
        headers: headers(config),
      })

      return text
    },

    async delete(id) {
      const checkRes = await fetch(kvUrl(config, id), {
        method: 'GET',
        headers: headers(config),
      })
      if (checkRes.status === 404) return false

      await fetch(kvUrl(config, id), {
        method: 'DELETE',
        headers: headers(config),
      })
      return true
    },
  }
}

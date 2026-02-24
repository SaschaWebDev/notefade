import type { ProviderAdapter, DynamoDBConfig } from '../provider-types'
import { storeShard, checkShard, fetchShard } from '../shard-api'

/** DynamoDB adapter: same as self-hosted but with x-api-key header via API Gateway */
export function createDynamoDBAdapter(config: DynamoDBConfig): ProviderAdapter {
  // The user deploys API Gateway → Lambda → DynamoDB
  // API Gateway expects x-api-key header, but the shard-api.ts uses
  // standard fetch calls. We wrap them with a custom fetch that injects
  // the header.
  const originalFetch = globalThis.fetch

  function wrappedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const newInit: RequestInit = {
      ...init,
      headers: {
        ...init?.headers,
        'x-api-key': config.k,
      },
    }
    return originalFetch(input, newInit)
  }

  return {
    async store(shard, ttl) {
      const saved = globalThis.fetch
      globalThis.fetch = wrappedFetch
      try {
        return await storeShard(shard, ttl, config.u)
      } finally {
        globalThis.fetch = saved
      }
    },

    async check(id) {
      const saved = globalThis.fetch
      globalThis.fetch = wrappedFetch
      try {
        return await checkShard(id, config.u)
      } finally {
        globalThis.fetch = saved
      }
    },

    async fetch(id) {
      const saved = globalThis.fetch
      globalThis.fetch = wrappedFetch
      try {
        return await fetchShard(id, config.u)
      } finally {
        globalThis.fetch = saved
      }
    },
  }
}

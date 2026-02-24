import type { ProviderConfig, ProviderAdapter } from './provider-types'
import { createSelfHostedAdapter } from './adapters/self-hosted'
import { createCloudflareKVAdapter } from './adapters/cloudflare-kv'
import { createCloudflareD1Adapter } from './adapters/cloudflare-d1'
import { createUpstashAdapter } from './adapters/upstash'
import { createSupabaseAdapter } from './adapters/supabase'
import { createDynamoDBAdapter } from './adapters/dynamodb'

export function createAdapter(config: ProviderConfig): ProviderAdapter {
  switch (config.t) {
    case 'self':
      return createSelfHostedAdapter(config)
    case 'cf-kv':
      return createCloudflareKVAdapter(config)
    case 'cf-d1':
      return createCloudflareD1Adapter(config)
    case 'upstash':
      return createUpstashAdapter(config)
    case 'vercel':
      // Vercel KV IS Upstash — same adapter
      return createUpstashAdapter(config)
    case 'supabase':
      return createSupabaseAdapter(config)
    case 'dynamodb':
      return createDynamoDBAdapter(config)
  }
}

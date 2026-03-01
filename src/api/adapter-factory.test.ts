import { describe, expect, it, vi } from 'vitest'

vi.mock('./adapters/self-hosted', () => ({
  createSelfHostedAdapter: vi.fn().mockReturnValue({ type: 'self' }),
}))
vi.mock('./adapters/cloudflare-kv', () => ({
  createCloudflareKVAdapter: vi.fn().mockReturnValue({ type: 'cf-kv' }),
}))
vi.mock('./adapters/cloudflare-d1', () => ({
  createCloudflareD1Adapter: vi.fn().mockReturnValue({ type: 'cf-d1' }),
}))
vi.mock('./adapters/upstash', () => ({
  createUpstashAdapter: vi.fn().mockReturnValue({ type: 'upstash' }),
}))
vi.mock('./adapters/supabase', () => ({
  createSupabaseAdapter: vi.fn().mockReturnValue({ type: 'supabase' }),
}))
vi.mock('./adapters/dynamodb', () => ({
  createDynamoDBAdapter: vi.fn().mockReturnValue({ type: 'dynamodb' }),
}))

import { createAdapter } from './adapter-factory'
import { createSelfHostedAdapter } from './adapters/self-hosted'
import { createCloudflareKVAdapter } from './adapters/cloudflare-kv'
import { createCloudflareD1Adapter } from './adapters/cloudflare-d1'
import { createUpstashAdapter } from './adapters/upstash'
import { createSupabaseAdapter } from './adapters/supabase'
import { createDynamoDBAdapter } from './adapters/dynamodb'
import type { ProviderConfig } from './provider-types'

describe('adapter-factory', () => {
  it('routes self to createSelfHostedAdapter', () => {
    const config: ProviderConfig = { t: 'self', u: 'https://x.com' }
    createAdapter(config)
    expect(createSelfHostedAdapter).toHaveBeenCalledWith(config)
  })

  it('routes cf-kv to createCloudflareKVAdapter', () => {
    const config: ProviderConfig = { t: 'cf-kv', a: 'a', n: 'n', k: 'k' }
    createAdapter(config)
    expect(createCloudflareKVAdapter).toHaveBeenCalledWith(config)
  })

  it('routes cf-d1 to createCloudflareD1Adapter', () => {
    const config: ProviderConfig = { t: 'cf-d1', a: 'a', d: 'd', k: 'k' }
    createAdapter(config)
    expect(createCloudflareD1Adapter).toHaveBeenCalledWith(config)
  })

  it('routes upstash to createUpstashAdapter', () => {
    const config: ProviderConfig = { t: 'upstash', u: 'u', k: 'k' }
    createAdapter(config)
    expect(createUpstashAdapter).toHaveBeenCalledWith(config)
  })

  it('routes vercel to createUpstashAdapter (same adapter)', () => {
    const config: ProviderConfig = { t: 'vercel', u: 'u', k: 'k' }
    createAdapter(config)
    expect(createUpstashAdapter).toHaveBeenCalledWith(config)
  })

  it('routes supabase to createSupabaseAdapter', () => {
    const config: ProviderConfig = { t: 'supabase', u: 'u', k: 'k' }
    createAdapter(config)
    expect(createSupabaseAdapter).toHaveBeenCalledWith(config)
  })

  it('routes dynamodb to createDynamoDBAdapter', () => {
    const config: ProviderConfig = { t: 'dynamodb', u: 'u', k: 'k' }
    createAdapter(config)
    expect(createDynamoDBAdapter).toHaveBeenCalledWith(config)
  })
})

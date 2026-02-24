export type ProviderType =
  | 'self'
  | 'cf-kv'
  | 'cf-d1'
  | 'upstash'
  | 'vercel'
  | 'supabase'
  | 'dynamodb'

/** Short-key configs to minimize URL length */
export interface SelfHostedConfig {
  t: 'self'
  u: string // api url
}

export interface CloudflareKVConfig {
  t: 'cf-kv'
  a: string // account id
  n: string // namespace id
  k: string // api token
}

export interface CloudflareD1Config {
  t: 'cf-d1'
  a: string // account id
  d: string // database id
  k: string // api token
}

export interface UpstashConfig {
  t: 'upstash'
  u: string // rest url
  k: string // rest token
}

export interface VercelKVConfig {
  t: 'vercel'
  u: string // rest url
  k: string // rest token
}

export interface SupabaseConfig {
  t: 'supabase'
  u: string // project url
  k: string // anon key
}

export interface DynamoDBConfig {
  t: 'dynamodb'
  u: string // api gateway url
  k: string // api key
}

export type ProviderConfig =
  | SelfHostedConfig
  | CloudflareKVConfig
  | CloudflareD1Config
  | UpstashConfig
  | VercelKVConfig
  | SupabaseConfig
  | DynamoDBConfig

export interface ProviderField {
  key: string
  label: string
  placeholder: string
  secret: boolean
  hint?: string
}

export interface ProviderAdapter {
  store(shard: string, ttl: number): Promise<string>
  check(id: string): Promise<boolean>
  fetch(id: string): Promise<string | null>
  delete(id: string): Promise<boolean>
}

import { z } from 'zod'
import { stringToBase64Url, stringFromBase64Url } from '@/crypto'
import type { ProviderConfig } from './provider-types'

// --- Zod schemas for each provider config variant ---

const SelfHostedSchema = z.object({
  t: z.literal('self'),
  u: z.string().min(1),
})

const CloudflareKVSchema = z.object({
  t: z.literal('cf-kv'),
  a: z.string().min(1),
  n: z.string().min(1),
  k: z.string().min(1),
})

const CloudflareD1Schema = z.object({
  t: z.literal('cf-d1'),
  a: z.string().min(1),
  d: z.string().min(1),
  k: z.string().min(1),
})

const UpstashSchema = z.object({
  t: z.literal('upstash'),
  u: z.string().min(1),
  k: z.string().min(1),
})

const VercelKVSchema = z.object({
  t: z.literal('vercel'),
  u: z.string().min(1),
  k: z.string().min(1),
})

const SupabaseSchema = z.object({
  t: z.literal('supabase'),
  u: z.string().min(1),
  k: z.string().min(1),
})

const DynamoDBSchema = z.object({
  t: z.literal('dynamodb'),
  u: z.string().min(1),
  k: z.string().min(1),
})

const ProviderConfigSchema = z.discriminatedUnion('t', [
  SelfHostedSchema,
  CloudflareKVSchema,
  CloudflareD1Schema,
  UpstashSchema,
  VercelKVSchema,
  SupabaseSchema,
  DynamoDBSchema,
])

// --- Encode / Decode ---

/** Encode provider config for URL suffix. Self-hosted uses plain URL for shorter encoding. */
export function encodeProviderConfig(config: ProviderConfig): string {
  if (config.t === 'self') {
    return stringToBase64Url(config.u)
  }
  return stringToBase64Url(JSON.stringify(config))
}

/**
 * Decode provider config from URL suffix.
 * Backward compat: plain URL → {t:'self', u:decoded}, JSON → Zod-validated config.
 */
export function decodeProviderConfig(encoded: string): ProviderConfig {
  const decoded = stringFromBase64Url(encoded)

  // Backward compat: plain URLs from Phase 1
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
    return { t: 'self', u: decoded }
  }

  // JSON config — parse and validate
  const json: unknown = JSON.parse(decoded)
  return ProviderConfigSchema.parse(json)
}

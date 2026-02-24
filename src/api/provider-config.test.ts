import { describe, expect, it } from 'vitest'
import { encodeProviderConfig, decodeProviderConfig } from './provider-config'
import { stringToBase64Url, stringFromBase64Url } from '@/crypto'
import type { ProviderConfig } from './provider-types'

describe('encodeProviderConfig / decodeProviderConfig', () => {
  it('round-trips a self-hosted config', () => {
    const config: ProviderConfig = { t: 'self', u: 'https://my-worker.example.com' }
    const encoded = encodeProviderConfig(config)
    const decoded = decodeProviderConfig(encoded)
    expect(decoded).toEqual(config)
  })

  it('round-trips a Cloudflare KV config', () => {
    const config: ProviderConfig = { t: 'cf-kv', a: 'acct123', n: 'ns456', k: 'tok789' }
    const encoded = encodeProviderConfig(config)
    const decoded = decodeProviderConfig(encoded)
    expect(decoded).toEqual(config)
  })

  it('round-trips an Upstash config', () => {
    const config: ProviderConfig = { t: 'upstash', u: 'https://xxx.upstash.io', k: 'AXxx' }
    const encoded = encodeProviderConfig(config)
    const decoded = decodeProviderConfig(encoded)
    expect(decoded).toEqual(config)
  })

  it('round-trips a Vercel KV config', () => {
    const config: ProviderConfig = { t: 'vercel', u: 'https://xxx.kv.vercel-storage.com', k: 'tok' }
    const encoded = encodeProviderConfig(config)
    const decoded = decodeProviderConfig(encoded)
    expect(decoded).toEqual(config)
  })

  it('round-trips a Cloudflare D1 config', () => {
    const config: ProviderConfig = { t: 'cf-d1', a: 'acct', d: 'db-id', k: 'tok' }
    const encoded = encodeProviderConfig(config)
    const decoded = decodeProviderConfig(encoded)
    expect(decoded).toEqual(config)
  })

  it('round-trips a Supabase config', () => {
    const config: ProviderConfig = { t: 'supabase', u: 'https://xxx.supabase.co', k: 'anon' }
    const encoded = encodeProviderConfig(config)
    const decoded = decodeProviderConfig(encoded)
    expect(decoded).toEqual(config)
  })

  it('round-trips a DynamoDB config', () => {
    const config: ProviderConfig = { t: 'dynamodb', u: 'https://xxx.execute-api.us-east-1.amazonaws.com/prod', k: 'key123' }
    const encoded = encodeProviderConfig(config)
    const decoded = decodeProviderConfig(encoded)
    expect(decoded).toEqual(config)
  })

  it('backward compat: plain URL decodes to self-hosted', () => {
    const encoded = stringToBase64Url('https://old-server.com')
    const decoded = decodeProviderConfig(encoded)
    expect(decoded).toEqual({ t: 'self', u: 'https://old-server.com' })
  })

  it('self-hosted encodes as plain URL (shorter)', () => {
    const config: ProviderConfig = { t: 'self', u: 'https://example.com' }
    const encoded = encodeProviderConfig(config)
    const raw = stringFromBase64Url(encoded)
    expect(raw).toBe('https://example.com')
  })

  it('throws on invalid JSON config', () => {
    const encoded = stringToBase64Url('{"t":"invalid","x":"y"}')
    expect(() => decodeProviderConfig(encoded)).toThrow()
  })

  it('throws on missing required fields', () => {
    const encoded = stringToBase64Url('{"t":"cf-kv","a":"acct"}')
    expect(() => decodeProviderConfig(encoded)).toThrow()
  })
})

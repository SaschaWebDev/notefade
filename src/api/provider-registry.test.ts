import { describe, expect, it } from 'vitest'
import { PROVIDERS, getProviderEntry, getProviderLabel } from './provider-registry'
import type { ProviderType } from './provider-types'

describe('provider-registry', () => {
  it('PROVIDERS has 7 entries', () => {
    expect(PROVIDERS).toHaveLength(7)
  })

  it.each<ProviderType>([
    'self',
    'cf-kv',
    'cf-d1',
    'upstash',
    'vercel',
    'supabase',
    'dynamodb',
  ])('PROVIDERS includes type "%s"', (type) => {
    expect(PROVIDERS.find((p) => p.type === type)).toBeDefined()
  })

  it('all entries have required properties', () => {
    for (const entry of PROVIDERS) {
      expect(entry.type).toBeTruthy()
      expect(entry.label).toBeTruthy()
      expect(Array.isArray(entry.fields)).toBe(true)
      expect(entry.fields.length).toBeGreaterThan(0)
      expect(typeof entry.showCredentialWarning).toBe('boolean')
    }
  })

  it('all fields have required properties', () => {
    for (const entry of PROVIDERS) {
      for (const field of entry.fields) {
        expect(field.key).toBeTruthy()
        expect(field.label).toBeTruthy()
        expect(field.placeholder).toBeTruthy()
        expect(typeof field.secret).toBe('boolean')
      }
    }
  })

  it('self-hosted does not show credential warning', () => {
    const self = PROVIDERS.find((p) => p.type === 'self')
    expect(self?.showCredentialWarning).toBe(false)
  })

  it('all non-self providers show credential warning', () => {
    const nonSelf = PROVIDERS.filter((p) => p.type !== 'self')
    for (const entry of nonSelf) {
      expect(entry.showCredentialWarning).toBe(true)
    }
  })

  // --- getProviderEntry ---

  it('getProviderEntry returns entry for known type', () => {
    const entry = getProviderEntry('cf-kv')
    expect(entry).toBeDefined()
    expect(entry?.type).toBe('cf-kv')
    expect(entry?.label).toBe('Cloudflare KV')
  })

  it('getProviderEntry returns undefined for unknown type', () => {
    const entry = getProviderEntry('nonexistent' as ProviderType)
    expect(entry).toBeUndefined()
  })

  // --- getProviderLabel ---

  it('getProviderLabel returns label for known type', () => {
    expect(getProviderLabel('supabase')).toBe('Supabase')
    expect(getProviderLabel('dynamodb')).toBe('AWS DynamoDB')
  })

  it('getProviderLabel returns type string as fallback for unknown', () => {
    expect(getProviderLabel('nonexistent' as ProviderType)).toBe('nonexistent')
  })
})

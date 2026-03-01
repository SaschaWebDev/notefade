import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/crypto', () => ({
  unpadPayload: (s: string) => s,
  stringFromBase64Url: vi.fn(),
}))

vi.mock('@/api/provider-config', () => ({
  decodeProviderConfig: vi.fn(),
}))

import { parseFragment } from './use-hash-route'
import { stringFromBase64Url } from '@/crypto'
import { decodeProviderConfig } from '@/api/provider-config'

const mockStringFromBase64Url = vi.mocked(stringFromBase64Url)
const mockDecodeProviderConfig = vi.mocked(decodeProviderConfig)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('parseFragment', () => {
  it('returns null for empty string', () => {
    expect(parseFragment('')).toBeNull()
  })

  it('returns null for string without colon', () => {
    expect(parseFragment('nocolonhere')).toBeNull()
  })

  it('returns null when shardId is empty', () => {
    expect(parseFragment(':rest')).toBeNull()
  })

  it('returns null when rest is empty', () => {
    expect(parseFragment('shardId:')).toBeNull()
  })

  // --- Two-colon (new) format ---

  it('parses two-colon format: shardId:check:payload', () => {
    const result = parseFragment('abc123:checkval:urlpayload')
    expect(result).toEqual({
      shardId: 'abc123',
      check: 'checkval',
      urlPayload: 'urlpayload',
      provider: null,
    })
  })

  it('returns null when check is empty in two-colon format', () => {
    expect(parseFragment('abc123::payload')).toBeNull()
  })

  it('returns null when payload is empty in two-colon format', () => {
    expect(parseFragment('abc123:check:')).toBeNull()
  })

  // --- One-colon (legacy) format ---

  it('parses one-colon legacy format with null check', () => {
    const result = parseFragment('abc123:urlpayload')
    expect(result).toEqual({
      shardId: 'abc123',
      check: null,
      urlPayload: 'urlpayload',
      provider: null,
    })
  })

  // --- Provider extraction ---

  it('extracts provider via @ suffix with decodeProviderConfig', () => {
    mockDecodeProviderConfig.mockReturnValueOnce({
      t: 'cf-kv',
      a: 'acc',
      n: 'ns',
      k: 'tok',
    })
    const result = parseFragment('abc123:check:payload@encoded')
    expect(result).toEqual({
      shardId: 'abc123',
      check: 'check',
      urlPayload: 'payload',
      provider: { t: 'cf-kv', a: 'acc', n: 'ns', k: 'tok' },
    })
    expect(mockDecodeProviderConfig).toHaveBeenCalledWith('encoded')
  })

  it('falls back to legacy URL decode when decodeProviderConfig fails', () => {
    mockDecodeProviderConfig.mockImplementationOnce(() => {
      throw new Error('invalid')
    })
    mockStringFromBase64Url.mockReturnValueOnce('https://custom.example.com')

    const result = parseFragment('abc123:payload@legacyenc')
    expect(result).toEqual({
      shardId: 'abc123',
      check: null,
      urlPayload: 'payload',
      provider: { t: 'self', u: 'https://custom.example.com' },
    })
  })

  it('returns whole string as payload when both decode attempts fail', () => {
    mockDecodeProviderConfig.mockImplementationOnce(() => {
      throw new Error('fail')
    })
    mockStringFromBase64Url.mockImplementationOnce(() => {
      throw new Error('fail')
    })

    const result = parseFragment('abc123:payload@garbage')
    expect(result).toEqual({
      shardId: 'abc123',
      check: null,
      urlPayload: 'payload@garbage',
      provider: null,
    })
  })

  it('returns null provider when no @ in payload', () => {
    const result = parseFragment('abc123:check:payloadwithout')
    expect(result?.provider).toBeNull()
  })

  it('legacy decode: non-URL string falls through to whole payload', () => {
    mockDecodeProviderConfig.mockImplementationOnce(() => {
      throw new Error('fail')
    })
    mockStringFromBase64Url.mockReturnValueOnce('not-a-url')

    const result = parseFragment('abc123:payload@noturl')
    expect(result).toEqual({
      shardId: 'abc123',
      check: null,
      urlPayload: 'payload@noturl',
      provider: null,
    })
  })

  it('handles @ at start (empty payload before @)', () => {
    // If maybePayload is empty, extractProvider returns whole string
    const result = parseFragment('abc123:@encoded')
    expect(result).toEqual({
      shardId: 'abc123',
      check: null,
      urlPayload: '@encoded',
      provider: null,
    })
  })

  it('handles @ at end (empty encoded after @)', () => {
    const result = parseFragment('abc123:payload@')
    expect(result).toEqual({
      shardId: 'abc123',
      check: null,
      urlPayload: 'payload@',
      provider: null,
    })
  })

  it('provider extraction works in legacy one-colon format', () => {
    mockDecodeProviderConfig.mockReturnValueOnce({
      t: 'supabase',
      u: 'https://x.supabase.co',
      k: 'key',
    })

    const result = parseFragment('abc123:payload@config')
    expect(result).toEqual({
      shardId: 'abc123',
      check: null,
      urlPayload: 'payload',
      provider: { t: 'supabase', u: 'https://x.supabase.co', k: 'key' },
    })
  })
})

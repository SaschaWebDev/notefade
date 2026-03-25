import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/crypto', () => ({
  unpadPayload: (s: string) => s,
  stringFromBase64Url: vi.fn(),
  extractTimeLock: vi.fn(() => null),
}))

vi.mock('@/api/provider-config', () => ({
  decodeProviderConfig: vi.fn(),
}))

import { parseFragment, extractByokKey } from '@/hooks/use-hash-route'
import { stringFromBase64Url, extractTimeLock } from '@/crypto'
import { decodeProviderConfig } from '@/api/provider-config'

const mockStringFromBase64Url = vi.mocked(stringFromBase64Url)
const mockDecodeProviderConfig = vi.mocked(decodeProviderConfig)
const mockExtractTimeLock = vi.mocked(extractTimeLock)

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
      shardIds: ['abc123'],
      check: 'checkval',
      urlPayload: 'urlpayload',
      provider: null,
      timeLockAt: null,
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
      shardIds: ['abc123'],
      check: null,
      urlPayload: 'urlpayload',
      provider: null,
      timeLockAt: null,
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
      shardIds: ['abc123'],
      check: 'check',
      urlPayload: 'payload',
      provider: { t: 'cf-kv', a: 'acc', n: 'ns', k: 'tok' },
      timeLockAt: null,
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
      shardIds: ['abc123'],
      check: null,
      urlPayload: 'payload',
      provider: { t: 'self', u: 'https://custom.example.com' },
      timeLockAt: null,
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
      shardIds: ['abc123'],
      check: null,
      urlPayload: 'payload@garbage',
      provider: null,
      timeLockAt: null,
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
      shardIds: ['abc123'],
      check: null,
      urlPayload: 'payload@noturl',
      provider: null,
      timeLockAt: null,
    })
  })

  it('handles @ at start (empty payload before @)', () => {
    // If maybePayload is empty, extractProvider returns whole string
    const result = parseFragment('abc123:@encoded')
    expect(result).toEqual({
      shardId: 'abc123',
      shardIds: ['abc123'],
      check: null,
      urlPayload: '@encoded',
      provider: null,
      timeLockAt: null,
    })
  })

  it('handles @ at end (empty encoded after @)', () => {
    const result = parseFragment('abc123:payload@')
    expect(result).toEqual({
      shardId: 'abc123',
      shardIds: ['abc123'],
      check: null,
      urlPayload: 'payload@',
      provider: null,
      timeLockAt: null,
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
      shardIds: ['abc123'],
      check: null,
      urlPayload: 'payload',
      provider: { t: 'supabase', u: 'https://x.supabase.co', k: 'key' },
      timeLockAt: null,
    })
  })

  // --- Steganographic time-lock extraction ---

  it('extracts steganographic time-lock from padded payload', () => {
    mockExtractTimeLock.mockReturnValueOnce(1735689600)
    const result = parseFragment('abc123:checkval:.paddedpayload')
    expect(result?.timeLockAt).toBe(1735689600)
    expect(mockExtractTimeLock).toHaveBeenCalledWith('.paddedpayload', 'checkval')
  })

  it('prefers tl: prefix over steganographic extraction', () => {
    const result = parseFragment('tl:1735689600:abc123:checkval:.paddedpayload')
    expect(result?.timeLockAt).toBe(1735689600)
    expect(mockExtractTimeLock).not.toHaveBeenCalled()
  })

  it('does not attempt stego extraction for non-padded payloads', () => {
    const result = parseFragment('abc123:checkval:rawpayload')
    expect(result?.timeLockAt).toBeNull()
    expect(mockExtractTimeLock).not.toHaveBeenCalled()
  })

  it('stego extraction returns null gracefully when no timestamp embedded', () => {
    // Default mock returns null
    const result = parseFragment('abc123:checkval:.paddednots')
    expect(result?.timeLockAt).toBeNull()
    expect(mockExtractTimeLock).toHaveBeenCalledWith('.paddednots', 'checkval')
  })

  it('backward compat: old tl: prefix URLs still parse correctly', () => {
    const result = parseFragment('tl:1800000000:abc123:checkval:urlpayload')
    expect(result).toEqual({
      shardId: 'abc123',
      shardIds: ['abc123'],
      check: 'checkval',
      urlPayload: 'urlpayload',
      provider: null,
      timeLockAt: 1800000000,
    })
  })
})

describe('extractByokKey', () => {
  // A valid 32-byte key in base64url is 43 chars
  const validKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

  it('extracts valid BYOK key after ! delimiter', () => {
    const result = extractByokKey(`abc123:check:payload!${validKey}`)
    expect(result.byokKey).toBe(validKey)
    expect(result.hash).toBe('abc123:check:payload')
  })

  it('returns null byokKey when no ! present', () => {
    const result = extractByokKey('abc123:check:payload')
    expect(result.byokKey).toBeNull()
    expect(result.hash).toBe('abc123:check:payload')
  })

  it('returns null byokKey when candidate is too short', () => {
    const result = extractByokKey('abc123:check:payload!shortkey')
    expect(result.byokKey).toBeNull()
    expect(result.hash).toBe('abc123:check:payload!shortkey')
  })

  it('returns null byokKey when candidate is too long', () => {
    const longKey = 'A'.repeat(55)
    const result = extractByokKey(`abc123:check:payload!${longKey}`)
    expect(result.byokKey).toBeNull()
    expect(result.hash).toBe(`abc123:check:payload!${longKey}`)
  })

  it('returns null byokKey when candidate has invalid chars', () => {
    const badKey = 'A'.repeat(43).slice(0, 40) + '!!!'
    const result = extractByokKey(`abc123:check:payload!${badKey}`)
    expect(result.byokKey).toBeNull()
  })

  it('works with protected: prefix', () => {
    const result = extractByokKey(`protected:encdata!${validKey}`)
    expect(result.byokKey).toBe(validKey)
    expect(result.hash).toBe('protected:encdata')
  })

  it('works with multi: prefix', () => {
    const result = extractByokKey(`multi:chunk1|chunk2!${validKey}`)
    expect(result.byokKey).toBe(validKey)
    expect(result.hash).toBe('multi:chunk1|chunk2')
  })

  it('works with tl: prefix and provider suffix', () => {
    const result = extractByokKey(`tl:1234:abc:check:payload@config!${validKey}`)
    expect(result.byokKey).toBe(validKey)
    expect(result.hash).toBe('tl:1234:abc:check:payload@config')
  })

  it('uses lastIndexOf to handle ! in earlier positions', () => {
    // If there is a ! in an earlier position (unlikely but possible),
    // lastIndexOf ensures we pick the last one
    const result = extractByokKey(`some!thing:check:payload!${validKey}`)
    expect(result.byokKey).toBe(validKey)
    expect(result.hash).toBe('some!thing:check:payload')
  })

  it('accepts keys with base64url special chars - and _', () => {
    const keyWithSpecial = 'AAAA-BBBB_CCCC-DDDD_EEEE-FFFF_GGGG-HHHH_II'
    expect(keyWithSpecial.length).toBeGreaterThanOrEqual(40)
    expect(keyWithSpecial.length).toBeLessThanOrEqual(50)
    const result = extractByokKey(`abc123:check:payload!${keyWithSpecial}`)
    expect(result.byokKey).toBe(keyWithSpecial)
  })
})

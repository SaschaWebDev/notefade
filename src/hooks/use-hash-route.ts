import { useState, useEffect } from 'react'
import { stringFromBase64Url, unpadPayload, extractTimeLock } from '@/crypto'
import { decodeProviderConfig } from '@/api/provider-config'
import type { ProviderConfig } from '@/api/provider-types'
import { PROTECTED_PREFIX, TIME_LOCK_PREFIX, MULTI_PREFIX, MULTI_DELIMITER, BYOK_DELIMITER } from '@/constants'

interface CreateRoute {
  mode: 'create'
}

interface ReadRoute {
  mode: 'read'
  shardId: string
  /** Additional shard IDs for multi-read notes (Feature 1) */
  shardIds: string[]
  urlPayload: string
  check: string | null
  provider: ProviderConfig | null
  /** Unix timestamp when time-locked note becomes readable (Feature 2) */
  timeLockAt: number | null
  /** Additional chunks for multi-note long messages (null = single note) */
  multiChunks: ParsedFragment[] | null
  /** BYOK decryption key (base64url) for pre-encrypted content */
  byokKey: string | null
}

interface ProtectedRoute {
  mode: 'protected'
  protectedData: string
  /** BYOK decryption key (base64url) for pre-encrypted content */
  byokKey: string | null
}

export type HashRoute = CreateRoute | ReadRoute | ProtectedRoute

export interface ParsedFragment {
  shardId: string
  /** All shard IDs for multi-read (first is shardId) */
  shardIds: string[]
  urlPayload: string
  check: string | null
  provider: ProviderConfig | null
  timeLockAt: number | null
}

/** Split urlPayload from an optional @<base64url(config)> suffix */
function extractProvider(raw: string): { urlPayload: string; provider: ProviderConfig | null } {
  const atIndex = raw.lastIndexOf('@')
  if (atIndex === -1) {
    return { urlPayload: raw, provider: null }
  }

  const maybePayload = raw.slice(0, atIndex)
  const maybeEncoded = raw.slice(atIndex + 1)

  if (!maybePayload || !maybeEncoded) {
    return { urlPayload: raw, provider: null }
  }

  try {
    // First try JSON-based decode (new format)
    const config = decodeProviderConfig(maybeEncoded)
    return { urlPayload: maybePayload, provider: config }
  } catch {
    // Try legacy plain URL decode for backward compat
    try {
      const decoded = stringFromBase64Url(maybeEncoded)
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return { urlPayload: maybePayload, provider: { t: 'self', u: decoded } }
      }
    } catch {
      // Decode failure → treat the whole string as urlPayload
    }
  }

  return { urlPayload: raw, provider: null }
}

/** Parse a raw fragment string (without the # prefix) into its components */
export function parseFragment(fragment: string): ParsedFragment | null {
  if (!fragment) {
    return null
  }

  let working = fragment
  let timeLockAt: number | null = null

  // Check for time-lock prefix: tl:<unix_timestamp>:
  if (working.startsWith(TIME_LOCK_PREFIX)) {
    const tlRest = working.slice(TIME_LOCK_PREFIX.length)
    const tlColon = tlRest.indexOf(':')
    if (tlColon === -1) return null
    const timestamp = parseInt(tlRest.slice(0, tlColon), 10)
    if (isNaN(timestamp)) return null
    timeLockAt = timestamp
    working = tlRest.slice(tlColon + 1)
  }

  const colonIndex = working.indexOf(':')
  if (colonIndex === -1) {
    return null
  }

  const shardIdPart = working.slice(0, colonIndex)
  const rest = working.slice(colonIndex + 1)

  if (!shardIdPart || !rest) {
    return null
  }

  // Parse multi-read shard IDs: id1~id2~id3
  const shardIds = shardIdPart.split('~').filter(Boolean)
  if (shardIds.length === 0) return null
  const shardId = shardIds[0]!

  // New format: shardId(s):check:urlPayload[@encodedConfig] (two colons)
  // Old format: shardId:urlPayload (one colon)
  const secondColon = rest.indexOf(':')
  if (secondColon !== -1) {
    const check = rest.slice(0, secondColon)
    const rawPayload = rest.slice(secondColon + 1)
    if (!check || !rawPayload) {
      return null
    }
    const { urlPayload: rawUrlPayload, provider } = extractProvider(rawPayload)

    // Try steganographic time-lock extraction for padded payloads without tl: prefix
    if (timeLockAt === null && rawUrlPayload.startsWith('.')) {
      const stegoTs = extractTimeLock(rawUrlPayload, check)
      if (stegoTs != null) {
        timeLockAt = stegoTs
      }
    }

    return { shardId, shardIds, check, urlPayload: unpadPayload(rawUrlPayload), provider, timeLockAt }
  }

  const { urlPayload: rawUrlPayload, provider } = extractProvider(rest)
  return { shardId, shardIds, check: null, urlPayload: unpadPayload(rawUrlPayload), provider, timeLockAt }
}

/** Parse a multi-chunk fragment (body after "multi:" prefix) into chunk array */
export function parseMultiFragment(body: string): ParsedFragment[] | null {
  const parts = body.split(MULTI_DELIMITER)
  if (parts.length < 2) return null

  const chunks: ParsedFragment[] = []
  for (const part of parts) {
    const parsed = parseFragment(part)
    if (!parsed) return null
    chunks.push(parsed)
  }
  return chunks
}

/** Extract a BYOK key suffix (!keyBase64url) from a hash string */
export function extractByokKey(raw: string): { hash: string; byokKey: string | null } {
  const bangIndex = raw.lastIndexOf(BYOK_DELIMITER)
  if (bangIndex === -1) {
    return { hash: raw, byokKey: null }
  }
  const candidate = raw.slice(bangIndex + 1)
  // 32-byte key in base64url is ~43 chars; allow 40-50 for padding variance
  if (candidate && /^[A-Za-z0-9_-]{40,50}$/.test(candidate)) {
    return { hash: raw.slice(0, bangIndex), byokKey: candidate }
  }
  return { hash: raw, byokKey: null }
}

function parseHash(): HashRoute {
  const rawHash = window.location.hash.slice(1) // remove #
  if (!rawHash) {
    return { mode: 'create' }
  }

  // Extract BYOK key suffix before any other parsing
  const { hash, byokKey } = extractByokKey(rawHash)

  // Check for password-protected fragment
  if (hash.startsWith(PROTECTED_PREFIX)) {
    const protectedData = hash.slice(PROTECTED_PREFIX.length)
    if (protectedData) {
      return { mode: 'protected', protectedData, byokKey }
    }
    return { mode: 'create' }
  }

  // Check for multi-chunk fragment
  if (hash.startsWith(MULTI_PREFIX)) {
    const body = hash.slice(MULTI_PREFIX.length)
    const chunks = parseMultiFragment(body)
    if (!chunks || chunks.length === 0) return { mode: 'create' }
    const first = chunks[0]!
    return { mode: 'read', ...first, multiChunks: chunks, byokKey }
  }

  const parsed = parseFragment(hash)
  if (!parsed) {
    return { mode: 'create' }
  }

  return { mode: 'read', ...parsed, multiChunks: null, byokKey }
}

export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<HashRoute>(parseHash)

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  return route
}

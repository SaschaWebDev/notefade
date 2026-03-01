import { useState, useEffect } from 'react'
import { stringFromBase64Url, unpadPayload } from '@/crypto'
import { decodeProviderConfig } from '@/api/provider-config'
import type { ProviderConfig } from '@/api/provider-types'

interface CreateRoute {
  mode: 'create'
}

interface ReadRoute {
  mode: 'read'
  shardId: string
  urlPayload: string
  check: string | null
  provider: ProviderConfig | null
}

interface ProtectedRoute {
  mode: 'protected'
  protectedData: string
}

export type HashRoute = CreateRoute | ReadRoute | ProtectedRoute

export interface ParsedFragment {
  shardId: string
  urlPayload: string
  check: string | null
  provider: ProviderConfig | null
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

  const colonIndex = fragment.indexOf(':')
  if (colonIndex === -1) {
    return null
  }

  const shardId = fragment.slice(0, colonIndex)
  const rest = fragment.slice(colonIndex + 1)

  if (!shardId || !rest) {
    return null
  }

  // New format: shardId:check:urlPayload[@encodedConfig] (two colons)
  // Old format: shardId:urlPayload (one colon)
  const secondColon = rest.indexOf(':')
  if (secondColon !== -1) {
    const check = rest.slice(0, secondColon)
    const rawPayload = rest.slice(secondColon + 1)
    if (!check || !rawPayload) {
      return null
    }
    const { urlPayload: rawUrlPayload, provider } = extractProvider(rawPayload)
    return { shardId, check, urlPayload: unpadPayload(rawUrlPayload), provider }
  }

  const { urlPayload: rawUrlPayload, provider } = extractProvider(rest)
  return { shardId, check: null, urlPayload: unpadPayload(rawUrlPayload), provider }
}

function parseHash(): HashRoute {
  const hash = window.location.hash.slice(1) // remove #
  if (!hash) {
    return { mode: 'create' }
  }

  // Check for password-protected fragment
  if (hash.startsWith('protected:')) {
    const protectedData = hash.slice('protected:'.length)
    if (protectedData) {
      return { mode: 'protected', protectedData }
    }
    return { mode: 'create' }
  }

  const parsed = parseFragment(hash)
  if (!parsed) {
    return { mode: 'create' }
  }

  return { mode: 'read', ...parsed }
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

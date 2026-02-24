import { useState, useEffect } from 'react'
import { stringFromBase64Url } from '@/crypto'
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

export type HashRoute = CreateRoute | ReadRoute

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

function parseHash(): HashRoute {
  const hash = window.location.hash.slice(1) // remove #
  if (!hash) {
    return { mode: 'create' }
  }

  const colonIndex = hash.indexOf(':')
  if (colonIndex === -1) {
    return { mode: 'create' }
  }

  const shardId = hash.slice(0, colonIndex)
  const rest = hash.slice(colonIndex + 1)

  if (!shardId || !rest) {
    return { mode: 'create' }
  }

  // New format: shardId:check:urlPayload[@encodedConfig] (two colons)
  // Old format: shardId:urlPayload (one colon)
  const secondColon = rest.indexOf(':')
  if (secondColon !== -1) {
    const check = rest.slice(0, secondColon)
    const rawPayload = rest.slice(secondColon + 1)
    if (!check || !rawPayload) {
      return { mode: 'create' }
    }
    const { urlPayload, provider } = extractProvider(rawPayload)
    return { mode: 'read', shardId, check, urlPayload, provider }
  }

  const { urlPayload, provider } = extractProvider(rest)
  return { mode: 'read', shardId, check: null, urlPayload, provider }
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

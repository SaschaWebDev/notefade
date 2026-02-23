import { useState, useEffect } from 'react'
import { stringFromBase64Url } from '@/crypto'

interface CreateRoute {
  mode: 'create'
}

interface ReadRoute {
  mode: 'read'
  shardId: string
  urlPayload: string
  check: string | null
  apiUrl: string | null
}

export type HashRoute = CreateRoute | ReadRoute

/** Split urlPayload from an optional @<base64url(apiUrl)> suffix */
function extractApiUrl(raw: string): { urlPayload: string; apiUrl: string | null } {
  const atIndex = raw.lastIndexOf('@')
  if (atIndex === -1) {
    return { urlPayload: raw, apiUrl: null }
  }

  const maybePayload = raw.slice(0, atIndex)
  const maybeEncoded = raw.slice(atIndex + 1)

  if (!maybePayload || !maybeEncoded) {
    return { urlPayload: raw, apiUrl: null }
  }

  try {
    const decoded = stringFromBase64Url(maybeEncoded)
    // Basic sanity: must look like a URL
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return { urlPayload: maybePayload, apiUrl: decoded }
    }
  } catch {
    // Decode failure → treat the whole string as urlPayload (backward compat)
  }

  return { urlPayload: raw, apiUrl: null }
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

  // New format: shardId:check:urlPayload[@encodedApiUrl] (two colons)
  // Old format: shardId:urlPayload (one colon)
  const secondColon = rest.indexOf(':')
  if (secondColon !== -1) {
    const check = rest.slice(0, secondColon)
    const rawPayload = rest.slice(secondColon + 1)
    if (!check || !rawPayload) {
      return { mode: 'create' }
    }
    const { urlPayload, apiUrl } = extractApiUrl(rawPayload)
    return { mode: 'read', shardId, check, urlPayload, apiUrl }
  }

  const { urlPayload, apiUrl } = extractApiUrl(rest)
  return { mode: 'read', shardId, check: null, urlPayload, apiUrl }
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

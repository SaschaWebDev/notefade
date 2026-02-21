import { useState, useEffect } from 'react'

interface CreateRoute {
  mode: 'create'
}

interface ReadRoute {
  mode: 'read'
  shardId: string
  urlPayload: string
  check: string | null
}

export type HashRoute = CreateRoute | ReadRoute

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

  // New format: shardId:check:urlPayload (two colons)
  // Old format: shardId:urlPayload (one colon)
  const secondColon = rest.indexOf(':')
  if (secondColon !== -1) {
    const check = rest.slice(0, secondColon)
    const urlPayload = rest.slice(secondColon + 1)
    if (!check || !urlPayload) {
      return { mode: 'create' }
    }
    return { mode: 'read', shardId, check, urlPayload }
  }

  return { mode: 'read', shardId, check: null, urlPayload: rest }
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

import { useState, useEffect } from 'react'

interface CreateRoute {
  mode: 'create'
}

interface ReadRoute {
  mode: 'read'
  shardId: string
  urlPayload: string
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
  const urlPayload = hash.slice(colonIndex + 1)

  if (!shardId || !urlPayload) {
    return { mode: 'create' }
  }

  return { mode: 'read', shardId, urlPayload }
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

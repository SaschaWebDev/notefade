import { useEffect, useState } from 'react'

/**
 * Create a temporary object URL for a Blob and revoke it on unmount / blob
 * change. Returns null when blob is null.
 */
export function useBlobUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [blob])

  return url
}

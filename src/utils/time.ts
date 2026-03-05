/** Format a countdown from a millisecond diff (floors seconds) — used for expiry countdowns */
export function formatCountdown(diff: number): string {
  if (diff <= 0) return '0s'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0)
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/** Format a duration in ms (ceils seconds) — used for bar timer display */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/** Format a time-lock countdown from a unix timestamp in seconds */
export function formatTimeLockCountdown(unlockAt: number): string {
  const diff = unlockAt * 1000 - Date.now()
  if (diff <= 0) return 'now'
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/** Convert a TTL in seconds to an ISO expiry string from now */
export function ttlToISOExpiry(ttl: number): string {
  return new Date(Date.now() + ttl * 1000).toISOString()
}

/** Format an expiry timestamp as a short date string */
export function formatDate(expiresAt: number): string {
  const date = new Date(expiresAt)
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * KV-based per-key rate limiter.
 * Uses minute-bucket keys with auto-expiry for cleanup.
 * Fail-open: if KV read/write fails, the request is allowed.
 */

const DEFAULT_LIMIT = 60

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

export async function checkKeyRateLimit(
  kv: KVNamespace,
  keyId: string,
  customLimit?: number,
): Promise<RateLimitResult> {
  const limit = customLimit ?? DEFAULT_LIMIT
  const now = Date.now()
  const bucket = Math.floor(now / 60000)
  const resetAt = (bucket + 1) * 60

  const kvKey = `rl:${keyId}:${bucket}`

  try {
    const current = await kv.get(kvKey)
    const count = current !== null ? parseInt(current, 10) : 0

    if (count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
      }
    }

    const newCount = count + 1
    await kv.put(kvKey, String(newCount), { expirationTtl: 120 })

    return {
      allowed: true,
      limit,
      remaining: limit - newCount,
      resetAt,
    }
  } catch {
    // Fail-open: allow request if KV is unavailable
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt,
    }
  }
}

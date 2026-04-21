/**
 * Derives an opaque KV lookup key from a public shardId via HMAC-SHA256.
 *
 * Without this, the literal shardId from the URL fragment is the KV key,
 * meaning any KV dump (legal compulsion, KV-only backup leak, scoped API
 * token misconfiguration) could be cross-referenced 1:1 with leaked URLs
 * to recover the matching encrypted shards.
 *
 * With KV_SECRET set, the actual KV row key is HMAC(KV_SECRET, shardId).
 * An attacker holding the KV dump but not KV_SECRET cannot perform that
 * matching even if they obtain URLs later. An attacker who also has
 * KV_SECRET (full Worker compromise) is unaffected — this hardens KV-only
 * exposure, not server compromise.
 *
 * Backwards compatible: if KV_SECRET is unset, returns the input
 * unchanged so existing self-hosters and dev setups work without
 * configuration.
 *
 * KV_SECRET cannot be rotated. Rotating it makes every existing un-read
 * shard unrecoverable because the worker can no longer locate its KV row.
 * Pick a long random value once and treat it as permanent.
 */

let cached: { secret: string; key: CryptoKey } | null = null

async function getHmacKey(secret: string): Promise<CryptoKey> {
  if (cached !== null && cached.secret === secret) return cached.key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  cached = { secret, key }
  return key
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Derive an opaque KV key from a logical id.
 *
 * - If `secret` is undefined or empty, returns `id` unchanged.
 * - Otherwise returns base64url(HMAC-SHA256(secret, id)) — 43 chars.
 *
 * The same `(secret, id)` pair always returns the same output
 * (deterministic), so the worker can look up rows by id.
 */
export async function deriveKvKey(
  secret: string | undefined,
  id: string,
): Promise<string> {
  if (!secret) return id
  const hmacKey = await getHmacKey(secret)
  const sig = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    new TextEncoder().encode(id),
  )
  return bytesToBase64Url(new Uint8Array(sig))
}

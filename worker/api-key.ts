/**
 * API key validation module.
 * Keys are stored as SHA-256 hashes in KV — the raw key is never persisted.
 */

const API_KEY_RE = /^nfk_[a-f0-9]{32}$/

export interface ApiKeyMeta {
  name: string
  hash: string        // SHA-256 hex of the full key
  createdAt: number
  revokedAt?: number
  limits?: { postPerMin?: number }
}

export interface ApiKeyResult {
  keyId: string
  name: string
  limits?: { postPerMin?: number }
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i]! >>> 0).toString(16).padStart(2, '0')
  }
  return hex
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return bytesToHex(new Uint8Array(digest))
}

export async function validateApiKey(
  kv: KVNamespace,
  rawKey: string,
): Promise<ApiKeyResult | null> {
  // Format check
  if (!API_KEY_RE.test(rawKey)) return null

  // Hash the raw key
  const hash = await sha256Hex(rawKey)

  // Look up keyId by hash
  const keyId = await kv.get(`apikeylookup:${hash}`)
  if (keyId === null) return null

  // Fetch key metadata
  const metaJson = await kv.get(`apikey:${keyId}`)
  if (metaJson === null) return null

  let meta: ApiKeyMeta
  try {
    meta = JSON.parse(metaJson) as ApiKeyMeta
  } catch {
    return null
  }

  // Check revocation
  if (meta.revokedAt !== undefined) return null

  return {
    keyId,
    name: meta.name,
    limits: meta.limits,
  }
}

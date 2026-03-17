/**
 * Generate an API key for the Notefade integration API.
 *
 * Usage:
 *   npx tsx scripts/gen-api-key.ts [key-name] [key-id]
 *
 * Example:
 *   npx tsx scripts/gen-api-key.ts ChatApp k_001
 *
 * Outputs:
 *   - The raw API key (give to the consumer)
 *   - Wrangler CLI commands to store the key metadata in KV
 */

import { webcrypto } from 'node:crypto'

const name = process.argv[2] ?? 'default'
const keyId = process.argv[3] ?? `k_${String(Date.now()).slice(-6)}`

// Generate 16 random bytes → nfk_ + 32 hex chars
const randomBytes = new Uint8Array(16)
webcrypto.getRandomValues(randomBytes)

let hex = ''
for (let i = 0; i < randomBytes.length; i++) {
  hex += (randomBytes[i]! >>> 0).toString(16).padStart(2, '0')
}
const rawKey = `nfk_${hex}`

// SHA-256 hash the full key
const encoded = new TextEncoder().encode(rawKey)
const digest = await webcrypto.subtle.digest('SHA-256', encoded)
const hashBytes = new Uint8Array(digest)
let hashHex = ''
for (let i = 0; i < hashBytes.length; i++) {
  hashHex += (hashBytes[i]! >>> 0).toString(16).padStart(2, '0')
}

const now = Math.floor(Date.now() / 1000)

const meta = JSON.stringify({
  hash: hashHex,
  name,
  createdAt: now,
})

console.log('=== Notefade API Key ===\n')
console.log(`Key ID:   ${keyId}`)
console.log(`Name:     ${name}`)
console.log(`Raw Key:  ${rawKey}`)
console.log(`SHA-256:  ${hashHex}`)
console.log()
console.log('=== Store in KV (run both commands) ===\n')
console.log(`wrangler kv:put --binding=SHARDS "apikey:${keyId}" '${meta}'`)
console.log(`wrangler kv:put --binding=SHARDS "apikeylookup:${hashHex}" "${keyId}"`)
console.log()
console.log('=== Revoke later (if needed) ===\n')
const revokedMeta = JSON.stringify({
  hash: hashHex,
  name,
  createdAt: now,
  revokedAt: '<UNIX_TIMESTAMP>',
})
console.log(`wrangler kv:put --binding=SHARDS "apikey:${keyId}" '${revokedMeta}'`)

/**
 * Server-side defer token module.
 * Encrypts/decrypts deferred activation payloads using AES-256-GCM
 * with an HKDF-derived key from the DEFER_SECRET environment variable.
 */

export interface DeferTokenPayload {
  /** Server-generated shard ID */
  id: string
  /** Base64url-encoded 16-byte server shard */
  shard: string
  /** TTL in seconds */
  ttl: number
  /** Creation timestamp in milliseconds */
  ts: number
}

// --- Helpers (duplicated from crypto.ts since worker bundle is separate) ---

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

const CHUNK_SIZE = 8192

function toBase64Url(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const slice = bytes.slice(i, i + CHUNK_SIZE)
    chunks.push(String.fromCharCode(...slice))
  }
  return btoa(chunks.join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '~')
    .replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/[_~]/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// --- Key derivation ---

const HKDF_SALT = new TextEncoder().encode('notefade-defer-token-v1')
const HKDF_INFO = new TextEncoder().encode('aes-256-gcm-token-key')

async function deriveKey(secretHex: string): Promise<CryptoKey> {
  const rawBytes = hexToBytes(secretHex)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    rawBytes.buffer as ArrayBuffer,
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: HKDF_SALT.buffer as ArrayBuffer,
      info: HKDF_INFO.buffer as ArrayBuffer,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// --- Token create / open ---

export async function createDeferToken(
  secretHex: string,
  payload: DeferTokenPayload,
): Promise<string> {
  const key = await deriveKey(secretHex)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      plaintext.buffer as ArrayBuffer,
    ),
  )

  // Token = base64url(iv (12) + ciphertext (includes 16-byte GCM tag))
  const tokenBytes = new Uint8Array(12 + ciphertext.length)
  tokenBytes.set(iv, 0)
  tokenBytes.set(ciphertext, 12)

  return toBase64Url(tokenBytes)
}

export async function openDeferToken(
  secretHex: string,
  token: string,
): Promise<DeferTokenPayload> {
  const tokenBytes = fromBase64Url(token)
  if (tokenBytes.length < 13) {
    throw new Error('Invalid token')
  }

  const iv = tokenBytes.slice(0, 12)
  const ciphertext = tokenBytes.slice(12)

  const key = await deriveKey(secretHex)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer,
  )

  const json: unknown = JSON.parse(new TextDecoder().decode(decrypted))

  // Validate shape
  if (
    typeof json !== 'object' || json === null ||
    typeof (json as Record<string, unknown>).id !== 'string' ||
    typeof (json as Record<string, unknown>).shard !== 'string' ||
    typeof (json as Record<string, unknown>).ttl !== 'number' ||
    typeof (json as Record<string, unknown>).ts !== 'number'
  ) {
    throw new Error('Invalid token payload')
  }

  return json as DeferTokenPayload
}

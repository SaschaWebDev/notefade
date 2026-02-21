/**
 * Zero-dependency crypto module using Web Crypto API only.
 * Handles AES-256-GCM encryption, XOR key splitting, and URL encoding.
 */

export interface SplitResult {
  /** Base64url-encoded payload for the URL fragment */
  urlPayload: string
  /** Base64url-encoded 16-byte shard for the server */
  serverShard: string
}

interface EncryptedNote {
  ciphertext: Uint8Array
  iv: Uint8Array
  key: Uint8Array
}

// --- KEY SPLITTING (XOR) ---

export function splitKey(key: Uint8Array): {
  urlShare: Uint8Array
  serverShard: Uint8Array
} {
  const mask = crypto.getRandomValues(new Uint8Array(32))
  const xorShare = key.map((b, i) => b ^ (mask[i] ?? 0))

  // URL gets: mask (32) + xorShare second half (16) = 48 bytes
  const urlShare = new Uint8Array(48)
  urlShare.set(mask, 0)
  urlShare.set(xorShare.slice(16), 32)

  // Server stores only first 16 bytes of xorShare
  const serverShard = xorShare.slice(0, 16)

  return { urlShare, serverShard }
}

export function reconstructKey(
  urlShare: Uint8Array,
  serverShard: Uint8Array,
): Uint8Array {
  const mask = urlShare.slice(0, 32)
  const xorShareSecondHalf = urlShare.slice(32, 48)

  const xorShare = new Uint8Array(32)
  xorShare.set(serverShard, 0)
  xorShare.set(xorShareSecondHalf, 16)

  return mask.map((b, i) => b ^ (xorShare[i] ?? 0))
}

// --- ENCRYPT & DECRYPT ---

/** Copy a Uint8Array into a fresh ArrayBuffer (satisfies TS strict BufferSource) */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}

export async function encrypt(message: string): Promise<EncryptedNote> {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    'AES-GCM',
    false,
    ['encrypt'],
  )

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      cryptoKey,
      toArrayBuffer(encoded),
    ),
  )

  return { ciphertext, iv, key }
}

export async function decrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: Uint8Array,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    'AES-GCM',
    false,
    ['decrypt'],
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    cryptoKey,
    toArrayBuffer(ciphertext),
  )

  return new TextDecoder().decode(decrypted)
}

// --- BASE64URL ENCODING ---

export function toBase64Url(bytes: Uint8Array): string {
  // Chunk to avoid call stack overflow on large arrays
  const chunks: string[] = []
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.slice(i, i + chunkSize)
    chunks.push(String.fromCharCode(...slice))
  }
  return btoa(chunks.join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// --- INTEGRITY CHECK (FNV-1a 32-bit) ---

/** Compute a 4-byte FNV-1a hash of a string, returned as base64url (~6 chars) */
export function computeCheck(payload: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  const bytes = new Uint8Array(4)
  bytes[0] = (hash >>> 24) & 0xff
  bytes[1] = (hash >>> 16) & 0xff
  bytes[2] = (hash >>> 8) & 0xff
  bytes[3] = hash & 0xff
  return toBase64Url(bytes)
}

// --- FULL FLOW ---

/** Sender creates a note: encrypts and splits key */
export async function createNote(message: string): Promise<SplitResult> {
  const { ciphertext, iv, key } = await encrypt(message)
  const { urlShare, serverShard } = splitKey(key)

  // URL payload: urlShare (48) + iv (12) + ciphertext (variable)
  const urlBytes = new Uint8Array(48 + 12 + ciphertext.length)
  urlBytes.set(urlShare, 0)
  urlBytes.set(iv, 48)
  urlBytes.set(ciphertext, 60)

  // Zero the raw key (best-effort)
  key.fill(0)

  return {
    urlPayload: toBase64Url(urlBytes),
    serverShard: toBase64Url(serverShard),
  }
}

/** Recipient opens a note: fetches shard, reconstructs key, decrypts */
export async function openNote(
  urlPayload: string,
  serverShard: string,
): Promise<string> {
  const urlBytes = fromBase64Url(urlPayload)
  const shard = fromBase64Url(serverShard)

  const urlShare = urlBytes.slice(0, 48)
  const iv = urlBytes.slice(48, 60)
  const ciphertext = urlBytes.slice(60)

  const key = reconstructKey(urlShare, shard)
  const plaintext = await decrypt(ciphertext, iv, key)

  // Zero out sensitive data (best-effort)
  key.fill(0)
  shard.fill(0)
  urlShare.fill(0)
  urlBytes.fill(0)

  // Remove fragment from browser history
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', window.location.pathname)
  }

  return plaintext
}

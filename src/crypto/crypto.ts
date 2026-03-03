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

/** Metadata embedded inside encrypted plaintext */
export interface NoteMetadata {
  /** Burn-after-reading duration in seconds */
  barSeconds?: number
  /** Receipt seed for proof of read (32 bytes, base64url-encoded) */
  receiptSeed?: string
}

/** Result from opening a note, including parsed metadata */
export interface OpenNoteResult {
  plaintext: string
  metadata: NoteMetadata
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

  // Zero intermediate values (best-effort)
  mask.fill(0)
  xorShare.fill(0)

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

// --- PLAINTEXT PADDING (backward compat) ---

/**
 * Remove padding by finding the first 0xFF delimiter.
 * Returns input as-is if no delimiter found (backward compat with pre-padding notes).
 */
export function unpadPlaintext(decrypted: Uint8Array): Uint8Array {
  const delimiterIndex = decrypted.indexOf(0xff)
  if (delimiterIndex === -1) {
    return decrypted
  }
  return decrypted.slice(0, delimiterIndex)
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

export async function decryptToBytes(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
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

  return new Uint8Array(decrypted)
}

export async function decrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: Uint8Array,
): Promise<string> {
  const decrypted = await decryptToBytes(ciphertext, iv, key)
  return new TextDecoder().decode(decrypted)
}

// --- BASE64URL ENCODING (bytes) ---

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
  const base64 = str.replace(/-/g, '+').replace(/[_~]/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// --- BASE64URL ENCODING (strings) ---

export function stringToBase64Url(str: string): string {
  return toBase64Url(new TextEncoder().encode(str))
}

export function stringFromBase64Url(encoded: string): string {
  return new TextDecoder().decode(fromBase64Url(encoded))
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

// --- URL-LEVEL PAYLOAD PADDING ---

/** Padded payload length: 1 (marker) + 4 (length prefix) + 7302 (max CJK payload) = 7307 */
export const PAYLOAD_PAD_LEN = 7307

const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Pad a URL payload to a fixed length with `.` marker and length prefix */
export function padPayload(urlPayload: string): string {
  // 4-char base64url prefix encodes real payload length as 3 bytes (max 16M)
  const len = urlPayload.length
  const lenBytes = new Uint8Array(3)
  lenBytes[0] = (len >>> 16) & 0xff
  lenBytes[1] = (len >>> 8) & 0xff
  lenBytes[2] = len & 0xff
  const lenPrefix = toBase64Url(lenBytes)

  const fillNeeded = PAYLOAD_PAD_LEN - 1 - 4 - len
  let fill = ''
  if (fillNeeded > 0) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(fillNeeded))
    const chars: string[] = []
    for (let i = 0; i < fillNeeded; i++) {
      chars.push(BASE64URL_CHARS[(randomBytes[i] ?? 0) % 64]!)
    }
    fill = chars.join('')
  }

  return '.' + lenPrefix + urlPayload + fill
}

/** Unpad a URL payload; returns as-is if no `.` marker (backward compat) */
export function unpadPayload(payload: string): string {
  if (!payload.startsWith('.')) {
    return payload
  }
  const lenBytes = fromBase64Url(payload.slice(1, 5))
  const len = ((lenBytes[0] ?? 0) << 16) | ((lenBytes[1] ?? 0) << 8) | (lenBytes[2] ?? 0)
  return payload.slice(5, 5 + len)
}

// --- PLAINTEXT METADATA ---

/** Encode metadata prefixes into plaintext before encryption */
export function encodeMetadata(message: string, metadata: NoteMetadata): string {
  let prefix = ''
  if (metadata.barSeconds !== undefined) {
    prefix += `BAR:${metadata.barSeconds}:`
  }
  if (metadata.receiptSeed !== undefined) {
    prefix += `RECEIPT:${metadata.receiptSeed}:`
  }
  return prefix + message
}

/** Parse metadata prefixes from decrypted plaintext */
export function decodeMetadata(plaintext: string): OpenNoteResult {
  const metadata: NoteMetadata = {}
  let remaining = plaintext

  // Parse BAR prefix
  const barMatch = remaining.match(/^BAR:(\d+):/)
  if (barMatch) {
    metadata.barSeconds = parseInt(barMatch[1]!, 10)
    remaining = remaining.slice(barMatch[0]!.length)
  }

  // Parse RECEIPT prefix
  const receiptMatch = remaining.match(/^RECEIPT:([A-Za-z0-9_-]+):/)
  if (receiptMatch) {
    metadata.receiptSeed = receiptMatch[1]!
    remaining = remaining.slice(receiptMatch[0]!.length)
  }

  return { plaintext: remaining, metadata }
}

// --- PROOF OF READ (HMAC-SHA256) ---

/** Generate a 32-byte random receipt seed */
export function generateReceiptSeed(): string {
  const seed = crypto.getRandomValues(new Uint8Array(32))
  return toBase64Url(seed)
}

/** Compute HMAC-SHA256 proof: proves someone decrypted the note */
export async function computeReceiptProof(
  receiptSeed: string,
  plaintext: string,
): Promise<string> {
  const seedBytes = fromBase64Url(receiptSeed)
  const plaintextBytes = new TextEncoder().encode(plaintext)

  // Hash the plaintext first
  const plaintextHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', toArrayBuffer(plaintextBytes)),
  )

  // HMAC-SHA256(key=seed, message=SHA256(plaintext))
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(seedBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', hmacKey, toArrayBuffer(plaintextHash)),
  )

  return toBase64Url(signature)
}

/** Verify a receipt proof against the original plaintext and seed */
export async function verifyReceiptProof(
  receiptSeed: string,
  plaintext: string,
  proof: string,
): Promise<boolean> {
  const expected = await computeReceiptProof(receiptSeed, plaintext)
  return expected === proof
}

// --- STEGANOGRAPHIC TIME-LOCK ---

/** Simple xorshift32 PRNG — returns unsigned 32-bit integer */
function xorshift32(state: number): number {
  state ^= state << 13
  state ^= state >>> 17
  state ^= state << 5
  return state >>> 0
}

/** FNV-1a hash of raw bytes, returned as unsigned 32-bit */
function fnv1aBytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]!
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Derive 8 deterministic positions within the fill area of a padded payload.
 * Seeds a PRNG with FNV-1a of the check string, then picks one position
 * per segment (fill divided into 8 equal parts).
 */
export function deriveTimeLockPositions(
  check: string,
  fillStart: number,
  fillLength: number,
): number[] {
  // Seed PRNG with FNV-1a of check string
  let state = 0x811c9dc5
  for (let i = 0; i < check.length; i++) {
    state ^= check.charCodeAt(i)
    state = Math.imul(state, 0x01000193)
  }
  state = state >>> 0

  const segmentSize = Math.floor(fillLength / 8)
  if (segmentSize === 0) return []

  const positions: number[] = []
  for (let i = 0; i < 8; i++) {
    state = xorshift32(state)
    const offset = state % segmentSize
    positions.push(fillStart + i * segmentSize + offset)
  }

  return positions
}

/**
 * Embed a time-lock timestamp steganographically into a padded payload.
 * Encodes: 4 bytes uint32 BE timestamp + 2 bytes FNV-1a checksum = 6 bytes → 8 base64url chars.
 * Overwrites 8 characters at PRNG-derived positions in the fill area.
 * Returns a modified padded payload of the same length.
 */
export function embedTimeLock(
  paddedPayload: string,
  check: string,
  timeLockAt: number,
): string {
  // Extract fill area bounds from padded payload
  const lenBytes = fromBase64Url(paddedPayload.slice(1, 5))
  const len = ((lenBytes[0] ?? 0) << 16) | ((lenBytes[1] ?? 0) << 8) | (lenBytes[2] ?? 0)
  const fillStart = 5 + len
  const fillLength = PAYLOAD_PAD_LEN - fillStart

  // Encode timestamp: 4 bytes uint32 BE
  const tsBytes = new Uint8Array(4)
  tsBytes[0] = (timeLockAt >>> 24) & 0xff
  tsBytes[1] = (timeLockAt >>> 16) & 0xff
  tsBytes[2] = (timeLockAt >>> 8) & 0xff
  tsBytes[3] = timeLockAt & 0xff

  // FNV-1a checksum XOR-folded to 16 bits
  const hash32 = fnv1aBytes(tsBytes)
  const hash16 = ((hash32 >>> 16) ^ (hash32 & 0xffff)) & 0xffff

  const encoded = new Uint8Array(6)
  encoded.set(tsBytes, 0)
  encoded[4] = (hash16 >>> 8) & 0xff
  encoded[5] = hash16 & 0xff

  const chars = toBase64Url(encoded) // 8 base64url characters

  // Get positions and overwrite fill characters
  const positions = deriveTimeLockPositions(check, fillStart, fillLength)
  const result = paddedPayload.split('')
  for (let i = 0; i < 8; i++) {
    result[positions[i]!] = chars[i]!
  }

  return result.join('')
}

/**
 * Extract a steganographically embedded time-lock from a padded payload.
 * Reads 8 characters from PRNG-derived positions, decodes 6 bytes,
 * validates FNV-1a checksum and timestamp range.
 * Returns Unix timestamp or null if not found / invalid.
 */
export function extractTimeLock(
  paddedPayload: string,
  check: string,
): number | null {
  if (!paddedPayload.startsWith('.')) return null

  // Extract fill area bounds
  const lenBytes = fromBase64Url(paddedPayload.slice(1, 5))
  const len = ((lenBytes[0] ?? 0) << 16) | ((lenBytes[1] ?? 0) << 8) | (lenBytes[2] ?? 0)
  const fillStart = 5 + len
  const fillLength = PAYLOAD_PAD_LEN - fillStart

  if (fillLength < 8) return null

  // Get positions and read characters
  const positions = deriveTimeLockPositions(check, fillStart, fillLength)
  if (positions.length !== 8) return null

  let chars = ''
  for (let i = 0; i < 8; i++) {
    chars += paddedPayload[positions[i]!]
  }

  // Decode 6 bytes
  let decoded: Uint8Array
  try {
    decoded = fromBase64Url(chars)
  } catch {
    return null
  }
  if (decoded.length !== 6) return null

  // Extract timestamp (uint32 BE)
  const timestamp =
    ((decoded[0]! << 24) | (decoded[1]! << 16) | (decoded[2]! << 8) | decoded[3]!) >>> 0

  // Validate FNV-1a checksum
  const tsBytes = decoded.slice(0, 4)
  const hash32 = fnv1aBytes(tsBytes)
  const expectedHash16 = ((hash32 >>> 16) ^ (hash32 & 0xffff)) & 0xffff
  const actualHash16 = ((decoded[4]! << 8) | decoded[5]!) & 0xffff

  if (expectedHash16 !== actualHash16) return null

  // Validate timestamp range: 2024-01-01 to 2100-01-01
  const MIN_TS = 1704067200
  const MAX_TS = 4102444800
  if (timestamp < MIN_TS || timestamp > MAX_TS) return null

  return timestamp
}

// --- FULL FLOW ---

/** Sender creates a note: encrypts message and splits key */
export async function createNote(
  message: string,
  metadata?: NoteMetadata,
): Promise<SplitResult> {
  const encodedMessage = metadata ? encodeMetadata(message, metadata) : message
  const { ciphertext, iv, key } = await encrypt(encodedMessage)
  const { urlShare, serverShard } = splitKey(key)

  // URL payload: urlShare (48) + iv (12) + ciphertext (variable + 16 GCM tag)
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

// --- PASSWORD PROTECTION (PBKDF2 + AES-256-GCM) ---

export const PBKDF2_ITERATIONS = 600_000
const PROTECTION_SALT_BYTES = 16

/** Wrap a fragment string in a second AES-256-GCM layer keyed by a password */
export async function protectFragment(
  fragment: string,
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PROTECTION_SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )

  const plaintext = new TextEncoder().encode(fragment)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      derivedKey,
      toArrayBuffer(plaintext),
    ),
  )

  // Blob = IV (12) + ciphertext (variable, includes 16-byte GCM tag)
  const blob = new Uint8Array(12 + ciphertext.length)
  blob.set(iv, 0)
  blob.set(ciphertext, 12)

  return toBase64Url(salt) + ':' + toBase64Url(blob)
}

/** Unwrap a password-protected fragment; throws DOMException on wrong password */
export async function unprotectFragment(
  protectedData: string,
  password: string,
): Promise<string> {
  const colonIndex = protectedData.indexOf(':')
  if (colonIndex === -1) {
    throw new Error('Invalid protected data format')
  }

  const salt = fromBase64Url(protectedData.slice(0, colonIndex))
  const blob = fromBase64Url(protectedData.slice(colonIndex + 1))

  const iv = blob.slice(0, 12)
  const ciphertext = blob.slice(12)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    derivedKey,
    toArrayBuffer(ciphertext),
  )

  return new TextDecoder().decode(decrypted)
}

/** Recipient opens a note: fetches shard, reconstructs key, decrypts */
export async function openNote(
  urlPayload: string,
  serverShard: string,
): Promise<OpenNoteResult> {
  // Strip URL-level padding if present
  const realPayload = unpadPayload(urlPayload)
  const urlBytes = fromBase64Url(realPayload)
  const shard = fromBase64Url(serverShard)

  const urlShare = urlBytes.slice(0, 48)
  const iv = urlBytes.slice(48, 60)
  const ciphertext = urlBytes.slice(60)

  const key = reconstructKey(urlShare, shard)
  const decryptedBytes = await decryptToBytes(ciphertext, iv, key)
  const unpadded = unpadPlaintext(decryptedBytes)
  const rawPlaintext = new TextDecoder().decode(unpadded)

  // Parse metadata prefixes from decrypted content
  const result = decodeMetadata(rawPlaintext)

  // Zero out sensitive data (best-effort)
  key.fill(0)
  shard.fill(0)
  urlShare.fill(0)
  urlBytes.fill(0)

  // Remove fragment from browser history
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', window.location.pathname)
  }

  return result
}

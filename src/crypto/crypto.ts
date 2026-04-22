/**
 * Zero-dependency crypto module using Web Crypto API only.
 * Handles AES-256-GCM encryption, XOR key splitting, and URL encoding.
 */

const KEY_BYTES = 32
const URL_SHARE_BYTES = 48
const SERVER_SHARD_BYTES = 16
const IV_BYTES = 12
const CIPHERTEXT_OFFSET = URL_SHARE_BYTES + IV_BYTES // 60
const CHUNK_SIZE = 8192

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

const MIN_TIMESTAMP = 1704067200 // 2024-01-01 UTC
const MAX_TIMESTAMP = 4102444800 // 2100-01-01 UTC

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
  /** One-char voice mime code (e.g. 'w' for webm/opus). Only on chunk 0 of voice notes. */
  voiceMime?: string
  /** Voice recording duration in ms. Only on chunk 0 of voice notes. */
  voiceDurationMs?: number
  /** One-char image mime code (e.g. 'a' for avif). Only on chunk 0 of image notes. */
  imageMime?: string
  /** One-char video mime code (e.g. 'w' for webm-vp9). Only on chunk 0 of video notes. */
  videoMime?: string
  /** Video duration in ms. Only on chunk 0 of video notes. */
  videoDurationMs?: number
}

/** Result from opening a note, including parsed metadata */
export interface OpenNoteResult {
  plaintext: string
  metadata: NoteMetadata
}

/** Result from opening a byte-payload note (voice), including parsed metadata */
export interface OpenNoteBytesResult {
  content: Uint8Array
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
  const mask = crypto.getRandomValues(new Uint8Array(KEY_BYTES))
  const xorShare = key.map((b, i) => b ^ (mask[i] ?? 0))

  // URL gets: mask (32) + xorShare second half (16) = 48 bytes
  const urlShare = new Uint8Array(URL_SHARE_BYTES)
  urlShare.set(mask, 0)
  urlShare.set(xorShare.slice(SERVER_SHARD_BYTES), KEY_BYTES)

  // Server stores only first 16 bytes of xorShare
  const serverShard = xorShare.slice(0, SERVER_SHARD_BYTES)

  // Zero intermediate values (best-effort)
  mask.fill(0)
  xorShare.fill(0)

  return { urlShare, serverShard }
}

export function reconstructKey(
  urlShare: Uint8Array,
  serverShard: Uint8Array,
): Uint8Array {
  const mask = urlShare.slice(0, KEY_BYTES)
  const xorShareSecondHalf = urlShare.slice(KEY_BYTES, URL_SHARE_BYTES)

  const xorShare = new Uint8Array(KEY_BYTES)
  xorShare.set(serverShard, 0)
  xorShare.set(xorShareSecondHalf, SERVER_SHARD_BYTES)

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
  return encryptBytes(new TextEncoder().encode(message))
}

export async function encryptBytes(plaintext: Uint8Array): Promise<EncryptedNote> {
  const key = crypto.getRandomValues(new Uint8Array(KEY_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))

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
      toArrayBuffer(plaintext),
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
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const slice = bytes.slice(i, i + CHUNK_SIZE)
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
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
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

/** Build the ASCII metadata prefix string for a given NoteMetadata */
function buildMetadataPrefix(metadata: NoteMetadata): string {
  let prefix = ''
  if (metadata.barSeconds !== undefined) {
    prefix += `BAR:${metadata.barSeconds}:`
  }
  if (metadata.receiptSeed !== undefined) {
    prefix += `RECEIPT:${metadata.receiptSeed}:`
  }
  if (metadata.voiceMime !== undefined) {
    prefix += `V:${metadata.voiceMime}:`
  }
  if (metadata.voiceDurationMs !== undefined) {
    prefix += `AD:${metadata.voiceDurationMs}:`
  }
  if (metadata.imageMime !== undefined) {
    prefix += `I:${metadata.imageMime}:`
  }
  if (metadata.videoMime !== undefined) {
    prefix += `VM:${metadata.videoMime}:`
  }
  if (metadata.videoDurationMs !== undefined) {
    prefix += `VD:${metadata.videoDurationMs}:`
  }
  return prefix
}

/** Parse known metadata prefixes from the start of a string; returns metadata + consumed length */
function parseMetadataPrefix(s: string): { metadata: NoteMetadata; consumed: number } {
  const metadata: NoteMetadata = {}
  let offset = 0

  const barMatch = s.slice(offset).match(/^BAR:(\d+):/)
  if (barMatch) {
    metadata.barSeconds = parseInt(barMatch[1]!, 10)
    offset += barMatch[0]!.length
  }

  const receiptMatch = s.slice(offset).match(/^RECEIPT:([A-Za-z0-9_-]+):/)
  if (receiptMatch) {
    metadata.receiptSeed = receiptMatch[1]!
    offset += receiptMatch[0]!.length
  }

  const voiceMatch = s.slice(offset).match(/^V:([A-Za-z0-9]):/)
  if (voiceMatch) {
    metadata.voiceMime = voiceMatch[1]!
    offset += voiceMatch[0]!.length
  }

  const durMatch = s.slice(offset).match(/^AD:(\d+):/)
  if (durMatch) {
    metadata.voiceDurationMs = parseInt(durMatch[1]!, 10)
    offset += durMatch[0]!.length
  }

  const imageMatch = s.slice(offset).match(/^I:([A-Za-z0-9]):/)
  if (imageMatch) {
    metadata.imageMime = imageMatch[1]!
    offset += imageMatch[0]!.length
  }

  const videoMimeMatch = s.slice(offset).match(/^VM:([A-Za-z0-9]):/)
  if (videoMimeMatch) {
    metadata.videoMime = videoMimeMatch[1]!
    offset += videoMimeMatch[0]!.length
  }

  const videoDurMatch = s.slice(offset).match(/^VD:(\d+):/)
  if (videoDurMatch) {
    metadata.videoDurationMs = parseInt(videoDurMatch[1]!, 10)
    offset += videoDurMatch[0]!.length
  }

  return { metadata, consumed: offset }
}

/** Encode metadata prefixes into plaintext before encryption */
export function encodeMetadata(message: string, metadata: NoteMetadata): string {
  return buildMetadataPrefix(metadata) + message
}

/** Parse metadata prefixes from decrypted plaintext */
export function decodeMetadata(plaintext: string): OpenNoteResult {
  const { metadata, consumed } = parseMetadataPrefix(plaintext)
  return { plaintext: plaintext.slice(consumed), metadata }
}

/** Encode metadata prefixes into a binary plaintext before encryption */
export function encodeMetadataBytes(
  metadata: NoteMetadata,
  content: Uint8Array,
): Uint8Array {
  const prefixBytes = new TextEncoder().encode(buildMetadataPrefix(metadata))
  const out = new Uint8Array(prefixBytes.length + content.length)
  out.set(prefixBytes, 0)
  out.set(content, prefixBytes.length)
  return out
}

/** Parse metadata prefixes from a binary decrypted payload */
export function decodeMetadataBytes(bytes: Uint8Array): OpenNoteBytesResult {
  // Metadata is ASCII-only. Scan a bounded prefix as a latin1 string so
  // non-ASCII audio bytes don't poison the regex, then trim by consumed length.
  const scanLen = Math.min(bytes.length, 256)
  let asciiPrefix = ''
  for (let i = 0; i < scanLen; i++) {
    asciiPrefix += String.fromCharCode(bytes[i]!)
  }
  const { metadata, consumed } = parseMetadataPrefix(asciiPrefix)
  return { metadata, content: bytes.slice(consumed) }
}

// --- PROOF OF READ (HMAC-SHA256) ---

/** Generate a 32-byte random receipt seed */
export function generateReceiptSeed(): string {
  const seed = crypto.getRandomValues(new Uint8Array(KEY_BYTES))
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
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]!
    hash = Math.imul(hash, FNV_PRIME)
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
  let state = FNV_OFFSET_BASIS
  for (let i = 0; i < check.length; i++) {
    state ^= check.charCodeAt(i)
    state = Math.imul(state, FNV_PRIME)
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
  if (timestamp < MIN_TIMESTAMP || timestamp > MAX_TIMESTAMP) return null

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
  return packSplitResult(ciphertext, iv, key)
}

/** Sender creates a binary note (voice): encrypts bytes and splits key */
export async function createNoteBytes(
  content: Uint8Array,
  metadata?: NoteMetadata,
): Promise<SplitResult> {
  const encoded = metadata ? encodeMetadataBytes(metadata, content) : content
  const { ciphertext, iv, key } = await encryptBytes(encoded)
  return packSplitResult(ciphertext, iv, key)
}

function packSplitResult(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: Uint8Array,
): SplitResult {
  const { urlShare, serverShard } = splitKey(key)

  // URL payload: urlShare (48) + iv (12) + ciphertext (variable + 16 GCM tag)
  const urlBytes = new Uint8Array(URL_SHARE_BYTES + IV_BYTES + ciphertext.length)
  urlBytes.set(urlShare, 0)
  urlBytes.set(iv, URL_SHARE_BYTES)
  urlBytes.set(ciphertext, CIPHERTEXT_OFFSET)

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
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))

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
  const blob = new Uint8Array(IV_BYTES + ciphertext.length)
  blob.set(iv, 0)
  blob.set(ciphertext, IV_BYTES)

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

  const iv = blob.slice(0, IV_BYTES)
  const ciphertext = blob.slice(IV_BYTES)

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
  const decryptedBytes = await decryptNotePayload(urlPayload, serverShard)
  const unpadded = unpadPlaintext(decryptedBytes)
  const rawPlaintext = new TextDecoder().decode(unpadded)
  return decodeMetadata(rawPlaintext)
}

/**
 * Recipient opens a binary note: fetches shard, reconstructs key, decrypts,
 * returns raw bytes + metadata without UTF-8 decoding or 0xFF-based unpadding
 * (both would corrupt arbitrary binary payloads like Opus audio).
 */
export async function openNoteBytes(
  urlPayload: string,
  serverShard: string,
): Promise<OpenNoteBytesResult> {
  const decryptedBytes = await decryptNotePayload(urlPayload, serverShard)
  return decodeMetadataBytes(decryptedBytes)
}

async function decryptNotePayload(
  urlPayload: string,
  serverShard: string,
): Promise<Uint8Array> {
  const realPayload = unpadPayload(urlPayload)
  const urlBytes = fromBase64Url(realPayload)
  const shard = fromBase64Url(serverShard)

  const urlShare = urlBytes.slice(0, URL_SHARE_BYTES)
  const iv = urlBytes.slice(URL_SHARE_BYTES, CIPHERTEXT_OFFSET)
  const ciphertext = urlBytes.slice(CIPHERTEXT_OFFSET)

  const key = reconstructKey(urlShare, shard)
  const decryptedBytes = await decryptToBytes(ciphertext, iv, key)

  // Zero out sensitive data (best-effort)
  key.fill(0)
  shard.fill(0)
  urlShare.fill(0)
  urlBytes.fill(0)

  // Remove fragment from browser history
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', window.location.pathname)
  }

  return decryptedBytes
}

// --- BYOK (Bring Your Own Key) DECRYPTION ---

/**
 * Decrypt BYOK (Bring Your Own Key) content.
 * The content is base64url-encoded: IV (12 bytes) || ciphertext || GCM tag (16 bytes).
 * The key is base64url-encoded (32 bytes).
 */
export async function decryptByokContent(
  contentB64: string,
  keyB64: string,
): Promise<string> {
  const blob = fromBase64Url(contentB64)
  if (blob.length < IV_BYTES + 16) {
    throw new Error('BYOK content too short')
  }
  const iv = blob.slice(0, IV_BYTES)
  const ciphertext = blob.slice(IV_BYTES)
  const key = fromBase64Url(keyB64)
  if (key.length !== KEY_BYTES) {
    throw new Error('BYOK key must be 32 bytes')
  }
  const plaintext = await decrypt(ciphertext, iv, key)
  key.fill(0)
  return plaintext
}

/** Validate a BYOK key string. Returns true if it decodes to exactly 32 bytes. */
export function isValidByokKey(keyB64: string): boolean {
  try {
    return fromBase64Url(keyB64).length === KEY_BYTES
  } catch {
    return false
  }
}

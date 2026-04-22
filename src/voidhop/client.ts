/**
 * Client wrapper for the VoidHop URL shortener (sister project at ../voidhop).
 *
 * VoidHop is a privacy-first shortener: the client AES-256-GCM-encrypts the
 * long URL before uploading, the server stores only an opaque ciphertext,
 * and the decryption key lives in the fragment of the returned short URL.
 *
 * NoteFade uses VoidHop to ship video-mode notes: the normal chunked NoteFade
 * URL would exceed practical paste-in-chat limits, so we wrap it through
 * VoidHop to get a ~110-char shareable link that expands back to the full
 * fragment on the recipient's device.
 *
 * Port of the encrypt path from:
 *   C:/Users/titan/Desktop/Repositories/voidhop/src/crypto/encrypt.ts
 *   C:/Users/titan/Desktop/Repositories/voidhop/src/crypto/padding.ts
 *
 * We stay byte-compatible with VoidHop's wire format so the recipient's
 * `voidhop.com/<id>#<key>` redirect page can decrypt our blob verbatim.
 */

import { toBase64Url } from '@/crypto'
import { VOIDHOP_BASE_URL } from '@/constants'

const AES_KEY_BYTES = 32
const AES_GCM_IV_BYTES = 12
const LENGTH_HEADER_BYTES = 4

/** Tiered padding buckets — must match voidhop/src/constants PADDING_BUCKETS */
const PADDING_BUCKETS = [1024, 10240, 51200, 102400, 262144] as const

const DEFAULT_API_BASE = `${VOIDHOP_BASE_URL}/api/v1`

export class VoidHopError extends Error {
  constructor(
    public readonly code:
      | 'URL_TOO_LONG'
      | 'RATE_LIMITED'
      | 'BUDGET_EXHAUSTED'
      | 'NETWORK'
      | 'SERVER'
      | 'UNKNOWN',
    message: string,
  ) {
    super(message)
    this.name = 'VoidHopError'
  }
}

export type VoidHopTtl = 3600 | 86400 | 604800

function pickBucket(plaintextLen: number): number {
  for (const b of PADDING_BUCKETS) {
    if (LENGTH_HEADER_BYTES + plaintextLen <= b) return b
  }
  throw new VoidHopError('URL_TOO_LONG', 'URL too long for VoidHop (>250 KB plaintext)')
}

function padBytesLengthPrefix(input: Uint8Array, bucket: number): Uint8Array {
  const out = new Uint8Array(bucket)
  out[0] = (input.length >>> 24) & 0xff
  out[1] = (input.length >>> 16) & 0xff
  out[2] = (input.length >>> 8) & 0xff
  out[3] = input.length & 0xff
  out.set(input, LENGTH_HEADER_BYTES)
  return out
}

export interface ShortenResult {
  /** Full short URL ready to share, e.g. `https://voidhop.com/abcd1234#<keyB64url>` */
  shortUrl: string
  /** The id returned by VoidHop (for deletion/revocation if we ever wire that up) */
  id: string
  /** TTL selected (seconds); echoes back what the caller asked for */
  ttl: VoidHopTtl
}

/**
 * Encrypt `longUrl` client-side, store the ciphertext via VoidHop's public
 * API, and return a short shareable URL with the decryption key in the
 * fragment.
 *
 * Zero-knowledge preserved: VoidHop's server never sees `longUrl` or the
 * AES key. The blob is opaque ciphertext under a key that exists only in
 * the returned `shortUrl`'s fragment.
 */
export async function encryptAndShorten(
  longUrl: string,
  ttl: VoidHopTtl = 604800,
  apiBase: string = DEFAULT_API_BASE,
): Promise<ShortenResult> {
  const plaintextBytes = new TextEncoder().encode(longUrl)
  const bucket = pickBucket(plaintextBytes.length)
  const padded = padBytesLengthPrefix(plaintextBytes, bucket)

  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES))
  const rawKey = crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES))

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey.slice().buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  )

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
      cryptoKey,
      padded.slice().buffer as ArrayBuffer,
    ),
  )

  const payload = new Uint8Array(iv.length + ciphertext.length)
  payload.set(iv, 0)
  payload.set(ciphertext, iv.length)

  const blob = toBase64Url(payload)
  const keyB64url = toBase64Url(rawKey)

  // Scrub the raw key from our local buffer (the CryptoKey object retains
  // its own internal copy that we cannot reach). SR-KEY-01 equivalent.
  crypto.getRandomValues(rawKey)

  let response: Response
  try {
    response = await fetch(`${apiBase}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blob, ttl }),
    })
  } catch (err) {
    throw new VoidHopError(
      'NETWORK',
      err instanceof Error ? err.message : 'failed to reach voidhop',
    )
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new VoidHopError('RATE_LIMITED', 'voidhop rate-limited this request — try again in a minute')
    }
    let bodyText: string | undefined
    try {
      bodyText = await response.text()
    } catch {
      /* ignore */
    }
    if (bodyText?.includes('BUDGET_EXHAUSTED')) {
      throw new VoidHopError(
        'BUDGET_EXHAUSTED',
        'voidhop daily budget for notefade is exhausted — note will fall back to the long URL',
      )
    }
    throw new VoidHopError(
      'SERVER',
      `voidhop returned ${response.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ''}`,
    )
  }

  let json: { id?: string }
  try {
    json = (await response.json()) as { id?: string }
  } catch {
    throw new VoidHopError('SERVER', 'voidhop returned a malformed response')
  }
  if (!json.id) {
    throw new VoidHopError('SERVER', 'voidhop response missing id')
  }

  const shortUrl = `${VOIDHOP_BASE_URL}/${json.id}#${keyB64url}`
  return { shortUrl, id: json.id, ttl }
}

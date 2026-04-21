import { MAX_NOTE_CHARS_SINGLE, MULTI_PREFIX, MULTI_DELIMITER } from '@/constants'

/**
 * Split text into chunks of at most `maxChars` characters.
 * Respects UTF-16 surrogate pairs — never splits in the middle of an emoji
 * or supplementary-plane character.
 */
export function splitText(
  text: string,
  maxChars: number = MAX_NOTE_CHARS_SINGLE,
): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let offset = 0

  while (offset < text.length) {
    let end = Math.min(offset + maxChars, text.length)

    // If we'd split in the middle of a surrogate pair, back up by 1
    if (end < text.length) {
      const code = text.charCodeAt(end - 1)
      // High surrogate (0xD800–0xDBFF) without its low surrogate
      if (code >= 0xd800 && code <= 0xdbff) {
        end -= 1
      }
    }

    chunks.push(text.slice(offset, end))
    offset = end
  }

  return chunks
}

/**
 * Estimate the total URL fragment length for a multi-chunk note.
 * Uses worst-case UTF-8 expansion (3 bytes per char) for conservative estimates.
 *
 * Per-chunk layout (compact fragment):
 *   shardId (16 hex chars) + ":" + check (~6 chars) + ":" + base64url(urlShare + IV + ciphertext + GCM tag)
 *   urlShare = 48 bytes, IV = 12 bytes, GCM tag = 16 bytes
 *   ciphertext = UTF-8 encoded text bytes
 *
 * Returns the estimated character count of the full fragment.
 */
export function estimateMultiFragmentLength(chunks: string[]): number {
  if (chunks.length <= 1) return 0 // not multi-chunk

  const SHARD_ID_LEN = 16
  const SEPARATOR_LEN = 2 // two ":" separators
  const CHECK_LEN = 6
  const URL_SHARE_BYTES = 48
  const IV_BYTES = 12
  const GCM_TAG_BYTES = 16

  let total = MULTI_PREFIX.length // "multi:"

  for (let i = 0; i < chunks.length; i++) {
    // Worst-case UTF-8: 3 bytes per char (covers CJK; 4-byte chars like emoji
    // count as 2 JS chars due to surrogate pairs, so 4/2 = 2 bytes/char is fine)
    const textBytes = chunks[i]!.length * 3
    const rawBytes = URL_SHARE_BYTES + IV_BYTES + textBytes + GCM_TAG_BYTES
    const base64Len = Math.ceil((rawBytes * 4) / 3)
    const fragmentLen = SHARD_ID_LEN + SEPARATOR_LEN + CHECK_LEN + base64Len

    total += fragmentLen
    if (i > 0) total += MULTI_DELIMITER.length // "|" between chunks
  }

  return total
}

// Firefox practical fragment limit (chars)
export const FRAGMENT_LIMIT = 60000

/**
 * Split raw bytes into fixed-size chunks. Unlike splitText, this operates on
 * bytes directly — no surrogate-pair handling, no UTF-8 boundaries to respect.
 * Used for voice notes where the plaintext is an opaque Opus/AAC byte stream.
 */
export function splitBytes(bytes: Uint8Array, maxBytesPerChunk: number): Uint8Array[] {
  if (bytes.length <= maxBytesPerChunk) return [bytes]

  const chunks: Uint8Array[] = []
  for (let offset = 0; offset < bytes.length; offset += maxBytesPerChunk) {
    chunks.push(bytes.slice(offset, Math.min(offset + maxBytesPerChunk, bytes.length)))
  }
  return chunks
}

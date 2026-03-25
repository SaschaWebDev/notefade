import { describe, expect, it } from 'vitest'
import {
  encrypt,
  toBase64Url,
  decryptByokContent,
  isValidByokKey,
} from '@/crypto/crypto'

describe('decryptByokContent', () => {
  it('round-trips encrypt → decryptByokContent', async () => {
    const message = 'hello BYOK world'
    const { ciphertext, iv, key } = await encrypt(message)

    // Build BYOK blob: IV || ciphertext (which includes GCM tag)
    const blob = new Uint8Array(iv.length + ciphertext.length)
    blob.set(iv, 0)
    blob.set(ciphertext, iv.length)

    const blobB64 = toBase64Url(blob)
    const keyB64 = toBase64Url(key)

    const decrypted = await decryptByokContent(blobB64, keyB64)
    expect(decrypted).toBe(message)
  })

  it('decrypts multi-byte unicode content', async () => {
    const message = 'emoji: \u{1F512} and CJK: \u4F60\u597D'
    const { ciphertext, iv, key } = await encrypt(message)

    const blob = new Uint8Array(iv.length + ciphertext.length)
    blob.set(iv, 0)
    blob.set(ciphertext, iv.length)

    const decrypted = await decryptByokContent(toBase64Url(blob), toBase64Url(key))
    expect(decrypted).toBe(message)
  })

  it('rejects wrong key', async () => {
    const { ciphertext, iv } = await encrypt('secret')
    const wrongKey = crypto.getRandomValues(new Uint8Array(32))

    const blob = new Uint8Array(iv.length + ciphertext.length)
    blob.set(iv, 0)
    blob.set(ciphertext, iv.length)

    await expect(
      decryptByokContent(toBase64Url(blob), toBase64Url(wrongKey)),
    ).rejects.toThrow()
  })

  it('rejects key with wrong length', async () => {
    const { ciphertext, iv } = await encrypt('secret')
    const shortKey = crypto.getRandomValues(new Uint8Array(16))

    const blob = new Uint8Array(iv.length + ciphertext.length)
    blob.set(iv, 0)
    blob.set(ciphertext, iv.length)

    await expect(
      decryptByokContent(toBase64Url(blob), toBase64Url(shortKey)),
    ).rejects.toThrow('BYOK key must be 32 bytes')
  })

  it('rejects blob that is too short', async () => {
    const tinyBlob = crypto.getRandomValues(new Uint8Array(20))
    const key = crypto.getRandomValues(new Uint8Array(32))

    await expect(
      decryptByokContent(toBase64Url(tinyBlob), toBase64Url(key)),
    ).rejects.toThrow('BYOK content too short')
  })

  it('handles empty plaintext', async () => {
    const message = ''
    const { ciphertext, iv, key } = await encrypt(message)

    const blob = new Uint8Array(iv.length + ciphertext.length)
    blob.set(iv, 0)
    blob.set(ciphertext, iv.length)

    const decrypted = await decryptByokContent(toBase64Url(blob), toBase64Url(key))
    expect(decrypted).toBe('')
  })
})

describe('isValidByokKey', () => {
  it('returns true for valid 32-byte key', () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    expect(isValidByokKey(toBase64Url(key))).toBe(true)
  })

  it('returns false for 16-byte key', () => {
    const key = crypto.getRandomValues(new Uint8Array(16))
    expect(isValidByokKey(toBase64Url(key))).toBe(false)
  })

  it('returns false for 64-byte key', () => {
    const key = crypto.getRandomValues(new Uint8Array(64))
    expect(isValidByokKey(toBase64Url(key))).toBe(false)
  })

  it('returns false for invalid base64url', () => {
    expect(isValidByokKey('not valid base64!!')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidByokKey('')).toBe(false)
  })
})

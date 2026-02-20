import { describe, expect, it } from 'vitest'
import {
  splitKey,
  reconstructKey,
  encrypt,
  decrypt,
  toBase64Url,
  fromBase64Url,
  createNote,
  openNote,
} from './crypto'

describe('toBase64Url / fromBase64Url', () => {
  it('round-trips arbitrary bytes', () => {
    const original = crypto.getRandomValues(new Uint8Array(64))
    const encoded = toBase64Url(original)
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(original)
  })

  it('produces URL-safe characters only', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(256))
    const encoded = toBase64Url(bytes)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('handles empty array', () => {
    const encoded = toBase64Url(new Uint8Array(0))
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(new Uint8Array(0))
  })

  it('handles large payloads without stack overflow', () => {
    const large = crypto.getRandomValues(new Uint8Array(50_000))
    const encoded = toBase64Url(large)
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(large)
  })

  it('round-trips single byte', () => {
    const original = new Uint8Array([0xff])
    const encoded = toBase64Url(original)
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(original)
  })

  it('round-trips all possible byte values', () => {
    const original = new Uint8Array(256)
    for (let i = 0; i < 256; i++) original[i] = i
    const encoded = toBase64Url(original)
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(original)
  })

  it('does not contain +, /, or = characters', () => {
    // These are standard base64 chars that should be replaced
    const bytes = crypto.getRandomValues(new Uint8Array(1000))
    const encoded = toBase64Url(bytes)
    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(encoded).not.toContain('=')
  })
})

describe('splitKey / reconstructKey', () => {
  it('reconstructs the original key', () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const original = new Uint8Array(key)
    const { urlShare, serverShard } = splitKey(key)
    const reconstructed = reconstructKey(urlShare, serverShard)
    expect(reconstructed).toEqual(original)
  })

  it('produces correct byte sizes', () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const { urlShare, serverShard } = splitKey(key)
    expect(urlShare.length).toBe(48)
    expect(serverShard.length).toBe(16)
  })

  it('produces different splits for the same key (randomness)', () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const split1 = splitKey(new Uint8Array(key))
    const split2 = splitKey(new Uint8Array(key))
    // Extremely unlikely to be equal if using random mask
    expect(split1.urlShare).not.toEqual(split2.urlShare)
    expect(split1.serverShard).not.toEqual(split2.serverShard)
  })

  it('wrong shard fails reconstruction', () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const { urlShare } = splitKey(key)
    const wrongShard = crypto.getRandomValues(new Uint8Array(16))
    const reconstructed = reconstructKey(urlShare, wrongShard)
    expect(reconstructed).not.toEqual(key)
  })

  it('wrong urlShare fails reconstruction', () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const { serverShard } = splitKey(key)
    const wrongUrlShare = crypto.getRandomValues(new Uint8Array(48))
    const reconstructed = reconstructKey(wrongUrlShare, serverShard)
    expect(reconstructed).not.toEqual(key)
  })

  it('reconstructs correctly across many iterations', () => {
    for (let i = 0; i < 50; i++) {
      const key = crypto.getRandomValues(new Uint8Array(32))
      const original = new Uint8Array(key)
      const { urlShare, serverShard } = splitKey(key)
      const reconstructed = reconstructKey(urlShare, serverShard)
      expect(reconstructed).toEqual(original)
    }
  })

  it('urlShare and serverShard individually look random', () => {
    // A zero key should still produce random-looking shares
    const key = new Uint8Array(32) // all zeros
    const { urlShare, serverShard } = splitKey(key)
    // At least some bytes should be non-zero (overwhelmingly likely)
    const urlNonZero = urlShare.some((b) => b !== 0)
    const shardNonZero = serverShard.some((b) => b !== 0)
    expect(urlNonZero).toBe(true)
    expect(shardNonZero).toBe(true)
  })
})

describe('encrypt / decrypt', () => {
  it('round-trips a message', async () => {
    const message = 'Hello, world!'
    const { ciphertext, iv, key } = await encrypt(message)
    const decrypted = await decrypt(ciphertext, iv, key)
    expect(decrypted).toBe(message)
  })

  it('encrypts unicode messages', async () => {
    const message = 'Hallo Welt! Tschuss! 🎉'
    const { ciphertext, iv, key } = await encrypt(message)
    const decrypted = await decrypt(ciphertext, iv, key)
    expect(decrypted).toBe(message)
  })

  it('rejects tampered ciphertext', async () => {
    const { ciphertext, iv, key } = await encrypt('secret')
    // Flip a byte in the ciphertext
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 0xff
    await expect(decrypt(ciphertext, iv, key)).rejects.toThrow()
  })

  it('rejects wrong key', async () => {
    const { ciphertext, iv } = await encrypt('secret')
    const wrongKey = crypto.getRandomValues(new Uint8Array(32))
    await expect(decrypt(ciphertext, iv, wrongKey)).rejects.toThrow()
  })

  it('produces different ciphertexts for same message (random IV)', async () => {
    const message = 'same message'
    const result1 = await encrypt(message)
    const result2 = await encrypt(message)
    expect(result1.ciphertext).not.toEqual(result2.ciphertext)
    expect(result1.iv).not.toEqual(result2.iv)
  })

  it('rejects wrong IV', async () => {
    const { ciphertext, key } = await encrypt('secret')
    const wrongIv = crypto.getRandomValues(new Uint8Array(12))
    await expect(decrypt(ciphertext, wrongIv, key)).rejects.toThrow()
  })

  it('returns correct byte sizes', async () => {
    const { ciphertext, iv, key } = await encrypt('test')
    expect(key.length).toBe(32)
    expect(iv.length).toBe(12)
    // AES-GCM adds 16-byte auth tag to ciphertext
    expect(ciphertext.length).toBe(new TextEncoder().encode('test').length + 16)
  })

  it('encrypts empty string', async () => {
    const { ciphertext, iv, key } = await encrypt('')
    const decrypted = await decrypt(ciphertext, iv, key)
    expect(decrypted).toBe('')
  })

  it('encrypts CJK characters', async () => {
    const message = '你好世界 こんにちは 안녕하세요'
    const { ciphertext, iv, key } = await encrypt(message)
    const decrypted = await decrypt(ciphertext, iv, key)
    expect(decrypted).toBe(message)
  })

  it('encrypts mixed scripts and special characters', async () => {
    const message = 'Ñoño → «crème brûlée» ∞ ≠ ∅\n\ttab\r\nnewline'
    const { ciphertext, iv, key } = await encrypt(message)
    const decrypted = await decrypt(ciphertext, iv, key)
    expect(decrypted).toBe(message)
  })

  it('encrypts multiline content with whitespace', async () => {
    const message = 'line 1\nline 2\n\n  indented\ttabbed'
    const { ciphertext, iv, key } = await encrypt(message)
    const decrypted = await decrypt(ciphertext, iv, key)
    expect(decrypted).toBe(message)
  })
})

describe('createNote / openNote', () => {
  it('full round-trip: create → open', async () => {
    const message = 'This is a secret note.'
    const { urlPayload, serverShard } = await createNote(message)
    const decrypted = await openNote(urlPayload, serverShard)
    expect(decrypted).toBe(message)
  })

  it('fails with wrong shard', async () => {
    const { urlPayload } = await createNote('secret')
    const wrongShard = toBase64Url(crypto.getRandomValues(new Uint8Array(16)))
    await expect(openNote(urlPayload, wrongShard)).rejects.toThrow()
  })

  it('handles empty message', async () => {
    const { urlPayload, serverShard } = await createNote('')
    const decrypted = await openNote(urlPayload, serverShard)
    expect(decrypted).toBe('')
  })

  it('handles long message', async () => {
    const message = 'x'.repeat(1800)
    const { urlPayload, serverShard } = await createNote(message)
    const decrypted = await openNote(urlPayload, serverShard)
    expect(decrypted).toBe(message)
  })

  it('serverShard is base64url of exactly 16 bytes', async () => {
    const { serverShard } = await createNote('test')
    const decoded = fromBase64Url(serverShard)
    expect(decoded.length).toBe(16)
  })

  it('urlPayload contains urlShare(48) + iv(12) + ciphertext', async () => {
    const { urlPayload } = await createNote('test')
    const bytes = fromBase64Url(urlPayload)
    // At minimum: 48 (urlShare) + 12 (iv) + 4 (plaintext) + 16 (auth tag)
    expect(bytes.length).toBeGreaterThanOrEqual(80)
    // First 48 bytes are urlShare, next 12 are IV
    expect(bytes.length).toBe(48 + 12 + new TextEncoder().encode('test').length + 16)
  })

  it('round-trips CJK and emoji through full flow', async () => {
    const message = '🔒 秘密のメッセージ 비밀 消息'
    const { urlPayload, serverShard } = await createNote(message)
    const decrypted = await openNote(urlPayload, serverShard)
    expect(decrypted).toBe(message)
  })

  it('round-trips special characters through full flow', async () => {
    const message = '<script>alert("xss")</script>\n& " \' \0 \t'
    const { urlPayload, serverShard } = await createNote(message)
    const decrypted = await openNote(urlPayload, serverShard)
    expect(decrypted).toBe(message)
  })

  it('two createNote calls produce different payloads', async () => {
    const result1 = await createNote('same message')
    const result2 = await createNote('same message')
    expect(result1.urlPayload).not.toBe(result2.urlPayload)
    expect(result1.serverShard).not.toBe(result2.serverShard)
  })

  it('fails with truncated urlPayload', async () => {
    const { urlPayload, serverShard } = await createNote('secret')
    const truncated = urlPayload.slice(0, urlPayload.length - 10)
    await expect(openNote(truncated, serverShard)).rejects.toThrow()
  })

  it('fails with swapped shards from different notes', async () => {
    const note1 = await createNote('message one')
    const note2 = await createNote('message two')
    // Using note1's payload with note2's shard should fail
    await expect(openNote(note1.urlPayload, note2.serverShard)).rejects.toThrow()
  })
})

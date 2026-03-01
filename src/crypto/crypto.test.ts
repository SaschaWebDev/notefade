import { describe, expect, it } from 'vitest'
import {
  splitKey,
  reconstructKey,
  encrypt,
  decrypt,
  unpadPlaintext,
  padPayload,
  unpadPayload,
  PAYLOAD_PAD_LEN,
  toBase64Url,
  fromBase64Url,
  stringToBase64Url,
  stringFromBase64Url,
  createNote,
  openNote,
  computeCheck,
  protectFragment,
  unprotectFragment,
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

  it('replaces lone surrogates with U+FFFD on round-trip', async () => {
    // Lone surrogates are invalid Unicode — TextEncoder silently
    // replaces them with U+FFFD (replacement character), so the
    // decrypted output will NOT match the original input.
    const lone = '\uD800'
    const { ciphertext, iv, key } = await encrypt(lone)
    const decrypted = await decrypt(ciphertext, iv, key)
    expect(decrypted).not.toBe(lone)
    expect(decrypted).toBe('\uFFFD')
  })

  it('replaces mixed lone surrogates with U+FFFD preserving valid chars', async () => {
    const message = 'hello\uD800world\uDBFFend'
    const { ciphertext, iv, key } = await encrypt(message)
    const decrypted = await decrypt(ciphertext, iv, key)
    expect(decrypted).not.toBe(message)
    expect(decrypted).toBe('hello\uFFFDworld\uFFFDend')
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
    // urlShare(48) + iv(12) + plaintext(4) + gcm tag(16) = 80
    expect(bytes.length).toBe(80)
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

describe('computeCheck — URL integrity', () => {
  it('produces consistent output for the same input', () => {
    const payload = 'someBase64UrlPayload'
    expect(computeCheck(payload)).toBe(computeCheck(payload))
  })

  it('produces different output for different inputs', () => {
    const a = computeCheck('payloadA')
    const b = computeCheck('payloadB')
    expect(a).not.toBe(b)
  })

  it('produces URL-safe characters only', () => {
    const check = computeCheck('test-payload-12345')
    expect(check).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('detects a single appended character', async () => {
    const { urlPayload } = await createNote('hello')
    const check = computeCheck(urlPayload)
    expect(computeCheck(urlPayload + '3')).not.toBe(check)
  })

  it('detects a single removed character', async () => {
    const { urlPayload } = await createNote('hello')
    const check = computeCheck(urlPayload)
    expect(computeCheck(urlPayload.slice(0, -1))).not.toBe(check)
  })

  it('detects a single changed character', async () => {
    const { urlPayload } = await createNote('hello')
    const check = computeCheck(urlPayload)
    const corrupted = urlPayload.slice(0, -1) + (urlPayload.endsWith('A') ? 'B' : 'A')
    expect(computeCheck(corrupted)).not.toBe(check)
  })
})

describe('stringToBase64Url / stringFromBase64Url', () => {
  it('round-trips ASCII strings', () => {
    const str = 'https://my-worker.example.com'
    expect(stringFromBase64Url(stringToBase64Url(str))).toBe(str)
  })

  it('round-trips unicode strings', () => {
    const str = 'https://例え.jp/api'
    expect(stringFromBase64Url(stringToBase64Url(str))).toBe(str)
  })

  it('round-trips empty string', () => {
    expect(stringFromBase64Url(stringToBase64Url(''))).toBe('')
  })

  it('produces URL-safe characters only', () => {
    const encoded = stringToBase64Url('https://example.com/some/path?q=1')
    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/)
  })

  it('does not contain @ character', () => {
    // Important: @ is our BYOS delimiter, must not appear in encoded output
    const encoded = stringToBase64Url('https://example.com')
    expect(encoded).not.toContain('@')
  })

  it('round-trips long URLs', () => {
    const str = 'https://my-very-long-subdomain.workers.dev/api/v2/shards'
    expect(stringFromBase64Url(stringToBase64Url(str))).toBe(str)
  })
})

describe('stress tests — character encoding edge cases', () => {
  // Helper: full round-trip through createNote/openNote and verify byte math
  async function roundTrip(message: string) {
    const { urlPayload, serverShard } = await createNote(message)
    const decrypted = await openNote(urlPayload, serverShard)
    return { decrypted, urlPayload, serverShard }
  }

  // --- Max-length payloads by script ---

  it('max ASCII (1800 chars, 1 byte each)', async () => {
    const message = 'a'.repeat(1800)
    const { decrypted, urlPayload } = await roundTrip(message)
    expect(decrypted).toBe(message)
    const rawBytes = fromBase64Url(urlPayload)
    // urlShare(48) + iv(12) + plaintext(1800) + gcm tag(16) = 1876
    expect(rawBytes.length).toBe(48 + 12 + 1800 + 16)
  })

  it('max CJK (1800 chars, 3 bytes each) — worst single-code-unit expansion', async () => {
    const message = '中'.repeat(1800)
    const { decrypted, urlPayload } = await roundTrip(message)
    expect(decrypted).toBe(message)
    const rawBytes = fromBase64Url(urlPayload)
    // urlShare(48) + iv(12) + plaintext(5400) + gcm tag(16) = 5476
    expect(rawBytes.length).toBe(48 + 12 + 5400 + 16)
  })

  it('max emoji (900 emoji, .length === 1800, 4 bytes each)', async () => {
    const message = '😀'.repeat(900)
    expect(message.length).toBe(1800) // surrogate pairs, 2 code units each
    const { decrypted, urlPayload } = await roundTrip(message)
    expect(decrypted).toBe(message)
    const rawBytes = fromBase64Url(urlPayload)
    // urlShare(48) + iv(12) + plaintext(3600) + gcm tag(16) = 3676
    expect(rawBytes.length).toBe(48 + 12 + 3600 + 16)
  })

  it('max Latin extended (1800 chars, 2 bytes each)', async () => {
    const message = 'é'.repeat(1800)
    const { decrypted, urlPayload } = await roundTrip(message)
    expect(decrypted).toBe(message)
    const rawBytes = fromBase64Url(urlPayload)
    // urlShare(48) + iv(12) + plaintext(3600) + gcm tag(16) = 3676
    expect(rawBytes.length).toBe(48 + 12 + 3600 + 16)
  })

  // --- Invisible / zero-width characters ---

  it('zero-width spaces (invisible but consume char budget)', async () => {
    const message = '\u200B'.repeat(1800)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
    expect(decrypted.length).toBe(1800)
  })

  it('BOM characters — leading BOM stripped by TextDecoder', async () => {
    // TextDecoder strips a leading U+FEFF (BOM) by default.
    // A message of 500 BOMs decrypts to 499 because the first is consumed.
    const message = '\uFEFF'.repeat(500)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).not.toBe(message)
    expect(decrypted).toBe('\uFEFF'.repeat(499))
    expect(decrypted.length).toBe(499)
  })

  it('BOM after non-BOM prefix survives round-trip', async () => {
    // Only a *leading* BOM is stripped — interior BOMs are preserved
    const message = 'x' + '\uFEFF'.repeat(500)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
  })

  it('LTR/RTL directional marks', async () => {
    const message = '\u200Ehello\u200Fworld\u200E\u200F'.repeat(100)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
  })

  it('mixed invisible characters', async () => {
    // Zero-width space, zero-width non-joiner, zero-width joiner, word joiner
    const message = '\u200B\u200C\u200D\u2060'.repeat(450)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
  })

  // --- Zalgo text ---

  it('Zalgo text — extreme combining diacriticals per visible char', async () => {
    // Each combining mark is 2 UTF-8 bytes. Stack 20 marks on one letter.
    const base = 'Z'
    const marks = '\u0335\u0339\u0346\u034A\u034B\u034C\u0350\u0351\u0352\u0353'
      + '\u0354\u0355\u0356\u0357\u0358\u035B\u035C\u035D\u035E\u035F'
    const zalgoChar = base + marks // 1 visible char, 21 code units
    const message = zalgoChar.repeat(85) // 85 × 21 = 1785 code units
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
  })

  // --- Null bytes and control characters ---

  it('null bytes (1800 \\0 characters)', async () => {
    const message = '\0'.repeat(1800)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
    expect(decrypted.length).toBe(1800)
  })

  it('only newlines', async () => {
    const message = '\n'.repeat(1800)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
  })

  it('all ASCII control characters (0x00–0x1F)', async () => {
    let message = ''
    for (let i = 0; i < 32; i++) message += String.fromCharCode(i)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
  })

  it('DEL and high control characters', async () => {
    // DEL (0x7F) and C1 control chars (0x80–0x9F)
    let message = ''
    for (let i = 0x7F; i <= 0x9F; i++) message += String.fromCharCode(i)
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe(message)
  })

  // --- Lone surrogates through full flow ---

  it('lone surrogates corrupt through full createNote/openNote flow', async () => {
    const message = '\uD800secret\uDBFF'
    const { decrypted } = await roundTrip(message)
    // TextEncoder replaces lone surrogates with U+FFFD
    expect(decrypted).not.toBe(message)
    expect(decrypted).toBe('\uFFFDsecret\uFFFD')
  })

  it('lone low surrogate without preceding high surrogate', async () => {
    const message = 'abc\uDC00def'
    const { decrypted } = await roundTrip(message)
    expect(decrypted).toBe('abc\uFFFDdef')
  })

  it('reversed surrogate pair (low before high)', async () => {
    const message = '\uDC00\uD800'
    const { decrypted } = await roundTrip(message)
    // Both are lone surrogates — each replaced with U+FFFD
    expect(decrypted).toBe('\uFFFD\uFFFD')
  })

  // --- Mixed worst-case ---

  it('mixed scripts, emoji, surrogates, and zero-width chars', async () => {
    // Valid parts round-trip; lone surrogates become U+FFFD
    const message = 'a😀中\u200B\uD800é'.repeat(200)
    const { decrypted } = await roundTrip(message)
    const expected = 'a😀中\u200B\uFFFDé'.repeat(200)
    expect(decrypted).toBe(expected)
  })

  // --- URL payload size verification ---

  it('short messages produce shorter payloads than long messages', async () => {
    const short = await createNote('a')
    const long = await createNote('a'.repeat(1800))
    const shortLen = fromBase64Url(short.urlPayload).length
    const longLen = fromBase64Url(long.urlPayload).length
    expect(shortLen).toBeLessThan(longLen)
  })

  it('padPayload produces uniform length for different payloads', async () => {
    const short = await createNote('a')
    const medium = await createNote('a'.repeat(1000))
    const cjk = await createNote('中'.repeat(1000))
    const shortPadded = padPayload(short.urlPayload)
    const mediumPadded = padPayload(medium.urlPayload)
    const cjkPadded = padPayload(cjk.urlPayload)
    expect(shortPadded.length).toBe(PAYLOAD_PAD_LEN)
    expect(mediumPadded.length).toBe(PAYLOAD_PAD_LEN)
    expect(cjkPadded.length).toBe(PAYLOAD_PAD_LEN)
  })

  it('base64url output length matches expected formula', async () => {
    const { urlPayload } = await createNote('test payload here')
    const rawBytes = fromBase64Url(urlPayload)
    const rawLen = rawBytes.length
    const expectedBase64Len = Math.ceil((rawLen * 4) / 3)
    // base64url strips trailing '=', so length <= ceil(n*4/3)
    expect(urlPayload.length).toBeLessThanOrEqual(expectedBase64Len)
    expect(urlPayload.length).toBeGreaterThanOrEqual(expectedBase64Len - 2)
  })
})

describe('padPayload / unpadPayload', () => {
  it('produces exactly PAYLOAD_PAD_LEN chars', async () => {
    const { urlPayload } = await createNote('hello')
    const padded = padPayload(urlPayload)
    expect(padded.length).toBe(PAYLOAD_PAD_LEN)
  })

  it('starts with . marker', async () => {
    const { urlPayload } = await createNote('hello')
    const padded = padPayload(urlPayload)
    expect(padded[0]).toBe('.')
  })

  it('round-trips through pad/unpad', async () => {
    const { urlPayload } = await createNote('round-trip test')
    const padded = padPayload(urlPayload)
    const unpadded = unpadPayload(padded)
    expect(unpadded).toBe(urlPayload)
  })

  it('returns input as-is when no . prefix (backward compat)', () => {
    const payload = 'someBase64UrlPayloadWithoutDot'
    expect(unpadPayload(payload)).toBe(payload)
  })

  it('openNote handles padded urlPayload directly', async () => {
    const message = 'padded openNote test'
    const { urlPayload, serverShard } = await createNote(message)
    const padded = padPayload(urlPayload)
    const decrypted = await openNote(padded, serverShard)
    expect(decrypted).toBe(message)
  })

  it('uniform length for different payload sizes', async () => {
    const short = await createNote('a')
    const long = await createNote('a'.repeat(1800))
    const cjk = await createNote('中'.repeat(1800))
    expect(padPayload(short.urlPayload).length).toBe(PAYLOAD_PAD_LEN)
    expect(padPayload(long.urlPayload).length).toBe(PAYLOAD_PAD_LEN)
    expect(padPayload(cjk.urlPayload).length).toBe(PAYLOAD_PAD_LEN)
  })

  it('random fill differs between calls', async () => {
    const { urlPayload } = await createNote('same')
    const a = padPayload(urlPayload)
    const b = padPayload(urlPayload)
    // The real payload portion is the same, but the fill should differ
    expect(a).not.toBe(b)
    // Both unpad to the same payload
    expect(unpadPayload(a)).toBe(urlPayload)
    expect(unpadPayload(b)).toBe(urlPayload)
  })

  it('handles empty payload', async () => {
    const { urlPayload } = await createNote('')
    const padded = padPayload(urlPayload)
    expect(padded.length).toBe(PAYLOAD_PAD_LEN)
    expect(unpadPayload(padded)).toBe(urlPayload)
  })

  it('handles max-length CJK payload', async () => {
    const { urlPayload } = await createNote('中'.repeat(1800))
    const padded = padPayload(urlPayload)
    expect(padded.length).toBe(PAYLOAD_PAD_LEN)
    expect(unpadPayload(padded)).toBe(urlPayload)
  })
})

describe('unpadPlaintext (backward compat)', () => {
  it('returns input as-is when no 0xFF found', () => {
    const original = new TextEncoder().encode('old note without padding')
    const unpadded = unpadPlaintext(original)
    expect(unpadded).toEqual(original)
  })

  it('strips bytes after 0xFF delimiter', () => {
    const msg = new TextEncoder().encode('hello')
    const padded = new Uint8Array(100)
    padded.set(msg, 0)
    padded[msg.length] = 0xff
    const unpadded = unpadPlaintext(padded)
    expect(unpadded).toEqual(msg)
  })
})

describe('protectFragment / unprotectFragment', () => {
  it('round-trips with correct password', async () => {
    const fragment = 'abc123:ABCD:someUrlPayload'
    const password = 'my-secret-password'
    const protectedData = await protectFragment(fragment, password)
    const decrypted = await unprotectFragment(protectedData, password)
    expect(decrypted).toBe(fragment)
  })

  it('wrong password throws', async () => {
    const fragment = 'abc123:ABCD:someUrlPayload'
    const protectedData = await protectFragment(fragment, 'correct')
    await expect(unprotectFragment(protectedData, 'wrong')).rejects.toThrow()
  })

  it('different passwords produce different outputs', async () => {
    const fragment = 'abc123:ABCD:someUrlPayload'
    const a = await protectFragment(fragment, 'password-a')
    const b = await protectFragment(fragment, 'password-b')
    expect(a).not.toBe(b)
  })

  it('same password produces different outputs (random salt/IV)', async () => {
    const fragment = 'abc123:ABCD:someUrlPayload'
    const password = 'same-password'
    const a = await protectFragment(fragment, password)
    const b = await protectFragment(fragment, password)
    expect(a).not.toBe(b)
    // Both should still decrypt correctly
    expect(await unprotectFragment(a, password)).toBe(fragment)
    expect(await unprotectFragment(b, password)).toBe(fragment)
  })

  it('preserves BYOS @ suffix in fragment', async () => {
    const fragment = 'abc123:ABCD:someUrlPayload@eyJ0IjoiY2Ytay4ifQ'
    const password = 'test'
    const protectedData = await protectFragment(fragment, password)
    const decrypted = await unprotectFragment(protectedData, password)
    expect(decrypted).toBe(fragment)
  })

  it('salt is 16 bytes, blob is >= 28 bytes (12 IV + 16 GCM tag)', async () => {
    const fragment = 'x'
    const protectedData = await protectFragment(fragment, 'pw')
    const [saltPart, blobPart] = protectedData.split(':')
    const salt = fromBase64Url(saltPart!)
    const blob = fromBase64Url(blobPart!)
    expect(salt.length).toBe(16)
    // Blob = 12 (IV) + plaintext + 16 (GCM tag), minimum 28 for 0-length plaintext
    expect(blob.length).toBeGreaterThanOrEqual(28)
  })

  it('output uses URL-safe characters only', async () => {
    const protectedData = await protectFragment('test-fragment', 'pw')
    // Output format is base64url:base64url — both parts + colon are URL-safe
    expect(protectedData).toMatch(/^[A-Za-z0-9_:-]+$/)
  })

  it('long password (1000 chars) works', async () => {
    const fragment = 'abc123:ABCD:payload'
    const password = 'p'.repeat(1000)
    const protectedData = await protectFragment(fragment, password)
    const decrypted = await unprotectFragment(protectedData, password)
    expect(decrypted).toBe(fragment)
  })

  it('full end-to-end: createNote → build fragment → protectFragment → unprotectFragment → openNote', async () => {
    const message = 'end-to-end password test'
    const { urlPayload, serverShard } = await createNote(message)
    const check = computeCheck(urlPayload)
    const shardId = 'abcdef01'
    const fragment = `${shardId}:${check}:${urlPayload}`

    const password = 'e2e-password'
    const protectedData = await protectFragment(fragment, password)
    const decryptedFragment = await unprotectFragment(protectedData, password)
    expect(decryptedFragment).toBe(fragment)

    // Parse the fragment and open the note
    const parts = decryptedFragment.split(':')
    expect(parts[0]).toBe(shardId)
    expect(parts[1]).toBe(check)
    const recoveredPayload = parts.slice(2).join(':')
    const plaintext = await openNote(recoveredPayload, serverShard)
    expect(plaintext).toBe(message)
  })

  it('end-to-end with padded payload through protectFragment/unprotectFragment', async () => {
    const message = 'padded e2e test'
    const { urlPayload, serverShard } = await createNote(message)
    const check = computeCheck(urlPayload)
    const shardId = 'abcdef02'
    const paddedPayload = padPayload(urlPayload)
    const fragment = `${shardId}:${check}:${paddedPayload}`

    const password = 'padded-pw'
    const protectedData = await protectFragment(fragment, password)
    const decryptedFragment = await unprotectFragment(protectedData, password)
    expect(decryptedFragment).toBe(fragment)

    // Parse the fragment and open the note (openNote handles unpadPayload internally)
    const parts = decryptedFragment.split(':')
    expect(parts[0]).toBe(shardId)
    expect(parts[1]).toBe(check)
    const recoveredPayload = parts.slice(2).join(':')
    const plaintext = await openNote(recoveredPayload, serverShard)
    expect(plaintext).toBe(message)
  })
})

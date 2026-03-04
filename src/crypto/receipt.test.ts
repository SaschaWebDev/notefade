import { describe, expect, it } from 'vitest'
import {
  generateReceiptSeed,
  computeReceiptProof,
  verifyReceiptProof,
  encodeMetadata,
  decodeMetadata,
  fromBase64Url,
  createNote,
  openNote,
  protectFragment,
  unprotectFragment,
  computeCheck,
  padPayload,
  toBase64Url,
} from './crypto'

/* ================================================================== */
/*  generateReceiptSeed                                               */
/* ================================================================== */

describe('generateReceiptSeed', () => {
  it('returns a valid base64url string', () => {
    const seed = generateReceiptSeed()
    expect(seed).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('decodes to exactly 32 bytes', () => {
    const seed = generateReceiptSeed()
    const bytes = fromBase64Url(seed)
    expect(bytes.length).toBe(32)
  })

  it('produces different seeds each call', () => {
    const a = generateReceiptSeed()
    const b = generateReceiptSeed()
    expect(a).not.toBe(b)
  })

  it('batch: 100 seeds all decode to 32 bytes', () => {
    for (let i = 0; i < 100; i++) {
      const seed = generateReceiptSeed()
      expect(fromBase64Url(seed).length).toBe(32)
    }
  })
})

/* ================================================================== */
/*  computeReceiptProof / verifyReceiptProof — happy path             */
/* ================================================================== */

describe('computeReceiptProof / verifyReceiptProof — happy path', () => {
  it('proof verifies with matching seed + plaintext', async () => {
    const seed = generateReceiptSeed()
    const plaintext = 'This is a secret message'
    const proof = await computeReceiptProof(seed, plaintext)
    expect(await verifyReceiptProof(seed, plaintext, proof)).toBe(true)
  })

  it('proof is base64url and decodes to 32 bytes', async () => {
    const seed = generateReceiptSeed()
    const proof = await computeReceiptProof(seed, 'test')
    expect(proof).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(fromBase64Url(proof).length).toBe(32)
  })

  it('is deterministic — same inputs produce same proof', async () => {
    const seed = generateReceiptSeed()
    const plaintext = 'deterministic test'
    const proof1 = await computeReceiptProof(seed, plaintext)
    const proof2 = await computeReceiptProof(seed, plaintext)
    expect(proof1).toBe(proof2)
  })
})

/* ================================================================== */
/*  Receipt — edge cases                                              */
/* ================================================================== */

describe('receipt — edge cases', () => {
  it('empty plaintext produces a valid proof', async () => {
    const seed = generateReceiptSeed()
    const proof = await computeReceiptProof(seed, '')
    expect(await verifyReceiptProof(seed, '', proof)).toBe(true)
  })

  it('very long plaintext (10K chars) produces a valid proof', async () => {
    const seed = generateReceiptSeed()
    const plaintext = 'x'.repeat(10_000)
    const proof = await computeReceiptProof(seed, plaintext)
    expect(await verifyReceiptProof(seed, plaintext, proof)).toBe(true)
  })

  it('Unicode plaintext (CJK, emoji) produces a valid proof', async () => {
    const seed = generateReceiptSeed()
    const plaintext = '\u4F60\u597D\u4E16\u754C \uD83D\uDD12\uD83D\uDCDD'
    const proof = await computeReceiptProof(seed, plaintext)
    expect(await verifyReceiptProof(seed, plaintext, proof)).toBe(true)
  })

  it('null bytes and control chars in plaintext produce valid proof', async () => {
    const seed = generateReceiptSeed()
    const plaintext = '\0\x01\x02\x1F\x7F'
    const proof = await computeReceiptProof(seed, plaintext)
    expect(await verifyReceiptProof(seed, plaintext, proof)).toBe(true)
  })

  it('different seeds produce different proofs for same plaintext', async () => {
    const seed1 = generateReceiptSeed()
    const seed2 = generateReceiptSeed()
    const plaintext = 'same plaintext'
    const proof1 = await computeReceiptProof(seed1, plaintext)
    const proof2 = await computeReceiptProof(seed2, plaintext)
    expect(proof1).not.toBe(proof2)
  })

  it('same seed produces different proofs for different plaintexts', async () => {
    const seed = generateReceiptSeed()
    const proof1 = await computeReceiptProof(seed, 'message A')
    const proof2 = await computeReceiptProof(seed, 'message B')
    expect(proof1).not.toBe(proof2)
  })
})

/* ================================================================== */
/*  verifyReceiptProof — adversarial                                  */
/* ================================================================== */

describe('verifyReceiptProof — adversarial', () => {
  it('wrong seed returns false', async () => {
    const seed = generateReceiptSeed()
    const wrongSeed = generateReceiptSeed()
    const proof = await computeReceiptProof(seed, 'test')
    expect(await verifyReceiptProof(wrongSeed, 'test', proof)).toBe(false)
  })

  it('wrong plaintext returns false', async () => {
    const seed = generateReceiptSeed()
    const proof = await computeReceiptProof(seed, 'correct')
    expect(await verifyReceiptProof(seed, 'wrong', proof)).toBe(false)
  })

  it('single bit flip in proof returns false', async () => {
    const seed = generateReceiptSeed()
    const proof = await computeReceiptProof(seed, 'test')
    const proofBytes = fromBase64Url(proof)
    proofBytes[0] = proofBytes[0]! ^ 1
    const flippedProof = toBase64Url(proofBytes)
    expect(await verifyReceiptProof(seed, 'test', flippedProof)).toBe(false)
  })

  it('truncated proof returns false', async () => {
    const seed = generateReceiptSeed()
    const proof = await computeReceiptProof(seed, 'test')
    const truncated = proof.slice(0, proof.length - 5)
    expect(await verifyReceiptProof(seed, 'test', truncated)).toBe(false)
  })

  it('empty proof returns false', async () => {
    const seed = generateReceiptSeed()
    expect(await verifyReceiptProof(seed, 'test', '')).toBe(false)
  })

  it('proof from different note returns false', async () => {
    const seed = generateReceiptSeed()
    const proofA = await computeReceiptProof(seed, 'note A')
    expect(await verifyReceiptProof(seed, 'note B', proofA)).toBe(false)
  })

  it('invalid base64url chars in proof returns false', async () => {
    const seed = generateReceiptSeed()
    // '!!!' is not valid base64url
    expect(await verifyReceiptProof(seed, 'test', '!!!')).toBe(false)
  })

  it('near-miss proof (differ by 1 byte) returns false', async () => {
    const seed = generateReceiptSeed()
    const proof = await computeReceiptProof(seed, 'test')
    const proofBytes = fromBase64Url(proof)
    proofBytes[proofBytes.length - 1] = proofBytes[proofBytes.length - 1]! ^ 0xff
    const nearMiss = toBase64Url(proofBytes)
    expect(await verifyReceiptProof(seed, 'test', nearMiss)).toBe(false)
  })
})

/* ================================================================== */
/*  encodeMetadata / decodeMetadata — happy path                      */
/* ================================================================== */

describe('encodeMetadata / decodeMetadata — happy path', () => {
  it('round-trips BAR only', () => {
    const encoded = encodeMetadata('hello', { barSeconds: 300 })
    const result = decodeMetadata(encoded)
    expect(result.metadata.barSeconds).toBe(300)
    expect(result.metadata.receiptSeed).toBeUndefined()
    expect(result.plaintext).toBe('hello')
  })

  it('round-trips RECEIPT only', () => {
    const seed = generateReceiptSeed()
    const encoded = encodeMetadata('hello', { receiptSeed: seed })
    const result = decodeMetadata(encoded)
    expect(result.metadata.receiptSeed).toBe(seed)
    expect(result.metadata.barSeconds).toBeUndefined()
    expect(result.plaintext).toBe('hello')
  })

  it('round-trips both BAR and RECEIPT', () => {
    const seed = generateReceiptSeed()
    const encoded = encodeMetadata('hello', { barSeconds: 60, receiptSeed: seed })
    const result = decodeMetadata(encoded)
    expect(result.metadata.barSeconds).toBe(60)
    expect(result.metadata.receiptSeed).toBe(seed)
    expect(result.plaintext).toBe('hello')
  })

  it('round-trips with no metadata', () => {
    const encoded = encodeMetadata('hello', {})
    const result = decodeMetadata(encoded)
    expect(result.metadata.barSeconds).toBeUndefined()
    expect(result.metadata.receiptSeed).toBeUndefined()
    expect(result.plaintext).toBe('hello')
  })

  it('plaintext preserved exactly after prefix strip', () => {
    const msg = 'Multi\nline\n  message with special chars: <>&"\'!@#$%^'
    const seed = generateReceiptSeed()
    const encoded = encodeMetadata(msg, { barSeconds: 30, receiptSeed: seed })
    const result = decodeMetadata(encoded)
    expect(result.plaintext).toBe(msg)
  })
})

/* ================================================================== */
/*  Metadata — edge cases                                             */
/* ================================================================== */

describe('metadata — edge cases', () => {
  it('plaintext starting with "BAR:" (no actual metadata)', () => {
    // When decodeMetadata receives raw text starting with BAR:, it will parse it
    const result = decodeMetadata('BAR:300:rest of message')
    // This IS parsed as metadata since it matches the pattern
    expect(result.metadata.barSeconds).toBe(300)
    expect(result.plaintext).toBe('rest of message')
  })

  it('plaintext starting with "RECEIPT:" (no actual metadata)', () => {
    const result = decodeMetadata('RECEIPT:abc123:rest of message')
    // This IS parsed as metadata since it matches the pattern
    expect(result.metadata.receiptSeed).toBe('abc123')
    expect(result.plaintext).toBe('rest of message')
  })

  it('barSeconds = 0 round-trips', () => {
    const encoded = encodeMetadata('msg', { barSeconds: 0 })
    const result = decodeMetadata(encoded)
    expect(result.metadata.barSeconds).toBe(0)
    expect(result.plaintext).toBe('msg')
  })

  it('very large barSeconds round-trips', () => {
    const encoded = encodeMetadata('msg', { barSeconds: 999999999 })
    const result = decodeMetadata(encoded)
    expect(result.metadata.barSeconds).toBe(999999999)
  })

  it('receiptSeed with base64url chars -_ round-trips', () => {
    const seed = 'abc-def_ghi-jkl_mno'
    const encoded = encodeMetadata('msg', { receiptSeed: seed })
    const result = decodeMetadata(encoded)
    expect(result.metadata.receiptSeed).toBe(seed)
  })

  it('empty message with metadata', () => {
    const seed = generateReceiptSeed()
    const encoded = encodeMetadata('', { barSeconds: 60, receiptSeed: seed })
    const result = decodeMetadata(encoded)
    expect(result.metadata.barSeconds).toBe(60)
    expect(result.metadata.receiptSeed).toBe(seed)
    expect(result.plaintext).toBe('')
  })

  it('message with colons after prefix', () => {
    const encoded = encodeMetadata('key:value:data', { barSeconds: 30 })
    const result = decodeMetadata(encoded)
    expect(result.metadata.barSeconds).toBe(30)
    expect(result.plaintext).toBe('key:value:data')
  })
})

/* ================================================================== */
/*  Metadata — malicious                                              */
/* ================================================================== */

describe('metadata — malicious', () => {
  it('XSS in plaintext after metadata prefix is preserved literally', () => {
    const xss = '<script>alert("xss")</script>'
    const encoded = encodeMetadata(xss, { barSeconds: 60 })
    const result = decodeMetadata(encoded)
    expect(result.plaintext).toBe(xss)
  })

  it('colon injection in receiptSeed is rejected by regex', () => {
    // The regex [A-Za-z0-9_-]+ won't match colons
    const result = decodeMetadata('RECEIPT:seed:with:extra:colons:msg')
    // Only "seed" should be captured, "with:extra:colons:msg" is plaintext
    expect(result.metadata.receiptSeed).toBe('seed')
    expect(result.plaintext).toBe('with:extra:colons:msg')
  })

  it('very long receiptSeed (10K chars)', () => {
    const longSeed = 'a'.repeat(10_000)
    const encoded = encodeMetadata('msg', { receiptSeed: longSeed })
    const result = decodeMetadata(encoded)
    expect(result.metadata.receiptSeed).toBe(longSeed)
    expect(result.plaintext).toBe('msg')
  })

  it('negative barSeconds — regex \\d+ won\'t match negative sign', () => {
    // encodeMetadata would write BAR:-1: but decodeMetadata regex is /^BAR:(\d+):/
    const encoded = 'BAR:-1:msg'
    const result = decodeMetadata(encoded)
    // \d+ won't match -1, so no BAR metadata parsed
    expect(result.metadata.barSeconds).toBeUndefined()
    expect(result.plaintext).toBe('BAR:-1:msg')
  })

  it('float barSeconds — regex \\d+ won\'t match dot', () => {
    const encoded = 'BAR:3.14:msg'
    const result = decodeMetadata(encoded)
    // \d+ matches "3" but then expects ":" next, finds "." — no match
    expect(result.metadata.barSeconds).toBeUndefined()
    expect(result.plaintext).toBe('BAR:3.14:msg')
  })
})

/* ================================================================== */
/*  Integration tests                                                 */
/* ================================================================== */

describe('receipt — integration', () => {
  it('createNote with receipt → openNote → computeReceiptProof → verifyReceiptProof', async () => {
    const message = 'secret message for receipt test'
    const seed = generateReceiptSeed()

    const { urlPayload, serverShard } = await createNote(message, { receiptSeed: seed })
    const result = await openNote(urlPayload, serverShard)

    expect(result.plaintext).toBe(message)
    expect(result.metadata.receiptSeed).toBe(seed)

    const proof = await computeReceiptProof(seed, result.plaintext)
    expect(await verifyReceiptProof(seed, message, proof)).toBe(true)
  })

  it('createNote with receipt + BAR → openNote → both metadata fields present', async () => {
    const message = 'combined metadata test'
    const seed = generateReceiptSeed()

    const { urlPayload, serverShard } = await createNote(message, {
      barSeconds: 300,
      receiptSeed: seed,
    })
    const result = await openNote(urlPayload, serverShard)

    expect(result.plaintext).toBe(message)
    expect(result.metadata.barSeconds).toBe(300)
    expect(result.metadata.receiptSeed).toBe(seed)
  })

  it('receipt proof from opened note matches verification', async () => {
    const message = 'verify after open'
    const seed = generateReceiptSeed()

    const { urlPayload, serverShard } = await createNote(message, { receiptSeed: seed })
    const result = await openNote(urlPayload, serverShard)

    // Compute proof using the opened note's plaintext
    const proof = await computeReceiptProof(result.metadata.receiptSeed!, result.plaintext)

    // Verify using original seed and message
    expect(await verifyReceiptProof(seed, message, proof)).toBe(true)
  })

  it('full chain: createNote → protectFragment → unprotectFragment → openNote → verify', async () => {
    const message = 'full chain test'
    const seed = generateReceiptSeed()

    const { urlPayload, serverShard } = await createNote(message, { receiptSeed: seed })
    const check = computeCheck(urlPayload)
    const paddedPayload = padPayload(urlPayload)
    const shardId = 'receipt01'
    const fragment = `${shardId}:${check}:${paddedPayload}`

    // Password protect
    const password = 'receipt-pw'
    const protectedData = await protectFragment(fragment, password)
    const decryptedFragment = await unprotectFragment(protectedData, password)
    expect(decryptedFragment).toBe(fragment)

    // Parse fragment and open note
    const parts = decryptedFragment.split(':')
    const recoveredPayload = parts.slice(2).join(':')
    const result = await openNote(recoveredPayload, serverShard)

    expect(result.plaintext).toBe(message)
    expect(result.metadata.receiptSeed).toBe(seed)

    // Compute and verify proof
    const proof = await computeReceiptProof(seed, result.plaintext)
    expect(await verifyReceiptProof(seed, message, proof)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { createDeferToken, openDeferToken } from '@worker/defer-token'
import type { DeferTokenPayload } from '@worker/defer-token'

// Two distinct 32-byte hex secrets for testing
const SECRET_A = 'a0b1c2d3e4f5061728394a5b6c7d8e9fa0b1c2d3e4f5061728394a5b6c7d8e9f'
const SECRET_B = 'f9e8d7c6b5a49382716050f9e8d7c6b5a49382716050f9e8d7c6b5a493827160'

const SAMPLE_PAYLOAD: DeferTokenPayload = {
  id: 'aabbccdd11223344',
  shard: 'ABCDEFGHIJKLMNOPQRSTU',
  ttl: 86400,
  ts: Date.now(),
}

describe('defer-token', () => {
  it('round-trip: create then open returns same payload', async () => {
    const token = await createDeferToken(SECRET_A, SAMPLE_PAYLOAD)
    const result = await openDeferToken(SECRET_A, token)

    expect(result.id).toBe(SAMPLE_PAYLOAD.id)
    expect(result.shard).toBe(SAMPLE_PAYLOAD.shard)
    expect(result.ttl).toBe(SAMPLE_PAYLOAD.ttl)
    expect(result.ts).toBe(SAMPLE_PAYLOAD.ts)
  })

  it('token is a non-empty base64url string', async () => {
    const token = await createDeferToken(SECRET_A, SAMPLE_PAYLOAD)
    expect(token.length).toBeGreaterThan(0)
    expect(token).toMatch(/^[A-Za-z0-9~-]+$/)
  })

  it('tampered token: flipped byte causes failure', async () => {
    const token = await createDeferToken(SECRET_A, SAMPLE_PAYLOAD)
    // Flip a character in the middle
    const mid = Math.floor(token.length / 2)
    const tampered =
      token.slice(0, mid) +
      (token[mid] === 'A' ? 'B' : 'A') +
      token.slice(mid + 1)

    await expect(openDeferToken(SECRET_A, tampered)).rejects.toThrow()
  })

  it('wrong secret: create with A, open with B throws', async () => {
    const token = await createDeferToken(SECRET_A, SAMPLE_PAYLOAD)
    await expect(openDeferToken(SECRET_B, token)).rejects.toThrow()
  })

  it('truncated token throws', async () => {
    const token = await createDeferToken(SECRET_A, SAMPLE_PAYLOAD)
    const truncated = token.slice(0, 10)
    await expect(openDeferToken(SECRET_A, truncated)).rejects.toThrow()
  })

  it('empty string token throws', async () => {
    await expect(openDeferToken(SECRET_A, '')).rejects.toThrow()
  })

  it('payload field fidelity: all fields survive exactly', async () => {
    const payload: DeferTokenPayload = {
      id: 'ff00ff00ff00ff00',
      shard: 'ZYXWVUTSRQPONMLKJIHGF',
      ttl: 604800,
      ts: 1700000000000,
    }
    const token = await createDeferToken(SECRET_A, payload)
    const result = await openDeferToken(SECRET_A, token)

    expect(result).toEqual(payload)
  })

  it('different payloads produce different tokens', async () => {
    const payload2: DeferTokenPayload = { ...SAMPLE_PAYLOAD, id: '1122334455667788' }
    const token1 = await createDeferToken(SECRET_A, SAMPLE_PAYLOAD)
    const token2 = await createDeferToken(SECRET_A, payload2)
    expect(token1).not.toBe(token2)
  })
})

import { describe, it, expect } from 'vitest'
import { generateDecoyMessage } from '@/crypto/decoy-messages'

describe('generateDecoyMessage', () => {
  it('returns a non-empty string', () => {
    const msg = generateDecoyMessage()
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('produces variety across calls', () => {
    const results = new Set<string>()
    for (let i = 0; i < 20; i++) {
      results.add(generateDecoyMessage())
    }
    // With 80 possible messages, 20 draws should yield at least 2 unique
    expect(results.size).toBeGreaterThan(1)
  })

  it('batch of 100 all return non-empty strings', () => {
    for (let i = 0; i < 100; i++) {
      const msg = generateDecoyMessage()
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
    }
  })

  it('no message exceeds 200 characters', () => {
    for (let i = 0; i < 100; i++) {
      const msg = generateDecoyMessage()
      expect(msg.length).toBeLessThanOrEqual(200)
    }
  })
})

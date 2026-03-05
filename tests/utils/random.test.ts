import { describe, it, expect } from 'vitest'
import { randInt, pick } from '@/utils/random'

describe('randInt', () => {
  it('returns 0 when max=1', () => {
    for (let i = 0; i < 20; i++) {
      expect(randInt(1)).toBe(0)
    }
  })

  it('returns integer values', () => {
    for (let i = 0; i < 50; i++) {
      const val = randInt(100)
      expect(Number.isInteger(val)).toBe(true)
    }
  })

  it('returns values in range [0, max)', () => {
    const max = 10
    for (let i = 0; i < 200; i++) {
      const val = randInt(max)
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(max)
    }
  })

  it('never returns max', () => {
    const max = 5
    for (let i = 0; i < 200; i++) {
      expect(randInt(max)).not.toBe(max)
    }
  })

  it('produces both values for max=2 (distribution sanity)', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 100; i++) {
      seen.add(randInt(2))
    }
    expect(seen.has(0)).toBe(true)
    expect(seen.has(1)).toBe(true)
  })

  it('covers all values for max=10 over many calls', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      seen.add(randInt(10))
    }
    for (let v = 0; v < 10; v++) {
      expect(seen.has(v)).toBe(true)
    }
  })
})

describe('pick', () => {
  it('returns the only element from a single-element pool', () => {
    expect(pick(['only'])).toBe('only')
  })

  it('returns a value from the pool', () => {
    const pool = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) {
      expect(pool).toContain(pick(pool))
    }
  })

  it('covers all elements over many calls', () => {
    const pool = ['x', 'y', 'z']
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      seen.add(pick(pool))
    }
    for (const item of pool) {
      expect(seen.has(item)).toBe(true)
    }
  })

  it('works with number pools', () => {
    const pool = [10, 20, 30]
    for (let i = 0; i < 50; i++) {
      expect(pool).toContain(pick(pool))
    }
  })
})

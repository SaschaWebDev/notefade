import { describe, expect, it } from 'vitest'
import { generateShardId } from '@/api/shard-id'

describe('generateShardId', () => {
  it('returns a 16-character hex string', () => {
    const id = generateShardId()
    expect(id).toMatch(/^[a-f0-9]{16}$/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateShardId()))
    expect(ids.size).toBe(100)
  })
})

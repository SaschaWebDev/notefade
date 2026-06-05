import { describe, expect, it } from 'vitest'
import { splitBytes, sliceByLengths } from '@/crypto/multi-note'
import { VOICE_BYTES_PER_CHUNK, VOICE_MAX_BYTES, MAX_TOTAL_SHARDS } from '@/constants'

function sequentialBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = i % 256
  return bytes
}

describe('splitBytes', () => {
  it('returns a single chunk when input fits', () => {
    const bytes = sequentialBytes(VOICE_BYTES_PER_CHUNK)
    const chunks = splitBytes(bytes, VOICE_BYTES_PER_CHUNK)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual(bytes)
  })

  it('splits one byte over the chunk size into [max, 1]', () => {
    const bytes = sequentialBytes(VOICE_BYTES_PER_CHUNK + 1)
    const chunks = splitBytes(bytes, VOICE_BYTES_PER_CHUNK)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]!.length).toBe(VOICE_BYTES_PER_CHUNK)
    expect(chunks[1]!.length).toBe(1)
  })

  it('splits a full voice budget into exactly MAX_TOTAL_SHARDS chunks', () => {
    const bytes = sequentialBytes(VOICE_MAX_BYTES)
    const chunks = splitBytes(bytes, VOICE_BYTES_PER_CHUNK)
    expect(chunks).toHaveLength(MAX_TOTAL_SHARDS)
    for (const chunk of chunks) {
      expect(chunk.length).toBe(VOICE_BYTES_PER_CHUNK)
    }
  })

  it('round-trips: concatenating chunks reproduces the original bytes', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(VOICE_BYTES_PER_CHUNK * 3 + 137))
    const chunks = splitBytes(bytes, VOICE_BYTES_PER_CHUNK)
    const total = chunks.reduce((sum, c) => sum + c.length, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    expect(merged).toEqual(bytes)
  })

  it('handles empty input', () => {
    const chunks = splitBytes(new Uint8Array(0), VOICE_BYTES_PER_CHUNK)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.length).toBe(0)
  })
})

describe('sliceByLengths', () => {
  it('partitions bytes into the exact given lengths', () => {
    const bytes = sequentialBytes(60)
    const slices = sliceByLengths(bytes, [10, 25, 25])
    expect(slices).toHaveLength(3)
    expect(slices[0]).toEqual(bytes.slice(0, 10))
    expect(slices[1]).toEqual(bytes.slice(10, 35))
    expect(slices[2]).toEqual(bytes.slice(35, 60))
  })

  it('is the inverse of concatenation', () => {
    const parts = [
      crypto.getRandomValues(new Uint8Array(38_400)),
      crypto.getRandomValues(new Uint8Array(25_600)),
      crypto.getRandomValues(new Uint8Array(137)),
    ]
    const lengths = parts.map((p) => p.length)
    const merged = new Uint8Array(lengths.reduce((s, n) => s + n, 0))
    let offset = 0
    for (const p of parts) {
      merged.set(p, offset)
      offset += p.length
    }
    const slices = sliceByLengths(merged, lengths)
    expect(slices).toHaveLength(parts.length)
    for (let i = 0; i < parts.length; i++) {
      expect(slices[i]).toEqual(parts[i])
    }
  })

  it('throws on a sum mismatch (corrupted boundaries)', () => {
    const bytes = sequentialBytes(100)
    expect(() => sliceByLengths(bytes, [50, 49])).toThrow(/mismatch/)
    expect(() => sliceByLengths(bytes, [50, 51])).toThrow(/mismatch/)
  })

  it('handles a single length covering all bytes', () => {
    const bytes = sequentialBytes(42)
    const slices = sliceByLengths(bytes, [42])
    expect(slices).toHaveLength(1)
    expect(slices[0]).toEqual(bytes)
  })

  it('handles empty bytes with empty lengths', () => {
    expect(sliceByLengths(new Uint8Array(0), [])).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  MAX_TOTAL_SHARDS,
  VOICE_BYTES_PER_CHUNK,
  VOICE_BYTE_BACKSTOP_HEADROOM,
  VOICE_MAX_BYTES,
  VOICE_MAX_DURATION_MS,
  VOICE_TARGET_BITRATE,
  IMAGE_BYTES_PER_CHUNK,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_IMAGES,
  IMAGE_TIER1_TARGET_BYTES,
  IMAGE_TIER2_TARGET_BYTES,
  IMAGE_TIER1_MAX_DIMENSION,
  IMAGE_TIER2_MAX_DIMENSION,
} from '@/constants'

describe('voice budget invariants', () => {
  it('locks the 60-second budget parameters', () => {
    expect(VOICE_MAX_DURATION_MS).toBe(60_000)
    expect(VOICE_BYTES_PER_CHUNK).toBe(5120)
    expect(VOICE_MAX_BYTES).toBe(153_600)
    expect(VOICE_MAX_BYTES).toBe(VOICE_BYTES_PER_CHUNK * MAX_TOTAL_SHARDS)
  })

  it('keeps the backstop headroom within a single chunk so the chunk count never exceeds MAX_TOTAL_SHARDS', () => {
    expect(VOICE_BYTE_BACKSTOP_HEADROOM).toBeGreaterThan(0)
    expect(VOICE_BYTE_BACKSTOP_HEADROOM).toBeLessThanOrEqual(VOICE_BYTES_PER_CHUNK)
    const backstopThreshold = VOICE_MAX_BYTES - VOICE_BYTE_BACKSTOP_HEADROOM
    expect(Math.ceil(backstopThreshold / VOICE_BYTES_PER_CHUNK)).toBeLessThanOrEqual(MAX_TOTAL_SHARDS)
  })

  it('gives the byte budget enough capacity for the full duration at the target bitrate', () => {
    // Codec payload at the target bitrate, ignoring container overhead —
    // the headroom and backstop absorb overhead and encoder overshoot.
    const nominalBytes = (VOICE_TARGET_BITRATE / 8) * (VOICE_MAX_DURATION_MS / 1000)
    expect(VOICE_MAX_BYTES - VOICE_BYTE_BACKSTOP_HEADROOM).toBeGreaterThan(nominalBytes)
  })
})

describe('image budget invariants', () => {
  it('locks the multi-image budget parameters', () => {
    expect(IMAGE_BYTES_PER_CHUNK).toBe(5120)
    expect(IMAGE_MAX_BYTES).toBe(153_600)
    expect(IMAGE_MAX_BYTES).toBe(IMAGE_BYTES_PER_CHUNK * MAX_TOTAL_SHARDS)
    expect(IMAGE_MAX_IMAGES).toBe(6)
  })

  it('tier targets exactly partition the budget at their max counts', () => {
    expect(IMAGE_TIER1_TARGET_BYTES * 4).toBe(IMAGE_MAX_BYTES)
    expect(IMAGE_TIER2_TARGET_BYTES * 6).toBe(IMAGE_MAX_BYTES)
    expect(IMAGE_TIER2_MAX_DIMENSION).toBeLessThan(IMAGE_TIER1_MAX_DIMENSION)
  })

  it('every gallery size fits the budget when compressed at its applicable tier', () => {
    for (let count = 1; count <= IMAGE_MAX_IMAGES; count++) {
      const target = count <= 4 ? IMAGE_TIER1_TARGET_BYTES : IMAGE_TIER2_TARGET_BYTES
      expect(target * count).toBeLessThanOrEqual(IMAGE_MAX_BYTES)
    }
  })
})

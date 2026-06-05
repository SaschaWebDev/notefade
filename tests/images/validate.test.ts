import { describe, expect, it } from 'vitest'
import { checkSourceImage, checkFileSize } from '@/images/validate'
import {
  IMAGE_MAX_FILE_BYTES,
  IMAGE_MAX_SOURCE_PIXELS,
  IMAGE_MAX_SOURCE_LONGEST_SIDE,
  IMAGE_MAX_ASPECT_RATIO,
} from '@/constants'

describe('checkFileSize', () => {
  it('accepts a file at the limit', () => {
    expect(checkFileSize(new Blob([new Uint8Array(8)]))).toEqual({ ok: true })
  })

  it('rejects a file over the limit', () => {
    const fake = { size: IMAGE_MAX_FILE_BYTES + 1 } as Blob
    const result = checkFileSize(fake)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('too large')
  })
})

describe('checkSourceImage', () => {
  const okBase = { fileBytes: 4 * 1024 * 1024 }

  it('accepts a typical phone photo (12 MP)', () => {
    expect(checkSourceImage({ ...okBase, width: 4032, height: 3024 })).toEqual({ ok: true })
  })

  it('accepts a 48 MP phone photo', () => {
    expect(checkSourceImage({ ...okBase, width: 8064, height: 6048 })).toEqual({ ok: true })
  })

  it('accepts a panorama within the aspect limit', () => {
    expect(checkSourceImage({ ...okBase, width: 11800, height: 2400 })).toEqual({ ok: true })
  })

  it('rejects an oversized file', () => {
    const result = checkSourceImage({ width: 100, height: 100, fileBytes: IMAGE_MAX_FILE_BYTES + 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('too large')
  })

  it('rejects non-positive dimensions', () => {
    const result = checkSourceImage({ ...okBase, width: 0, height: 100 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('dimensions')
  })

  it('rejects a side over the longest-side limit', () => {
    const result = checkSourceImage({
      ...okBase,
      width: IMAGE_MAX_SOURCE_LONGEST_SIDE + 1,
      height: 4000,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('longest side')
  })

  it('rejects too many total pixels even when each side is allowed', () => {
    // 11,000 × 11,000 = 121 MP > 50 MP, but both sides are under 12,000.
    const result = checkSourceImage({ ...okBase, width: 11_000, height: 11_000 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('pixels')
  })

  it('rejects a page-length screenshot via side and aspect limits', () => {
    // 1200×30000 — the classic scrollable-forum-page screenshot.
    const tall = checkSourceImage({ ...okBase, width: 1200, height: 30_000 })
    expect(tall.ok).toBe(false)

    // Same shape but within the side cap — still rejected by aspect ratio.
    const ratio = checkSourceImage({ ...okBase, width: 1200, height: 11_000 })
    expect(ratio.ok).toBe(false)
    if (!ratio.ok) expect(ratio.reason).toContain(`${IMAGE_MAX_ASPECT_RATIO}:1`)
  })

  it('boundary: exactly at the pixel limit passes', () => {
    // 10,000 × 5,000 = 50 MP exactly, aspect 2:1, sides ≤ 12,000.
    expect(IMAGE_MAX_SOURCE_PIXELS).toBe(50_000_000)
    expect(checkSourceImage({ ...okBase, width: 10_000, height: 5_000 })).toEqual({ ok: true })
  })
})

import { describe, expect, it } from 'vitest'
import {
  encodeMetadata,
  decodeMetadata,
  encodeMetadataBytes,
  decodeMetadataBytes,
} from '@/crypto/crypto'

describe('image metadata (I: / IB: tokens)', () => {
  it('round-trips imageMime without boundaries (single image, legacy format)', () => {
    const encoded = encodeMetadata('payload', { imageMime: 'a' })
    expect(encoded).toBe('I:a:payload')
    const { metadata, plaintext } = decodeMetadata(encoded)
    expect(metadata.imageMime).toBe('a')
    expect(metadata.imageBoundaries).toBeUndefined()
    expect(plaintext).toBe('payload')
  })

  it('round-trips imageBoundaries with multiple lengths', () => {
    const boundaries = [38400, 38211, 40123, 25600, 19999, 1]
    const encoded = encodeMetadata('x', { imageMime: 'a', imageBoundaries: boundaries })
    const { metadata, plaintext } = decodeMetadata(encoded)
    expect(metadata.imageMime).toBe('a')
    expect(metadata.imageBoundaries).toEqual(boundaries)
    expect(plaintext).toBe('x')
  })

  it('emits tokens in positional order: BAR before I before IB', () => {
    const encoded = encodeMetadata('rest', {
      barSeconds: 30,
      imageMime: 'a',
      imageBoundaries: [10, 20],
    })
    expect(encoded).toBe('BAR:30:I:a:IB:10,20:rest')
    const { metadata, plaintext } = decodeMetadata(encoded)
    expect(metadata.barSeconds).toBe(30)
    expect(metadata.imageMime).toBe('a')
    expect(metadata.imageBoundaries).toEqual([10, 20])
    expect(plaintext).toBe('rest')
  })

  it('parses legacy image notes without an IB token', () => {
    const { metadata, plaintext } = decodeMetadata('I:a:binarystuff')
    expect(metadata.imageMime).toBe('a')
    expect(metadata.imageBoundaries).toBeUndefined()
    expect(plaintext).toBe('binarystuff')
  })

  it('does not parse a malformed IB token (left as content)', () => {
    const { metadata, plaintext } = decodeMetadata('I:a:IB:1,,2:rest')
    expect(metadata.imageMime).toBe('a')
    expect(metadata.imageBoundaries).toBeUndefined()
    expect(plaintext).toBe('IB:1,,2:rest')
  })

  it('round-trips through the byte encoding with binary content', () => {
    const content = new Uint8Array([0, 255, 73, 66, 58, 1, 2, 3]) // includes "IB:" bytes
    const bytes = encodeMetadataBytes(
      { imageMime: 'a', imageBoundaries: [3, 5], barSeconds: 60 },
      content,
    )
    const { metadata, content: decoded } = decodeMetadataBytes(bytes)
    expect(metadata.barSeconds).toBe(60)
    expect(metadata.imageMime).toBe('a')
    expect(metadata.imageBoundaries).toEqual([3, 5])
    expect(decoded).toEqual(content)
  })

  it('keeps a 6-image boundary list well within the 256-byte metadata scan window', () => {
    const boundaries = [38400, 38400, 38400, 38400, 25600, 25600]
    const prefix = encodeMetadata('', { imageMime: 'a', imageBoundaries: boundaries })
    expect(prefix.length).toBeLessThan(256)
  })
})

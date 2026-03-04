import { describe, expect, it } from 'vitest'
import {
  encodeZeroWidth,
  decodeZeroWidth,
  hasZeroWidthData,
  encodeImageStego,
  decodeImageStego,
  generateStegoFilename,
} from './stego'

/* ------------------------------------------------------------------ */
/*  ImageData helper — happy-dom may not provide it                   */
/* ------------------------------------------------------------------ */

function makeImageData(w: number, h: number, fill = 128): ImageData {
  const data = new Uint8ClampedArray(w * h * 4).fill(fill)
  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData
}

/* ================================================================== */
/*  Zero-width encode / decode                                        */
/* ================================================================== */

describe('encodeZeroWidth / decodeZeroWidth — happy path', () => {
  it('round-trips a simple URL', () => {
    const url = 'https://example.com'
    const encoded = encodeZeroWidth(url, 'Hello world')
    const decoded = decodeZeroWidth(encoded)
    expect(decoded).toBe(url)
  })

  it('round-trips a notefade URL with fragment', () => {
    const url = 'https://notefade.com/#abc123:ABCDEFG_payload-data'
    const encoded = encodeZeroWidth(url, 'Check this out')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('round-trips a URL with special chars', () => {
    const url = 'https://example.com/path?q=hello%20world&x=1#frag'
    const encoded = encodeZeroWidth(url, 'Some text here')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('round-trips a Unicode URL', () => {
    const url = 'https://example.com/\u4F60\u597D'
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('preserves visible cover text', () => {
    const cover = 'Hey check this photo!'
    const encoded = encodeZeroWidth('https://x.com', cover)
    // Strip zero-width chars to get visible text
    const visible = encoded.replace(/[\u200B\u200C\u200D]/g, '')
    expect(visible).toBe(cover)
  })

  it('hidden data is invisible to naive length check', () => {
    const cover = 'Short.'
    const encoded = encodeZeroWidth('https://notefade.com/#test', cover)
    // The visible portion is the same length as cover
    const visible = encoded.replace(/[\u200B\u200C\u200D]/g, '')
    expect(visible).toBe(cover)
  })
})

describe('encodeZeroWidth — edge cases', () => {
  it('throws on empty cover text', () => {
    expect(() => encodeZeroWidth('url', '')).toThrow('Cover text must be at least 2 characters')
  })

  it('throws on single-char cover text', () => {
    expect(() => encodeZeroWidth('url', 'x')).toThrow('Cover text must be at least 2 characters')
  })

  it('works with exactly 2-char cover text', () => {
    const encoded = encodeZeroWidth('test', 'ab')
    expect(decodeZeroWidth(encoded)).toBe('test')
  })

  it('empty URL string encodes no data, decode returns null', () => {
    // Empty string → TextEncoder produces 0 bytes → no zero-width chars emitted
    const encoded = encodeZeroWidth('', 'Cover text here')
    const decoded = decodeZeroWidth(encoded)
    expect(decoded).toBeNull()
  })

  it('round-trips very long URL (4000 chars)', () => {
    const url = 'https://example.com/' + 'a'.repeat(3980)
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('round-trips all printable ASCII in URL', () => {
    let url = ''
    for (let i = 32; i < 127; i++) url += String.fromCharCode(i)
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('round-trips multi-byte Unicode URL (CJK, emoji)', () => {
    const url = 'https://\u4F60\u597D.\u4E16\u754C/\uD83D\uDD12'
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('works with emoji cover text (multi-code-point)', () => {
    const cover = '\uD83D\uDE00\uD83D\uDE01\uD83D\uDE02\uD83D\uDE03'
    const url = 'https://test.com'
    const encoded = encodeZeroWidth(url, cover)
    expect(decodeZeroWidth(encoded)).toBe(url)
    const visible = encoded.replace(/[\u200B\u200C\u200D]/g, '')
    expect(visible).toBe(cover)
  })

  it('cover text with existing zero-width chars may corrupt decode', () => {
    // Existing zero-width chars in cover text interfere with decoding
    // because the decoder cannot distinguish payload bits from cover bits
    const cover = 'He\u200Bllo wo\u200Crld'
    const url = 'https://test.com'
    const encoded = encodeZeroWidth(url, cover)
    const decoded = decodeZeroWidth(encoded)
    // The extra ZW chars from cover text corrupt the payload
    expect(decoded).not.toBe(url)
  })
})

describe('encodeZeroWidth — malicious input', () => {
  it('XSS payload as URL round-trips literally', () => {
    const url = '<script>alert("xss")</script>'
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('SQL injection string as URL round-trips literally', () => {
    const url = "'; DROP TABLE shards; --"
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('null bytes in URL', () => {
    const url = 'https://test.com/\0\0\0'
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('control characters (0x01-0x1F) in URL', () => {
    let url = ''
    for (let i = 1; i <= 0x1f; i++) url += String.fromCharCode(i)
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })

  it('prototype pollution strings as cover text do not crash', () => {
    const covers = ['__proto__', 'constructor', 'toString', '__defineGetter__']
    for (const cover of covers) {
      const encoded = encodeZeroWidth('url', cover.length >= 2 ? cover : cover + 'x')
      expect(decodeZeroWidth(encoded)).toBe('url')
    }
  })

  it('lone surrogates — TextEncoder replaces with U+FFFD', () => {
    const url = '\uD800test\uDBFF'
    const encoded = encodeZeroWidth(url, 'Cover text')
    const decoded = decodeZeroWidth(encoded)
    // TextEncoder replaces lone surrogates with U+FFFD
    expect(decoded).toBe('\uFFFDtest\uFFFD')
  })

  it('enormous URL (100KB) does not crash', () => {
    const url = 'x'.repeat(100_000)
    const encoded = encodeZeroWidth(url, 'Cover text')
    expect(decodeZeroWidth(encoded)).toBe(url)
  })
})

describe('decodeZeroWidth — breaking scenarios', () => {
  it('returns null for plain text with no zero-width chars', () => {
    expect(decodeZeroWidth('Hello world, no hidden data')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(decodeZeroWidth('')).toBeNull()
  })

  it('corrupted random zero-width chars do not crash', () => {
    const garbage = 'a\u200B\u200C\u200B\u200D\u200C\u200Bb'
    const result = decodeZeroWidth(garbage)
    // Should not throw; may return null or garbage string
    expect(result === null || typeof result === 'string').toBe(true)
  })

  it('partial byte groups (7 bits) are skipped', () => {
    // 7 zero-width chars = incomplete byte, should be skipped
    const partial = 'a' + '\u200B'.repeat(7) + 'b'
    const result = decodeZeroWidth(partial)
    // No complete byte groups, should return null
    expect(result).toBeNull()
  })

  it('only separators returns null', () => {
    const text = '\u200D'.repeat(10)
    expect(decodeZeroWidth(text)).toBeNull()
  })

  it('only zeros (8 zero-width spaces) produces null byte string', () => {
    // 8 ZERO chars = one byte of value 0x00
    const text = 'a' + '\u200B'.repeat(8) + 'b'
    const result = decodeZeroWidth(text)
    expect(result).toBe('\0')
  })
})

describe('hasZeroWidthData', () => {
  it('returns true for text with U+200B', () => {
    expect(hasZeroWidthData('hello\u200Bworld')).toBe(true)
  })

  it('returns true for text with U+200C', () => {
    expect(hasZeroWidthData('hello\u200Cworld')).toBe(true)
  })

  it('returns true for text with U+200D', () => {
    expect(hasZeroWidthData('hello\u200Dworld')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(hasZeroWidthData('Hello world!')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(hasZeroWidthData('')).toBe(false)
  })
})

/* ================================================================== */
/*  Image LSB steganography                                           */
/* ================================================================== */

describe('encodeImageStego / decodeImageStego — happy path', () => {
  it('round-trips a URL in 512x512 image', () => {
    const img = makeImageData(512, 512)
    const url = 'https://notefade.com/#abc123:payload'
    encodeImageStego(img, url)
    expect(decodeImageStego(img)).toBe(url)
  })

  it('round-trips a notefade URL with fragment', () => {
    const img = makeImageData(256, 256)
    const url = 'https://notefade.com/#shard1~shard2:ABCD:longBase64UrlPayloadData_here-123'
    encodeImageStego(img, url)
    expect(decodeImageStego(img)).toBe(url)
  })

  it('mutates imageData in place', () => {
    const img = makeImageData(64, 64, 200)
    const before = new Uint8ClampedArray(img.data)
    encodeImageStego(img, 'test')
    // At least some bytes should differ
    let differs = false
    for (let i = 0; i < img.data.length; i++) {
      if (img.data[i] !== before[i]) { differs = true; break }
    }
    expect(differs).toBe(true)
  })

  it('only modifies LSBs', () => {
    const img = makeImageData(64, 64, 200)
    const before = new Uint8ClampedArray(img.data)
    encodeImageStego(img, 'test')
    for (let i = 0; i < img.data.length; i++) {
      // Each byte should differ by at most 1 (LSB change only)
      expect(Math.abs(img.data[i]! - before[i]!)).toBeLessThanOrEqual(1)
    }
  })

  it('alpha channel is untouched', () => {
    const img = makeImageData(64, 64, 200)
    // Set alpha to specific values
    for (let i = 3; i < img.data.length; i += 4) {
      img.data[i] = 255
    }
    const alphasBefore = []
    for (let i = 3; i < img.data.length; i += 4) alphasBefore.push(img.data[i])
    encodeImageStego(img, 'https://notefade.com/#test')
    for (let i = 3; i < img.data.length; i += 4) {
      expect(img.data[i]).toBe(alphasBefore[i / 4 | 0])
    }
  })
})

describe('encodeImageStego — edge cases', () => {
  it('throws when image is too small (1x1 pixel)', () => {
    const img = makeImageData(1, 1)
    expect(() => encodeImageStego(img, 'https://example.com')).toThrow('Image too small')
  })

  it('works at exact capacity boundary', () => {
    // 10x10 = 100 pixels = 300 usable bits = 37 bytes = 4 (header) + 33 payload
    // 33 bytes = 33 ASCII chars
    const img = makeImageData(10, 10)
    const url = 'a'.repeat(33)
    encodeImageStego(img, url)
    expect(decodeImageStego(img)).toBe(url)
  })

  it('throws when payload exceeds capacity by 1 byte', () => {
    const img = makeImageData(10, 10)
    const url = 'a'.repeat(34) // 34 + 4 header = 38 bytes = 304 bits > 300 available
    expect(() => encodeImageStego(img, url)).toThrow('Image too small')
  })

  it('minimal 2x2 image with 1-char URL', () => {
    // 2x2 = 4 pixels = 12 usable bits = 1.5 bytes → too small for 4+1 = 5 bytes
    // Actually 12 bits < 40 bits needed, so should throw
    const img = makeImageData(2, 2)
    expect(() => encodeImageStego(img, 'x')).toThrow('Image too small')
  })

  it('multi-byte UTF-8 URL', () => {
    const img = makeImageData(64, 64)
    const url = 'https://\u4F60\u597D.\u4E16\u754C'
    encodeImageStego(img, url)
    expect(decodeImageStego(img)).toBe(url)
  })

  it('URLs at length boundary 255 chars', () => {
    const img = makeImageData(128, 128)
    const url = 'a'.repeat(255)
    encodeImageStego(img, url)
    expect(decodeImageStego(img)).toBe(url)
  })

  it('URLs at length boundary 256 chars', () => {
    const img = makeImageData(128, 128)
    const url = 'a'.repeat(256)
    encodeImageStego(img, url)
    expect(decodeImageStego(img)).toBe(url)
  })
})

describe('decodeImageStego — malicious / breaking', () => {
  it('returns null for random image (no valid header)', () => {
    const img = makeImageData(64, 64)
    // Fill with truly random values
    for (let i = 0; i < img.data.length; i++) {
      img.data[i] = Math.floor(Math.random() * 256)
    }
    const result = decodeImageStego(img)
    // Random data unlikely to produce a valid length header within capacity
    expect(result === null || typeof result === 'string').toBe(true)
  })

  it('all-zero pixels (length=0) returns null', () => {
    const img = makeImageData(64, 64, 0)
    expect(decodeImageStego(img)).toBeNull()
  })

  it('all-255 pixels (huge length) returns null', () => {
    const img = makeImageData(64, 64, 255)
    // LSBs are all 1, length header = 0xFFFFFFFF = ~4 billion → exceeds capacity → null
    expect(decodeImageStego(img)).toBeNull()
  })

  it('corrupted length header returns null or wrong data', () => {
    const img = makeImageData(32, 32)
    encodeImageStego(img, 'test')
    // LSB encoding only uses the least significant bit, so we must flip LSBs
    // to actually corrupt the length header. Flip LSBs of first 11 pixels
    // (32 length-header bits use first ~11 pixel channels)
    for (let i = 0; i < 44; i++) {
      if (i % 4 !== 3) { // skip alpha
        img.data[i] = img.data[i]! ^ 1 // flip LSB
      }
    }
    const result = decodeImageStego(img)
    // Length is now corrupted — either null or garbage
    expect(result).not.toBe('test')
  })

  it('XSS payload as URL round-trips literally', () => {
    const img = makeImageData(128, 128)
    const url = '<script>alert("xss")</script>'
    encodeImageStego(img, url)
    expect(decodeImageStego(img)).toBe(url)
  })

  it('tampered pixels after encoding produce garbage or null', () => {
    const img = makeImageData(64, 64)
    encodeImageStego(img, 'https://notefade.com/#test')
    // Tamper with pixels in the payload area (not length header)
    for (let i = 50; i < 100; i++) {
      img.data[i] = img.data[i]! ^ 0xff
    }
    const result = decodeImageStego(img)
    // Should not be the original URL
    expect(result).not.toBe('https://notefade.com/#test')
  })

  it('zeroed RGB after encoding produces garbage or null', () => {
    const img = makeImageData(64, 64)
    encodeImageStego(img, 'https://test.com')
    // Zero out all RGB channels
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 0
      img.data[i + 1] = 0
      img.data[i + 2] = 0
    }
    // Length header is now 0 → null
    expect(decodeImageStego(img)).toBeNull()
  })
})

/* ================================================================== */
/*  generateStegoFilename                                             */
/* ================================================================== */

describe('generateStegoFilename', () => {
  it('always ends with .png', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateStegoFilename()).toMatch(/\.png$/)
    }
  })

  it('contains no path traversal characters', () => {
    for (let i = 0; i < 50; i++) {
      const name = generateStegoFilename()
      expect(name).not.toContain('..')
      expect(name).not.toContain('\\')
      // Forward slashes should not appear in the filename portion
      expect(name.replace('.png', '')).not.toContain('/')
    }
  })

  it('reasonable length (< 100 chars)', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateStegoFilename().length).toBeLessThan(100)
    }
  })

  it('does not contain "notefade"', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateStegoFilename().toLowerCase()).not.toContain('notefade')
    }
  })

  it('produces different names on subsequent calls', () => {
    // Not strictly guaranteed but overwhelmingly likely
    // Run 10 pairs to make the test robust
    let allSame = true
    for (let i = 0; i < 10; i++) {
      if (generateStegoFilename() !== generateStegoFilename()) {
        allSame = false
        break
      }
    }
    expect(allSame).toBe(false)
  })

  it('batch: 100 filenames all valid', () => {
    const names = Array.from({ length: 100 }, () => generateStegoFilename())
    for (const name of names) {
      expect(name).toMatch(/\.png$/)
      expect(name.length).toBeGreaterThan(4) // at least "x.png"
      expect(name.length).toBeLessThan(100)
    }
  })

  it('only filename-safe characters', () => {
    for (let i = 0; i < 50; i++) {
      const name = generateStegoFilename()
      // Allow alphanumeric, underscore, hyphen, dot, space, parens
      expect(name).toMatch(/^[A-Za-z0-9_\-. ()]+$/)
    }
  })
})

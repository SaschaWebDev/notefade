/* ------------------------------------------------------------------ */
/*  Randomized stego filename generation                               */
/* ------------------------------------------------------------------ */

const ADJECTIVES = [
  'cool', 'warm', 'bright', 'dark', 'soft', 'bold', 'calm', 'deep',
  'vivid', 'muted', 'golden', 'silver', 'hazy', 'dreamy', 'rustic',
  'moody', 'pastel', 'neon', 'faded', 'crisp', 'smooth', 'raw',
  'gentle', 'fierce', 'tiny', 'epic', 'cozy', 'wild', 'quiet', 'loud',
  'dusty', 'fresh', 'frozen', 'misty', 'sunny', 'cloudy', 'stormy',
  'cosmic', 'vintage', 'modern', 'subtle', 'abstract', 'colorful',
]

const NOUNS = [
  'sunset', 'mountain', 'ocean', 'forest', 'river', 'sky', 'lake',
  'meadow', 'valley', 'desert', 'garden', 'waves', 'clouds', 'stars',
  'moon', 'sunrise', 'island', 'canyon', 'reef', 'glacier', 'aurora',
  'bloom', 'petals', 'stone', 'sand', 'rain', 'snow', 'fog', 'dusk',
  'dawn', 'field', 'cliff', 'coast', 'trail', 'bridge', 'tower',
  'cabin', 'lighthouse', 'harbor', 'waterfall', 'painting', 'sketch',
  'canvas', 'portrait', 'landscape',
]

const VERBS = [
  'look', 'check', 'see', 'peep', 'found', 'saved', 'got',
  'grabbed', 'snapped', 'captured', 'spotted', 'liked', 'loved',
]

const NAMES = [
  'alex', 'sam', 'jordan', 'casey', 'riley', 'morgan', 'taylor',
  'jamie', 'quinn', 'avery', 'drew', 'blake', 'skyler', 'sage',
  'cameron', 'harper', 'logan', 'parker', 'reese', 'finley',
]

const SUFFIXES = [
  'final', 'edit', 'v2', 'v3', 'draft', 'fixed', 'crop', 'hd',
  'hq', 'web', 'small', 'large', 'thumb', 'orig', 'raw', 'comp',
]

const GENERIC = [
  'download', 'image', 'untitled', 'newfile', 'photo', 'pic',
  'file', 'export', 'output', 'render', 'capture', 'scan',
]

const PERSONAL = [
  'wallpaper', 'moodboard', 'inspo', 'reference', 'collage',
  'postcard', 'poster', 'cover', 'banner', 'avatar', 'pfp',
  'background', 'lockscreen', 'screensaver', 'thumbnail',
]

/** Cryptographically random integer in [0, max) */
function randInt(max: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0]! % max
}

function pick<T>(pool: readonly T[]): T {
  return pool[randInt(pool.length)]!
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

/**
 * Generate a random, natural-looking filename for stego image downloads.
 * Uses crypto.getRandomValues for randomness. Every call produces a
 * different filename that looks like something a casual user would save.
 */
export function generateStegoFilename(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = pad2(now.getMonth() + 1)
  const d = pad2(now.getDate())
  const hh = pad2(now.getHours())
  const mm = pad2(now.getMinutes())
  const ss = pad2(now.getSeconds())
  const seq = String(100 + randInt(900))

  const patterns: Array<() => string> = [
    // Camera roll: IMG_20260302_184712
    () => `IMG_${y}${m}${d}_${hh}${mm}${ss}.png`,
    // Camera roll variant: photo_2026-03-02_18-47
    () => `photo_${y}-${m}-${d}_${hh}-${mm}.png`,
    // Screenshot: Screenshot_2026-03-02-184712
    () => `Screenshot_${y}-${m}-${d}-${hh}${mm}${ss}.png`,
    // Screenshot macOS style: Screen Shot 2026-03-02 at 6.47.12 PM
    () => {
      const h12 = now.getHours() % 12 || 12
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
      return `Screen Shot ${y}-${m}-${d} at ${h12}.${mm}.${ss} ${ampm}.png`
    },
    // Casual share: lookAtThis_sunset
    () => `${pick(VERBS)}This_${pick(NOUNS)}.png`,
    // Casual share variant: check_this_mountain
    () => `${pick(VERBS)}_this_${pick(NOUNS)}.png`,
    // Art/creative: abstract_waves_v3
    () => `${pick(ADJECTIVES)}_${pick(NOUNS)}_${pick(SUFFIXES)}.png`,
    // Art kebab: colorful-mountains-final
    () => `${pick(ADJECTIVES)}-${pick(NOUNS)}-${pick(SUFFIXES)}.png`,
    // Generic download: download (3)
    () => `${pick(GENERIC)} (${1 + randInt(12)}).png`,
    // Generic with number: image_042
    () => `${pick(GENERIC)}_${seq}.png`,
    // Social/personal: wallpaper_cool
    () => `${pick(PERSONAL)}_${pick(ADJECTIVES)}.png`,
    // Personal with number: moodboard_17
    () => `${pick(PERSONAL)}_${1 + randInt(50)}.png`,
    // Camera numbered: DSC_04821
    () => `DSC_${String(1000 + randInt(9000))}.png`,
    // Phone camera: PXL_20260302_184712345
    () => `PXL_${y}${m}${d}_${hh}${mm}${ss}${seq}.png`,
    // Shared by person: from_alex_sunset
    () => `from_${pick(NAMES)}_${pick(NOUNS)}.png`,
    // Just a name + noun: alex_painting
    () => `${pick(NAMES)}_${pick(NOUNS)}.png`,
  ]

  return pick(patterns)()
}

/**
 * Steganographic sharing: hide URLs inside innocent-looking text
 * using zero-width Unicode characters.
 *
 * U+200B (zero-width space) = 0
 * U+200C (zero-width non-joiner) = 1
 * U+200D (zero-width joiner) = separator between chars
 *
 * This hides the link from casual human observation, not from
 * technical inspection. Any text analysis tool can detect
 * zero-width characters.
 */

const ZERO = '\u200B'
const ONE = '\u200C'
const SEP = '\u200D'

/** Encode a URL as zero-width characters interleaved in cover text */
export function encodeZeroWidth(url: string, coverText: string): string {
  if (!coverText || coverText.length < 2) {
    throw new Error('Cover text must be at least 2 characters')
  }

  // Convert URL to binary representation
  const encoded = new TextEncoder().encode(url)
  const binaryChars: string[] = []

  for (let i = 0; i < encoded.length; i++) {
    const byte = encoded[i]!
    // Each byte as 8 zero-width chars
    for (let bit = 7; bit >= 0; bit--) {
      binaryChars.push((byte >> bit) & 1 ? ONE : ZERO)
    }
    // Separator between bytes (except last)
    if (i < encoded.length - 1) {
      binaryChars.push(SEP)
    }
  }

  const hidden = binaryChars.join('')

  // Spread visible characters of cover text, insert hidden payload after first char
  const chars = [...coverText]
  if (chars.length < 2) {
    return chars[0] + hidden
  }

  // Insert the hidden data between the first and second visible character
  return chars[0] + hidden + chars.slice(1).join('')
}

/** Extract a URL from zero-width characters hidden in text */
export function decodeZeroWidth(text: string): string | null {
  // Extract only zero-width characters
  const zeroWidthChars: string[] = []
  for (const char of text) {
    if (char === ZERO || char === ONE || char === SEP) {
      zeroWidthChars.push(char)
    }
  }

  if (zeroWidthChars.length === 0) {
    return null
  }

  // Split by separator to get byte groups
  const byteGroups = zeroWidthChars.join('').split(SEP)
  const bytes: number[] = []

  for (const group of byteGroups) {
    if (group.length !== 8) continue // Each byte should be 8 bits

    let byte = 0
    for (let i = 0; i < 8; i++) {
      if (group[i] === ONE) {
        byte |= 1 << (7 - i)
      }
    }
    bytes.push(byte)
  }

  if (bytes.length === 0) {
    return null
  }

  try {
    return new TextDecoder().decode(new Uint8Array(bytes))
  } catch {
    return null
  }
}

/** Check if text contains zero-width encoded data */
export function hasZeroWidthData(text: string): boolean {
  for (const char of text) {
    if (char === ZERO || char === ONE || char === SEP) {
      return true
    }
  }
  return false
}

/* ------------------------------------------------------------------ */
/*  Image steganography — LSB encoding in pixel RGB channels          */
/* ------------------------------------------------------------------ */

/**
 * Encode a URL string into the least-significant bits of an ImageData's
 * R, G, B channels (alpha is left untouched).
 *
 * Layout: 4-byte big-endian length header, then UTF-8 payload bytes.
 * Each bit is written to the LSB of successive R/G/B values, skipping
 * every 4th byte (the alpha channel).
 *
 * Mutates `imageData` in place.
 */
export function encodeImageStego(imageData: ImageData, url: string): void {
  const payload = new TextEncoder().encode(url)
  const length = payload.length

  // 4-byte big-endian length prefix + payload
  const totalBytes = 4 + length
  const totalBits = totalBytes * 8

  // Each pixel provides 3 usable channels (R, G, B)
  const usableBits = imageData.width * imageData.height * 3
  if (totalBits > usableBits) {
    throw new Error(
      `Image too small: need ${totalBits} bits but only ${usableBits} available`,
    )
  }

  const data = imageData.data

  // Build the full byte sequence: [length(4)] [payload(N)]
  const message = new Uint8Array(totalBytes)
  message[0] = (length >>> 24) & 0xff
  message[1] = (length >>> 16) & 0xff
  message[2] = (length >>> 8) & 0xff
  message[3] = length & 0xff
  message.set(payload, 4)

  let bitIndex = 0

  for (let byteIdx = 0; byteIdx < totalBytes; byteIdx++) {
    const byte = message[byteIdx]!
    for (let bit = 7; bit >= 0; bit--) {
      const bitVal = (byte >> bit) & 1

      // Map bitIndex to a pixel channel index, skipping alpha (every 4th)
      const pixelIdx = Math.floor(bitIndex / 3)
      const channelOffset = bitIndex % 3 // 0=R, 1=G, 2=B
      const dataIdx = pixelIdx * 4 + channelOffset

      // Clear LSB then set it
      data[dataIdx] = (data[dataIdx]! & 0xfe) | bitVal

      bitIndex++
    }
  }
}

/**
 * Decode a URL string from the LSB of an ImageData's RGB channels.
 * Returns the decoded string, or null if no valid data is found.
 */
export function decodeImageStego(imageData: ImageData): string | null {
  const data = imageData.data
  const maxBits = imageData.width * imageData.height * 3

  // We need at least 32 bits for the length header
  if (maxBits < 32) return null

  function readBit(bitIndex: number): number {
    const pixelIdx = Math.floor(bitIndex / 3)
    const channelOffset = bitIndex % 3
    const dataIdx = pixelIdx * 4 + channelOffset
    return data[dataIdx]! & 1
  }

  // Read 4-byte big-endian length
  let length = 0
  for (let i = 0; i < 32; i++) {
    length = (length << 1) | readBit(i)
  }

  // Sanity check: length must be positive and fit within available bits
  if (length <= 0 || length > 10_000_000) return null
  const requiredBits = (4 + length) * 8
  if (requiredBits > maxBits) return null

  // Read payload bytes
  const payload = new Uint8Array(length)
  let bitIndex = 32 // start after length header

  for (let byteIdx = 0; byteIdx < length; byteIdx++) {
    let byte = 0
    for (let bit = 7; bit >= 0; bit--) {
      byte = (byte << 1) | readBit(bitIndex)
      bitIndex++
    }
    payload[byteIdx] = byte
  }

  try {
    return new TextDecoder().decode(payload)
  } catch {
    return null
  }
}

/**
 * Generate a random abstract art PNG with a URL hidden via LSB steganography.
 * Returns a Blob of the resulting PNG image.
 */
export async function generateStegoImage(
  url: string,
  width = 512,
  height = 512,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot create canvas 2d context')

  // --- Generate random abstract art ---

  // Random color helper
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min
  const randColor = (alpha = 1) =>
    `rgba(${randInt(0, 255)},${randInt(0, 255)},${randInt(0, 255)},${alpha})`

  // Background gradient
  const gradientType = Math.random() > 0.5 ? 'linear' : 'radial'
  let gradient: CanvasGradient
  if (gradientType === 'linear') {
    const angle = Math.random() * Math.PI * 2
    const cx = width / 2
    const cy = height / 2
    const len = Math.max(width, height)
    gradient = ctx.createLinearGradient(
      cx + Math.cos(angle) * len,
      cy + Math.sin(angle) * len,
      cx - Math.cos(angle) * len,
      cy - Math.sin(angle) * len,
    )
  } else {
    gradient = ctx.createRadialGradient(
      width * Math.random(),
      height * Math.random(),
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7,
    )
  }

  const stops = randInt(2, 3)
  for (let i = 0; i < stops; i++) {
    gradient.addColorStop(i / (stops - 1), randColor())
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Random shapes
  const shapeCount = randInt(8, 18)
  for (let i = 0; i < shapeCount; i++) {
    const opacity = Math.random() * 0.4 + 0.05
    ctx.fillStyle = randColor(opacity)
    ctx.strokeStyle = randColor(opacity * 0.5)
    ctx.lineWidth = Math.random() * 3

    const shape = randInt(0, 2)
    if (shape === 0) {
      // Circle
      const r = randInt(10, Math.min(width, height) / 3)
      ctx.beginPath()
      ctx.arc(randInt(0, width), randInt(0, height), r, 0, Math.PI * 2)
      Math.random() > 0.5 ? ctx.fill() : ctx.stroke()
    } else if (shape === 1) {
      // Rectangle
      const w = randInt(20, width / 2)
      const h = randInt(20, height / 2)
      if (Math.random() > 0.5) {
        ctx.fillRect(randInt(-w / 2, width), randInt(-h / 2, height), w, h)
      } else {
        ctx.strokeRect(randInt(-w / 2, width), randInt(-h / 2, height), w, h)
      }
    } else {
      // Triangle
      ctx.beginPath()
      ctx.moveTo(randInt(0, width), randInt(0, height))
      ctx.lineTo(randInt(0, width), randInt(0, height))
      ctx.lineTo(randInt(0, width), randInt(0, height))
      ctx.closePath()
      Math.random() > 0.5 ? ctx.fill() : ctx.stroke()
    }
  }

  // Subtle noise overlay for visual entropy
  const noiseData = ctx.getImageData(0, 0, width, height)
  const nd = noiseData.data
  for (let i = 0; i < nd.length; i += 4) {
    const noise = randInt(-8, 8)
    nd[i] = Math.min(255, Math.max(0, nd[i]! + noise))
    nd[i + 1] = Math.min(255, Math.max(0, nd[i + 1]! + noise))
    nd[i + 2] = Math.min(255, Math.max(0, nd[i + 2]! + noise))
  }

  // Encode URL into LSB
  encodeImageStego(noiseData, url)

  // Put modified data back
  ctx.putImageData(noiseData, 0, 0)

  // Export as PNG blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to export canvas as PNG'))
      },
      'image/png',
    )
  })
}

/**
 * Client-side image compression via AVIF WASM codec.
 *
 * Based on the PicPetite sister project pattern (@jsquash/avif) but
 * extended with a target-byte-size binary-search loop so the output
 * fits NoteFade's ~37 KB multi-chunk budget.
 *
 * Purely client-side: no network involvement, no EXIF leakage
 * (the WASM decoder strips metadata by design — it decodes to raw
 * ImageData and re-encodes from pixels only).
 */

const DEFAULT_MAX_DIMENSION = 1024
const MIN_DIMENSION = 320
const INITIAL_QUALITY = 50
const MIN_QUALITY = 8
const MAX_ITERATIONS = 6

export interface CompressResult {
  blob: Blob
  width: number
  height: number
  mime: 'image/avif'
  iterations: number
  /** Final encoder quality (0 worst, 100 best) */
  quality: number
}

export interface CompressOptions {
  /** Target maximum byte size; the compressor iterates until <= this */
  maxBytes: number
  /** Initial max dimension in pixels (longest side). Default: 1024. */
  maxDimension?: number
}

/**
 * Decode an image File into an ImageData using the native HTMLImageElement
 * + canvas path. This is the straightforward, no-extra-deps way to get
 * pixels out of any browser-decodable format (jpg/png/webp/avif/heic-on-safari).
 */
async function fileToImageData(file: File | Blob, maxDimension: number): Promise<ImageData> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas not available')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } finally {
    bitmap.close()
  }
}

async function encodeAvif(
  imageData: ImageData,
  quality: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const { encode } = await import('@jsquash/avif')
  const buf = await encode(imageData, { quality })
  // Copy into a fresh ArrayBuffer-backed Uint8Array so Blob construction
  // stays strictly typed under TS's new ArrayBufferLike/SharedArrayBuffer split.
  const out = new Uint8Array(new ArrayBuffer(buf.byteLength))
  out.set(new Uint8Array(buf))
  return out
}

/**
 * Binary-search compress an image File until the AVIF output is <= maxBytes.
 * Tries cqLevel steps first; if the floor quality still overshoots, halves
 * the dimensions and retries. Gives up after MAX_ITERATIONS rounds.
 */
export async function compressToTarget(
  file: File | Blob,
  options: CompressOptions,
): Promise<CompressResult> {
  const targetBytes = Math.max(1024, options.maxBytes)
  let maxDim = options.maxDimension ?? DEFAULT_MAX_DIMENSION

  let quality = INITIAL_QUALITY
  let iterations = 0
  let lastResult: { bytes: Uint8Array<ArrayBuffer>; width: number; height: number; quality: number } | null =
    null

  while (iterations < MAX_ITERATIONS) {
    const imageData = await fileToImageData(file, maxDim)
    const bytes = await encodeAvif(imageData, quality)
    iterations += 1

    if (bytes.byteLength <= targetBytes) {
      return {
        blob: new Blob([bytes], { type: 'image/avif' }),
        width: imageData.width,
        height: imageData.height,
        mime: 'image/avif',
        iterations,
        quality,
      }
    }

    lastResult = { bytes, width: imageData.width, height: imageData.height, quality }

    // Overshoot — either lower quality or shrink dimensions.
    // Prefer quality drops first, then dimensions once we hit the floor.
    if (quality > MIN_QUALITY + 10) {
      quality = Math.max(MIN_QUALITY, quality - 15)
    } else if (maxDim > MIN_DIMENSION) {
      maxDim = Math.max(MIN_DIMENSION, Math.round(maxDim * 0.75))
      quality = INITIAL_QUALITY // reset quality with smaller canvas
    } else {
      // At quality floor AND min dim — can't shrink further.
      break
    }
  }

  if (!lastResult) {
    throw new Error('compression failed — no output produced')
  }

  // Return the smallest we managed, even if it overshoots — caller decides.
  return {
    blob: new Blob([lastResult.bytes], { type: 'image/avif' }),
    width: lastResult.width,
    height: lastResult.height,
    mime: 'image/avif',
    iterations,
    quality: lastResult.quality,
  }
}

export function isImageCompressionSupported(): boolean {
  return (
    typeof createImageBitmap !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined'
  )
}

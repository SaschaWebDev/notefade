/**
 * Source-image input guards, run BEFORE any decode/compression so a
 * decode-bomb file (huge bytes, extreme megapixels, page-length screenshots)
 * never reaches createImageBitmap — decoding a 1200×30000 screenshot would
 * materialize ~144 MB of RGBA and the result would be illegible after the
 * 1024px downscale anyway.
 *
 * The pure check is separated from the async DOM part so it can be
 * unit-tested without image decoding.
 */
import {
  IMAGE_MAX_FILE_BYTES,
  IMAGE_MAX_SOURCE_PIXELS,
  IMAGE_MAX_SOURCE_LONGEST_SIDE,
  IMAGE_MAX_ASPECT_RATIO,
} from '@/constants'

export interface ImageDimensions {
  width: number
  height: number
  fileBytes: number
}

export type ImageCheckResult = { ok: true } | { ok: false; reason: string }

/** File-size pre-check, before even reading dimensions. */
export function checkFileSize(file: File | Blob): ImageCheckResult {
  if (file.size > IMAGE_MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `image file is too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — max ${Math.round(IMAGE_MAX_FILE_BYTES / 1024 / 1024)} MB`,
    }
  }
  return { ok: true }
}

/** Pure, synchronous source-dimension checks — unit-testable without decode. */
export function checkSourceImage(d: ImageDimensions): ImageCheckResult {
  if (d.fileBytes > IMAGE_MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `image file is too large (${(d.fileBytes / 1024 / 1024).toFixed(1)} MB) — max ${Math.round(IMAGE_MAX_FILE_BYTES / 1024 / 1024)} MB`,
    }
  }
  if (d.width <= 0 || d.height <= 0) {
    return { ok: false, reason: 'could not read image dimensions — try a different file' }
  }
  const longest = Math.max(d.width, d.height)
  const shortest = Math.min(d.width, d.height)
  if (longest > IMAGE_MAX_SOURCE_LONGEST_SIDE) {
    return {
      ok: false,
      reason: `image is too big (${longest}px) — max ${IMAGE_MAX_SOURCE_LONGEST_SIDE}px on the longest side`,
    }
  }
  if (d.width * d.height > IMAGE_MAX_SOURCE_PIXELS) {
    return {
      ok: false,
      reason: `image has too many pixels (${Math.round((d.width * d.height) / 1e6)} MP) — max ${Math.round(IMAGE_MAX_SOURCE_PIXELS / 1e6)} MP`,
    }
  }
  if (longest / shortest > IMAGE_MAX_ASPECT_RATIO) {
    return {
      ok: false,
      reason: `image is too long and thin (${(longest / shortest).toFixed(1)}:1) — max ${IMAGE_MAX_ASPECT_RATIO}:1. page-length screenshots won't be readable at this size`,
    }
  }
  return { ok: true }
}

/** Read intrinsic dimensions cheaply via an <img> + object URL (header parse,
 * no canvas decode). Rejects if the browser can't read the format. */
export function readImageDimensions(file: File | Blob): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight, fileBytes: file.size })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('could not read this image — try a different file'))
    }
    img.src = url
  })
}

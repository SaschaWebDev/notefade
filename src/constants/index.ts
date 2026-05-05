export const MAX_NOTE_CHARS_SINGLE = 1800
export const MAX_NOTE_CHARS = 50000
export const MAX_READ_COUNT = 10
export const OFFICIAL_HOSTS = ['notefade.com', 'www.notefade.com'] as const
export const STORAGE_KEYS = {
  BASE_URL: 'notefade-base-url',
  PROVIDER: 'notefade-provider',
  LEGACY_API_URL: 'notefade-api-url',
  THEME: 'notefade-theme',
  /** Tri-state preference for the share-screen voidhop shortener:
   *  - 'short' = always use the short URL when available
   *  - 'long'  = user opted out of auto-shorten
   *  - absent  = auto: shorten when displayUrl exceeds AUTO_SHORTEN_THRESHOLD */
  SHORTEN_PREF: 'notefade-shorten-pref',
} as const

export type ShortenPref = 'short' | 'long'

/** URL length above which the share screen auto-shortens through voidhop.
 * Padded notefade URLs are typically ~3 KB; the voidhop short URL is ~110
 * chars. Picking 500 keeps the toggle off for already-short fragments
 * (where shortening would be net-negative) while always engaging it for
 * the standard padded share URL. */
export const AUTO_SHORTEN_THRESHOLD = 500

// Copy feedback timings (ms)
export const COPY_FEEDBACK_MS = 1500
export const COPY_FLASH_FADE_MS = 1200
export const COPY_FLASH_DONE_MS = 1600

// Note creation limits
export const DEFAULT_BAR_SECONDS = 300
export const MAX_PASSWORD_LENGTH = 24
export const MAX_DECOY_COUNT = 3
export const MIN_STEGO_TEXT_LENGTH = 2

// QR code
export const QR_CHAR_LIMIT = 2950
export const QR_EXPORT_SIZE = 512

// Multi-note chunking
export const MULTI_PREFIX = 'multi:'
export const MULTI_DELIMITER = '|'
export const MAX_TOTAL_SHARDS = 30

// Fragment prefixes (protocol-level)
export const PROTECTED_PREFIX = 'protected:'
export const TIME_LOCK_PREFIX = 'tl:'

// BYOK (Bring Your Own Key) — pre-encrypted content
export const BYOK_DELIMITER = '!'

// Voice notes
export const VOICE_MAX_DURATION_MS = 15_000
export const VOICE_TARGET_BITRATE = 16_000
export const VOICE_BYTES_PER_CHUNK = 1250
export const VOICE_MAX_BYTES = VOICE_BYTES_PER_CHUNK * MAX_TOTAL_SHARDS
/** One-char mime codes embedded in note metadata */
export const VOICE_MIME_CODES = {
  w: 'audio/webm;codecs=opus',
  m: 'audio/mp4',
} as const
export type VoiceMimeCode = keyof typeof VOICE_MIME_CODES

// Image notes
export const IMAGE_BYTES_PER_CHUNK = 1250
export const IMAGE_MAX_BYTES = IMAGE_BYTES_PER_CHUNK * MAX_TOTAL_SHARDS
export const IMAGE_MAX_DIMENSION = 1024
export const IMAGE_MIME_CODES = {
  a: 'image/avif',
} as const
export type ImageMimeCode = keyof typeof IMAGE_MIME_CODES

// Video notes — bigger per-chunk budget (unpadded), outer URL is VoidHop-shortened
export const VIDEO_BYTES_PER_CHUNK = 4096
export const VIDEO_MAX_CHUNKS = 30
export const VIDEO_MAX_BYTES = VIDEO_BYTES_PER_CHUNK * VIDEO_MAX_CHUNKS
export const VIDEO_MAX_DURATION_MS = 15_000
export const VIDEO_TARGET_BITRATE = 80_000
export const VIDEO_MIME_CODES = {
  w: 'video/webm;codecs=vp9',
  v: 'video/webm;codecs=vp8',
  m: 'video/mp4',
} as const
export type VideoMimeCode = keyof typeof VIDEO_MIME_CODES
/** Prefix for unpadded multi-chunk video bundles (shortened via VoidHop) */
export const VIDEO_MULTI_PREFIX = 'vmulti:'
/**
 * VoidHop base URL for shortening long share URLs.
 *
 * Defaults to the production deployment. For local end-to-end testing,
 * override via a Vite env var (`VITE_VOIDHOP_BASE_URL`) in `.env.local`,
 * e.g. `VITE_VOIDHOP_BASE_URL=http://localhost:5173` if your local voidhop
 * vite dev server is on :5173 (it proxies `/api/*` to the worker and serves
 * the `/$id` redirect page from the same origin, so CORS, POST, and the
 * recipient redirect all work end-to-end against the local stack).
 */
export const VOIDHOP_BASE_URL: string =
  (import.meta.env?.VITE_VOIDHOP_BASE_URL as string | undefined) ??
  'https://voidhop.com'

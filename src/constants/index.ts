export const MAX_NOTE_CHARS_SINGLE = 1800
export const MAX_NOTE_CHARS = 50000
export const MAX_READ_COUNT = 10
export const OFFICIAL_HOSTS = ['notefade.com', 'www.notefade.com'] as const
export const STORAGE_KEYS = {
  BASE_URL: 'notefade-base-url',
  PROVIDER: 'notefade-provider',
  LEGACY_API_URL: 'notefade-api-url',
  THEME: 'notefade-theme',
} as const

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
export const VOICE_MAX_DURATION_MS = 30_000
export const VOICE_TARGET_BITRATE = 8_000
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

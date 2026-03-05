export const MAX_NOTE_CHARS = 1800
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

// Fragment prefixes (protocol-level)
export const PROTECTED_PREFIX = 'protected:'
export const TIME_LOCK_PREFIX = 'tl:'

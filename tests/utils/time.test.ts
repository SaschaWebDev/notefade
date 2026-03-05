import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatCountdown,
  formatDuration,
  formatTimeLockCountdown,
  ttlToISOExpiry,
  formatDate,
} from '@/utils/time'

describe('formatCountdown', () => {
  it('returns "0s" for 0', () => {
    expect(formatCountdown(0)).toBe('0s')
  })

  it('returns "0s" for negative values', () => {
    expect(formatCountdown(-1000)).toBe('0s')
  })

  it('floors sub-second to "0s" (999ms)', () => {
    expect(formatCountdown(999)).toBe('0s')
  })

  it('formats exactly 1 second', () => {
    expect(formatCountdown(1000)).toBe('1s')
  })

  it('formats exactly 60 seconds as "1m 0s"', () => {
    expect(formatCountdown(60_000)).toBe('1m 0s')
  })

  it('formats exactly 1 hour as "1h 0m 0s"', () => {
    expect(formatCountdown(3_600_000)).toBe('1h 0m 0s')
  })

  it('formats exactly 1 day as "1d 0h 0m 0s"', () => {
    expect(formatCountdown(86_400_000)).toBe('1d 0h 0m 0s')
  })

  it('formats compound values', () => {
    // 1d 2h 3m 4s = 93784 seconds
    const ms = ((1 * 24 + 2) * 60 + 3) * 60_000 + 4_000
    expect(formatCountdown(ms)).toBe('1d 2h 3m 4s')
  })
})

describe('formatDuration', () => {
  it('returns "0s" for 0', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('ceils sub-second to "1s" (1ms)', () => {
    expect(formatDuration(1)).toBe('1s')
  })

  it('ceils 999ms to "1s"', () => {
    expect(formatDuration(999)).toBe('1s')
  })

  it('formats exact second boundary', () => {
    expect(formatDuration(1000)).toBe('1s')
  })

  it('formats exactly 60 seconds as "1m 0s"', () => {
    expect(formatDuration(60_000)).toBe('1m 0s')
  })

  it('formats compound values', () => {
    expect(formatDuration(90_000)).toBe('1m 30s')
  })
})

describe('formatTimeLockCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "now" for past timestamp', () => {
    const past = Math.floor(Date.now() / 1000) - 60
    expect(formatTimeLockCountdown(past)).toBe('now')
  })

  it('returns "now" for exact current time', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(formatTimeLockCountdown(now)).toBe('now')
  })

  it('formats short countdown (seconds only)', () => {
    const inFuture = Math.floor(Date.now() / 1000) + 30
    expect(formatTimeLockCountdown(inFuture)).toBe('30s')
  })

  it('formats medium countdown (minutes + seconds)', () => {
    const inFuture = Math.floor(Date.now() / 1000) + 125 // 2m 5s
    expect(formatTimeLockCountdown(inFuture)).toBe('2m 5s')
  })

  it('formats hours countdown', () => {
    const inFuture = Math.floor(Date.now() / 1000) + 3661 // 1h 1m 1s
    expect(formatTimeLockCountdown(inFuture)).toBe('1h 1m 1s')
  })

  it('days format omits seconds', () => {
    const inFuture = Math.floor(Date.now() / 1000) + 90061 // 1d 1h 1m 1s
    const result = formatTimeLockCountdown(inFuture)
    expect(result).toBe('1d 1h 1m')
    expect(result).not.toContain('s')
  })
})

describe('ttlToISOExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('produces ISO string offset from now', () => {
    const result = ttlToISOExpiry(3600)
    expect(result).toBe('2025-01-01T01:00:00.000Z')
  })

  it('result is parseable as a Date', () => {
    const result = ttlToISOExpiry(60)
    expect(new Date(result).getTime()).not.toBeNaN()
  })

  it('handles ttl=0 (equals current time)', () => {
    const result = ttlToISOExpiry(0)
    expect(result).toBe('2025-01-01T00:00:00.000Z')
  })
})

describe('formatDate', () => {
  it('returns a non-empty string', () => {
    const result = formatDate(Date.now())
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces distinct output for different timestamps', () => {
    const a = formatDate(new Date('2025-01-01T00:00:00Z').getTime())
    const b = formatDate(new Date('2025-06-15T12:30:00Z').getTime())
    expect(a).not.toBe(b)
  })
})

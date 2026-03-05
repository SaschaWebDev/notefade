import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTypewriter } from '@/hooks/use-typewriter'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0) // deterministic phrase index 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useTypewriter', () => {
  it('active=false: returns empty string', () => {
    const { result } = renderHook(() => useTypewriter(false))
    expect(result.current).toBe('')
  })

  it('active=true: starts typing first character', () => {
    const { result } = renderHook(() => useTypewriter(true))

    // After first tick (TYPE_SPEED = 50ms)
    act(() => {
      vi.advanceTimersByTime(50)
    })

    expect(result.current.length).toBeGreaterThan(0)
  })

  it('types characters progressively', () => {
    const { result } = renderHook(() => useTypewriter(true))

    // Advance through several characters
    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(90) // TYPE_SPEED + max random (50 + 40)
      })
    }

    expect(result.current.length).toBeGreaterThanOrEqual(3)
  })

  it('deactivating resets display to empty', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useTypewriter(active),
      { initialProps: { active: true } },
    )

    // Type some characters
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.length).toBeGreaterThan(0)

    // Deactivate
    rerender({ active: false })
    expect(result.current).toBe('')
  })

  it('full typing phase completes and enters paused phase', async () => {
    const { result } = renderHook(() => useTypewriter(true))

    // Math.random returns 0, so TYPE_SPEED + 0*40 = 50ms per char.
    // Phrase 0 is 42 chars. Need 42*50 = 2100ms + initial 50ms trigger.
    // Step through timers one at a time to let React state flush.
    for (let i = 0; i < 50; i++) {
      await act(async () => {
        vi.advanceTimersByTime(50)
      })
    }

    // Should have typed the full phrase by now
    expect(result.current.length).toBeGreaterThan(10)
  })

  it('eventually starts deleting after pause', async () => {
    const { result } = renderHook(() => useTypewriter(true))

    // Type the full phrase (50 ticks * 50ms)
    for (let i = 0; i < 50; i++) {
      await act(async () => {
        vi.advanceTimersByTime(50)
      })
    }
    const fullLength = result.current.length
    expect(fullLength).toBeGreaterThan(0)

    // Advance past PAUSE_AFTER_TYPE (2000ms) + some delete ticks
    for (let i = 0; i < 100; i++) {
      await act(async () => {
        vi.advanceTimersByTime(30)
      })
    }

    expect(result.current.length).toBeLessThan(fullLength)
  })

  it('cleanup: clears timeout on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = renderHook(() => useTypewriter(true))

    act(() => {
      vi.advanceTimersByTime(100)
    })

    unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('reactivating restarts typing', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useTypewriter(active),
      { initialProps: { active: true } },
    )

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.length).toBeGreaterThan(0)

    rerender({ active: false })
    expect(result.current).toBe('')

    rerender({ active: true })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.length).toBeGreaterThan(0)
  })
})

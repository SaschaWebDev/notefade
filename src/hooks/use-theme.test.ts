import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let mockMatchesLight = false
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  mockMatchesLight = false
  mockAddEventListener.mockReset()
  mockRemoveEventListener.mockReset()

  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: mockMatchesLight,
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })

  vi.spyOn(document.documentElement, 'setAttribute')
})

describe('useTheme', () => {
  it('initial theme: defaults to dark when no localStorage and system is dark', async () => {
    const { useTheme } = await import('./use-theme')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('initial theme: reads from localStorage', async () => {
    localStorage.setItem('notefade-theme', 'light')
    const { useTheme } = await import('./use-theme')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('initial theme: falls back to system preference light', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
    const { useTheme } = await import('./use-theme')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('toggleTheme: switches dark to light', async () => {
    const { useTheme } = await import('./use-theme')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('light')
  })

  it('toggleTheme: switches light to dark', async () => {
    localStorage.setItem('notefade-theme', 'light')
    const { useTheme } = await import('./use-theme')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('toggleTheme: persists to localStorage', async () => {
    const { useTheme } = await import('./use-theme')
    const { result } = renderHook(() => useTheme())

    act(() => result.current.toggleTheme())
    expect(localStorage.getItem('notefade-theme')).toBe('light')
  })

  it('applies theme via data-theme attribute on document', async () => {
    const { useTheme } = await import('./use-theme')
    renderHook(() => useTheme())
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
      'data-theme',
      'dark',
    )
  })

  it('system preference listener is set up when no localStorage override', async () => {
    const { useTheme } = await import('./use-theme')
    renderHook(() => useTheme())
    expect(mockAddEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
  })

  it('system preference listener is not set up when localStorage has value', async () => {
    localStorage.setItem('notefade-theme', 'dark')
    const { useTheme } = await import('./use-theme')
    renderHook(() => useTheme())
    expect(mockAddEventListener).not.toHaveBeenCalled()
  })
})

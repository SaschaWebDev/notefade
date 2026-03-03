import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/crypto', () => ({
  openNote: vi.fn(),
}))

vi.mock('@/api', () => ({
  checkShard: vi.fn(),
  fetchShard: vi.fn(),
  createAdapter: vi.fn(),
}))

import { useReadNote } from './use-read-note'
import { openNote } from '@/crypto'
import { checkShard, fetchShard, createAdapter } from '@/api'

const mockOpenNote = vi.mocked(openNote)
const mockCheckShard = vi.mocked(checkShard)
const mockFetchShard = vi.mocked(fetchShard)
const mockCreateAdapter = vi.mocked(createAdapter)

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
})

describe('useReadNote', () => {
  it('initial state is idle', () => {
    mockCheckShard.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', false),
    )
    expect(result.current.state.status).toBe('idle')
  })

  it('sets gone when shard does not exist (HEAD check)', async () => {
    mockCheckShard.mockResolvedValueOnce(false)

    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', false),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('gone')
    expect(mockCheckShard).toHaveBeenCalledWith('shard-id')
  })

  it('stays idle when shard exists but not confirmed', async () => {
    mockCheckShard.mockResolvedValueOnce(true)

    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', false),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('idle')
  })

  it('confirmed triggers fetch + decrypt → decrypted state', async () => {
    mockCheckShard.mockResolvedValueOnce(true)
    mockFetchShard.mockResolvedValueOnce('server-shard')
    mockOpenNote.mockResolvedValueOnce({ plaintext: 'decrypted message', metadata: {} })

    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', true),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('decrypted')
    if (result.current.state.status === 'decrypted') {
      expect(result.current.state.plaintext).toBe('decrypted message')
    }
    expect(mockFetchShard).toHaveBeenCalledWith('shard-id')
    expect(mockOpenNote).toHaveBeenCalledWith('payload', 'server-shard')
  })

  it('auto-clear: transitions to faded after PLAINTEXT_TTL_MS', async () => {
    mockCheckShard.mockResolvedValueOnce(true)
    mockFetchShard.mockResolvedValueOnce('shard')
    mockOpenNote.mockResolvedValueOnce({ plaintext: 'text', metadata: {} })

    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', true),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(result.current.state.status).toBe('decrypted')

    // Advance past 5 minute auto-clear
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 100)
    })
    expect(result.current.state.status).toBe('faded')
  })

  it('DOMException → decryption error', async () => {
    mockCheckShard.mockResolvedValueOnce(true)
    mockFetchShard.mockResolvedValueOnce('shard')
    mockOpenNote.mockRejectedValueOnce(
      new DOMException('decrypt fail', 'OperationError'),
    )

    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', true),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('error')
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toContain('Failed to decrypt')
    }
  })

  it('generic Error → error state with message', async () => {
    mockCheckShard.mockResolvedValueOnce(true)
    mockFetchShard.mockResolvedValueOnce('shard')
    mockOpenNote.mockRejectedValueOnce(new Error('Network failure'))

    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', true),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('error')
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toBe('Network failure')
    }
  })

  it('fetch returns null → gone state', async () => {
    mockCheckShard.mockResolvedValueOnce(true)
    mockFetchShard.mockResolvedValueOnce(null)

    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', true),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('gone')
  })

  it('uses custom provider adapter when provided', async () => {
    const mockAdapter = {
      store: vi.fn(),
      check: vi.fn().mockResolvedValueOnce(true),
      fetch: vi.fn().mockResolvedValueOnce('adapter-shard'),
      delete: vi.fn(),
    }
    mockCreateAdapter.mockReturnValue(mockAdapter)
    mockOpenNote.mockResolvedValueOnce({ plaintext: 'decrypted', metadata: {} })

    const provider = { t: 'self' as const, u: 'https://custom.com' }
    const { result } = renderHook(() =>
      useReadNote('shard-id', 'payload', true, provider),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockCreateAdapter).toHaveBeenCalledWith(provider)
    expect(mockAdapter.check).toHaveBeenCalledWith('shard-id')
    expect(mockAdapter.fetch).toHaveBeenCalledWith('shard-id')
    expect(result.current.state.status).toBe('decrypted')
  })
})

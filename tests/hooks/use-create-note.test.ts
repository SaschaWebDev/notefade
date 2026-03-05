import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/crypto', () => ({
  createNote: vi.fn(),
  computeCheck: vi.fn(),
  padPayload: vi.fn(),
  protectFragment: vi.fn(),
}))

vi.mock('@/api', () => ({
  storeShard: vi.fn(),
  deferShard: vi.fn(),
  createAdapter: vi.fn(),
  encodeProviderConfig: vi.fn(),
}))

import { useCreateNote } from '@/hooks/use-create-note'
import { createNote, computeCheck, padPayload, protectFragment } from '@/crypto'
import { storeShard, createAdapter, encodeProviderConfig } from '@/api'

const mockCreateNote = vi.mocked(createNote)
const mockComputeCheck = vi.mocked(computeCheck)
const mockPadPayload = vi.mocked(padPayload)
const mockProtectFragment = vi.mocked(protectFragment)
const mockStoreShard = vi.mocked(storeShard)
const mockCreateAdapter = vi.mocked(createAdapter)
const mockEncodeProviderConfig = vi.mocked(encodeProviderConfig)

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  mockPadPayload.mockImplementation((s) => s)
  mockComputeCheck.mockReturnValue('chk')
})

describe('useCreateNote', () => {
  it('exposes maxChars as 1800', () => {
    const { result } = renderHook(() => useCreateNote())
    expect(result.current.maxChars).toBe(1800)
  })

  it('exposes ttlOptions with correct values', () => {
    const { result } = renderHook(() => useCreateNote())
    expect(result.current.ttlOptions).toEqual([
      { label: '1h', value: 3600 },
      { label: '24h', value: 86400 },
      { label: '7d', value: 604800 },
    ])
  })

  it('initial state: empty message, no link, not loading', () => {
    const { result } = renderHook(() => useCreateNote())
    expect(result.current.message).toBe('')
    expect(result.current.noteUrl).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('isEmpty is true when message is blank', () => {
    const { result } = renderHook(() => useCreateNote())
    expect(result.current.isEmpty).toBe(true)

    act(() => result.current.setMessage('   '))
    expect(result.current.isEmpty).toBe(true)
  })

  it('isEmpty is false when message has content', () => {
    const { result } = renderHook(() => useCreateNote())
    act(() => result.current.setMessage('hello'))
    expect(result.current.isEmpty).toBe(false)
  })

  it('isOverLimit is true when > 1800 chars', () => {
    const { result } = renderHook(() => useCreateNote())
    act(() => result.current.setMessage('x'.repeat(1801)))
    expect(result.current.isOverLimit).toBe(true)
  })

  it('isOverLimit is false when <= 1800 chars', () => {
    const { result } = renderHook(() => useCreateNote())
    act(() => result.current.setMessage('x'.repeat(1800)))
    expect(result.current.isOverLimit).toBe(false)
  })

  it('handleCreate returns early when empty', async () => {
    const { result } = renderHook(() => useCreateNote())
    await act(async () => {
      await result.current.handleCreate()
    })
    expect(mockCreateNote).not.toHaveBeenCalled()
  })

  it('handleCreate returns early when over limit', async () => {
    const { result } = renderHook(() => useCreateNote())
    act(() => result.current.setMessage('x'.repeat(1801)))
    await act(async () => {
      await result.current.handleCreate()
    })
    expect(mockCreateNote).not.toHaveBeenCalled()
  })

  it('handleCreate success: creates note and produces link URL', async () => {
    mockCreateNote.mockResolvedValueOnce({
      urlPayload: 'url-payload',
      serverShard: 'server-shard',
    })
    mockStoreShard.mockResolvedValueOnce('shard-id-123')

    const { result } = renderHook(() => useCreateNote())
    act(() => result.current.setMessage('secret message'))

    await act(async () => {
      await result.current.handleCreate()
    })

    expect(mockCreateNote).toHaveBeenCalledWith('secret message', { barSeconds: 300 })
    expect(mockStoreShard).toHaveBeenCalledWith('server-shard', 86400)
    expect(result.current.noteUrl).toContain('#shard-id-123:chk:url-payload')
    expect(result.current.shardId).toBe('shard-id-123')
    expect(result.current.message).toBe('')
  })

  it('handleCreate with password: produces protected URL', async () => {
    mockCreateNote.mockResolvedValueOnce({
      urlPayload: 'url-payload',
      serverShard: 'server-shard',
    })
    mockStoreShard.mockResolvedValueOnce('shard-id-456')
    mockProtectFragment.mockResolvedValueOnce('encrypted-data')

    const { result } = renderHook(() => useCreateNote())
    act(() => {
      result.current.setMessage('secret')
      result.current.setPasswordEnabled(true)
      result.current.setPassword('mypass')
    })

    await act(async () => {
      await result.current.handleCreate()
    })

    expect(mockProtectFragment).toHaveBeenCalled()
    expect(result.current.noteUrl).toContain('#protected:encrypted-data')
    expect(result.current.compactUrl).toBeNull()
  })

  it('handleCreate with error sets error state', async () => {
    mockCreateNote.mockRejectedValueOnce(new Error('crypto failed'))

    const { result } = renderHook(() => useCreateNote())
    act(() => result.current.setMessage('hello'))

    await act(async () => {
      await result.current.handleCreate()
    })

    expect(result.current.error).toBe('crypto failed')
    expect(result.current.loading).toBe(false)
  })

  it('provider config: loads from localStorage', () => {
    localStorage.setItem(
      'notefade-provider',
      JSON.stringify({ t: 'self', u: 'https://x.com' }),
    )
    const { result } = renderHook(() => useCreateNote())
    expect(result.current.providerConfig).toEqual({
      t: 'self',
      u: 'https://x.com',
    })
    expect(result.current.isCustomServer).toBe(true)
  })

  it('provider config: migrates legacy key', () => {
    localStorage.setItem('notefade-api-url', 'https://legacy.com')
    const { result } = renderHook(() => useCreateNote())
    expect(result.current.providerConfig).toEqual({
      t: 'self',
      u: 'https://legacy.com',
    })
    expect(localStorage.getItem('notefade-api-url')).toBeNull()
    expect(localStorage.getItem('notefade-provider')).toBeTruthy()
  })

  it('handleCreate with custom provider uses adapter', async () => {
    const mockAdapter = {
      store: vi.fn().mockResolvedValueOnce('adapter-id'),
      check: vi.fn(),
      fetch: vi.fn(),
      delete: vi.fn(),
    }
    mockCreateAdapter.mockReturnValueOnce(mockAdapter)
    mockCreateNote.mockResolvedValueOnce({
      urlPayload: 'payload',
      serverShard: 'shard',
    })
    mockEncodeProviderConfig.mockReturnValueOnce('encoded-cfg')

    const { result } = renderHook(() => useCreateNote())
    act(() => {
      result.current.setMessage('hello')
      result.current.setProviderConfig({ t: 'self', u: 'https://custom.com' })
    })

    await act(async () => {
      await result.current.handleCreate()
    })

    expect(mockCreateAdapter).toHaveBeenCalled()
    expect(mockAdapter.store).toHaveBeenCalledWith('shard', 86400)
    expect(result.current.noteUrl).toContain('@encoded-cfg')
  })

  it('resetNote clears all state', async () => {
    mockCreateNote.mockResolvedValueOnce({
      urlPayload: 'payload',
      serverShard: 'shard',
    })
    mockStoreShard.mockResolvedValueOnce('id')

    const { result } = renderHook(() => useCreateNote())
    act(() => result.current.setMessage('hello'))
    await act(async () => {
      await result.current.handleCreate()
    })
    expect(result.current.noteUrl).toBeTruthy()

    act(() => result.current.resetNote())
    expect(result.current.noteUrl).toBeNull()
    expect(result.current.compactUrl).toBeNull()
    expect(result.current.shardId).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('setProviderType preserves compatible fields', () => {
    const { result } = renderHook(() => useCreateNote())
    act(() => {
      result.current.setProviderConfig({
        t: 'upstash',
        u: 'https://redis.io',
        k: 'token123',
      })
    })

    act(() => result.current.setProviderType('supabase'))
    expect(result.current.providerConfig).toEqual({
      t: 'supabase',
      u: 'https://redis.io',
      k: 'token123',
    })
  })

  it('resetProvider clears provider config', () => {
    const { result } = renderHook(() => useCreateNote())
    act(() => {
      result.current.setProviderConfig({ t: 'self', u: 'https://x.com' })
    })
    expect(result.current.isCustomServer).toBe(true)

    act(() => result.current.resetProvider())
    expect(result.current.providerConfig).toBeNull()
    expect(result.current.isCustomServer).toBe(false)
  })
})

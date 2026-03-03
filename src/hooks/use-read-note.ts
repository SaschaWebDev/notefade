import { useState, useEffect, useRef } from 'react'
import { openNote } from '@/crypto'
import type { NoteMetadata } from '@/crypto'
import { checkShard, fetchShard, createAdapter } from '@/api'
import type { ProviderConfig } from '@/api/provider-types'

const DEFAULT_PLAINTEXT_TTL_MS = 5 * 60 * 1000 // 5 minutes

type ReadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'decrypted'; plaintext: string; metadata: NoteMetadata; remainingMs: number }
  | { status: 'faded' }
  | { status: 'gone' }
  | { status: 'error'; message: string }

export type { ReadState }

interface UseReadNoteReturn {
  state: ReadState
}

export function useReadNote(
  shardId: string,
  urlPayload: string,
  confirmed: boolean,
  provider?: ProviderConfig | null,
  shardIds?: string[],
): UseReadNoteReturn {
  const [state, setState] = useState<ReadState>({ status: 'idle' })

  // Cache promises so React StrictMode's double-mount reuses
  // the same in-flight request instead of making duplicates.
  const checkPromiseRef = useRef<Promise<boolean> | null>(null)
  const fetchPromiseRef = useRef<Promise<string | null> | null>(null)

  // Stable serialized key for provider dependency
  const providerKey = provider ? JSON.stringify(provider) : ''

  // All shard IDs to try (multi-read support)
  const allShardIds = shardIds && shardIds.length > 0 ? shardIds : [shardId]

  // Phase 1: Non-destructive existence check (HEAD)
  // For multi-read, check the first shard — if it exists, at least one read remains
  useEffect(() => {
    if (!shardId) return

    let cancelled = false

    if (!checkPromiseRef.current) {
      // Check all shards to see if any exist
      const checkAll = async (): Promise<boolean> => {
        for (const id of allShardIds) {
          let exists: boolean
          if (provider) {
            const adapter = createAdapter(provider)
            exists = await adapter.check(id)
          } else {
            exists = await checkShard(id)
          }
          if (exists) return true
        }
        return false
      }
      checkPromiseRef.current = checkAll()
    }

    async function probe() {
      try {
        const exists = await checkPromiseRef.current
        if (cancelled) return

        if (!exists) {
          setState({ status: 'gone' })
        }
      } catch {
        // Silently ignore HEAD failures — the destructive GET
        // will surface errors if the user confirms
      }
    }

    void probe()

    return () => {
      cancelled = true
    }
  }, [shardId, providerKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear plaintext after timeout (dynamic based on BAR metadata)
  useEffect(() => {
    if (state.status !== 'decrypted') return

    const ttlMs = state.metadata.barSeconds
      ? state.metadata.barSeconds * 1000
      : DEFAULT_PLAINTEXT_TTL_MS

    // Update remaining time every second for countdown display
    const startTime = Date.now()
    const endTime = startTime + ttlMs

    const interval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now())
      if (remaining <= 0) {
        setState({ status: 'faded' })
      } else {
        setState((prev) => {
          if (prev.status !== 'decrypted') return prev
          return { ...prev, remainingMs: remaining }
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [state.status === 'decrypted' ? `${state.metadata.barSeconds}` : '']) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2: Destructive fetch + decrypt (only after confirmation)
  useEffect(() => {
    if (!confirmed) return

    setState({ status: 'loading' })

    let cancelled = false

    if (!fetchPromiseRef.current) {
      // Multi-read: try shard IDs sequentially until one succeeds
      const fetchFirst = async (): Promise<string | null> => {
        for (const id of allShardIds) {
          let shard: string | null
          if (provider) {
            const adapter = createAdapter(provider)
            shard = await adapter.fetch(id)
          } else {
            shard = await fetchShard(id)
          }
          if (shard !== null) return shard
        }
        return null
      }
      fetchPromiseRef.current = fetchFirst()
    }

    async function load() {
      try {
        const shard = await fetchPromiseRef.current
        if (cancelled) return

        if (shard === null) {
          setState({ status: 'gone' })
          return
        }

        const result = await openNote(urlPayload, shard)
        if (cancelled) return

        const ttlMs = result.metadata.barSeconds
          ? result.metadata.barSeconds * 1000
          : DEFAULT_PLAINTEXT_TTL_MS

        setState({
          status: 'decrypted',
          plaintext: result.plaintext,
          metadata: result.metadata,
          remainingMs: ttlMs,
        })
      } catch (err) {
        if (cancelled) return

        if (err instanceof DOMException) {
          setState({
            status: 'error',
            message:
              'Failed to decrypt this note. The link may be corrupted or incomplete.',
          })
          return
        }

        setState({
          status: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Something went wrong while opening this note.',
        })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [shardId, urlPayload, confirmed, providerKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { state }
}

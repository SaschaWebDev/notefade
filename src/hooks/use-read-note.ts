import { useState, useEffect, useRef } from 'react'
import { openNote, decryptByokContent } from '@/crypto'
import type { NoteMetadata } from '@/crypto'
import { checkShard, fetchShard, createAdapter } from '@/api'
import type { ProviderConfig } from '@/api/provider-types'

const DEFAULT_PLAINTEXT_TTL_MS = 5 * 60 * 1000 // 5 minutes

type ReadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'decrypted'; plaintext: string; metadata: NoteMetadata; remainingMs: number }
  | { status: 'decrypted-voice'; blob: Blob; mimeType: string; durationMs: number; metadata: NoteMetadata; remainingMs: number }
  | { status: 'decrypted-image'; blob: Blob; mimeType: string; metadata: NoteMetadata; remainingMs: number }
  | { status: 'decrypted-video'; blob: Blob; mimeType: string; durationMs: number; metadata: NoteMetadata; remainingMs: number }
  | { status: 'faded' }
  | { status: 'gone' }
  | { status: 'error'; message: string }

export type { ReadState }

interface UseReadNoteReturn {
  state: ReadState
  remainingReads: number | null
}

export function useReadNote(
  shardId: string,
  urlPayload: string,
  confirmed: boolean,
  provider?: ProviderConfig | null,
  shardIds?: string[],
  byokKey?: string | null,
): UseReadNoteReturn {
  const [state, setState] = useState<ReadState>({ status: 'idle' })
  const [remainingReads, setRemainingReads] = useState<number | null>(null)

  // Cache promises so React StrictMode's double-mount reuses
  // the same in-flight request instead of making duplicates.
  const checkPromiseRef = useRef<Promise<number> | null>(null)
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
      // Check all shards in parallel to count how many remain
      const countRemaining = async (): Promise<number> => {
        const results = await Promise.all(
          allShardIds.map(async (id) => {
            if (provider) {
              const adapter = createAdapter(provider)
              return adapter.check(id)
            }
            return checkShard(id)
          }),
        )
        return results.filter(Boolean).length
      }
      checkPromiseRef.current = countRemaining()
    }

    async function probe() {
      try {
        const count = await checkPromiseRef.current
        if (cancelled) return

        setRemainingReads(count)
        if (count === 0) {
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

        // BYOK: second-layer decryption with user-provided key
        let finalPlaintext = result.plaintext
        if (byokKey) {
          try {
            finalPlaintext = await decryptByokContent(result.plaintext, byokKey)
          } catch {
            setState({
              status: 'error',
              message: 'Second-layer decryption failed — the provided key may not match the encrypted content.',
            })
            return
          }
        }

        const ttlMs = result.metadata.barSeconds
          ? result.metadata.barSeconds * 1000
          : DEFAULT_PLAINTEXT_TTL_MS

        setState({
          status: 'decrypted',
          plaintext: finalPlaintext,
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

  return { state, remainingReads }
}

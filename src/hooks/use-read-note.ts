import { useState, useEffect, useRef } from 'react'
import { openNote } from '@/crypto'
import { checkShard, fetchShard } from '@/api'

type ReadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'decrypted'; plaintext: string }
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
): UseReadNoteReturn {
  const [state, setState] = useState<ReadState>({ status: 'idle' })

  // Cache promises so React StrictMode's double-mount reuses
  // the same in-flight request instead of making duplicates.
  const checkPromiseRef = useRef<Promise<boolean> | null>(null)
  const fetchPromiseRef = useRef<Promise<string | null> | null>(null)

  // Phase 1: Non-destructive existence check (HEAD)
  useEffect(() => {
    if (!shardId) return

    let cancelled = false

    if (!checkPromiseRef.current) {
      checkPromiseRef.current = checkShard(shardId)
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
  }, [shardId])

  // Phase 2: Destructive fetch + decrypt (only after confirmation)
  useEffect(() => {
    if (!confirmed) return

    setState({ status: 'loading' })

    let cancelled = false

    if (!fetchPromiseRef.current) {
      fetchPromiseRef.current = fetchShard(shardId)
    }

    async function load() {
      try {
        const shard = await fetchPromiseRef.current
        if (cancelled) return

        if (shard === null) {
          setState({ status: 'gone' })
          return
        }

        const plaintext = await openNote(urlPayload, shard)
        if (cancelled) return

        setState({ status: 'decrypted', plaintext })
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
  }, [shardId, urlPayload, confirmed])

  return { state }
}

import { useState, useEffect } from 'react'
import { openNote } from '@/crypto'
import { fetchShard } from '@/api'

type ReadState =
  | { status: 'loading' }
  | { status: 'decrypted'; plaintext: string }
  | { status: 'gone' }
  | { status: 'error'; message: string }

export type { ReadState }

interface UseReadNoteReturn {
  state: ReadState
}

export function useReadNote(shardId: string, urlPayload: string): UseReadNoteReturn {
  const [state, setState] = useState<ReadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const shard = await fetchShard(shardId)
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
  }, [shardId, urlPayload])

  return { state }
}

import { useState, useEffect, useRef } from 'react'
import { openNoteBytes, decryptByokContent } from '@/crypto'
import type { NoteMetadata } from '@/crypto'
import { checkShard, fetchShard, createAdapter } from '@/api'
import { VOICE_MIME_CODES, type VoiceMimeCode } from '@/constants'
import type { ParsedFragment } from '@/hooks/use-hash-route'
import type { ReadState } from '@/hooks/use-read-note'

const DEFAULT_PLAINTEXT_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface UseReadMultiNoteReturn {
  state: ReadState
  remainingReads: number | null
}

/**
 * Hook for reading multi-chunk notes. Fetches and decrypts all chunks
 * in parallel, concatenates plaintexts, and extracts metadata from
 * the first chunk only.
 */
export function useReadMultiNote(
  chunks: ParsedFragment[],
  confirmed: boolean,
  byokKey?: string | null,
): UseReadMultiNoteReturn {
  const [state, setState] = useState<ReadState>({ status: 'idle' })
  const [remainingReads, setRemainingReads] = useState<number | null>(null)

  const checkPromiseRef = useRef<Promise<number> | null>(null)
  const fetchPromiseRef = useRef<Promise<string[] | null> | null>(null)

  // Stable key for dependency tracking
  const chunksKey = chunks.map((c) => c.shardId).join(',')

  // Phase 1: Non-destructive existence check (HEAD) for all chunks
  useEffect(() => {
    if (chunks.length === 0) return

    let cancelled = false

    if (!checkPromiseRef.current) {
      const countRemaining = async (): Promise<number> => {
        // For each chunk, check all its shard IDs (multi-read support)
        const chunkResults = await Promise.all(
          chunks.map(async (chunk) => {
            const ids = chunk.shardIds.length > 0 ? chunk.shardIds : [chunk.shardId]
            const results = await Promise.all(
              ids.map(async (id) => {
                if (chunk.provider) {
                  const adapter = createAdapter(chunk.provider)
                  return adapter.check(id)
                }
                return checkShard(id)
              }),
            )
            return results.filter(Boolean).length
          }),
        )
        // If any chunk has 0 remaining shards, the note is unreadable
        if (chunkResults.some((count) => count === 0)) return 0
        // Remaining reads = minimum across all chunks
        return Math.min(...chunkResults)
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
        // Silently ignore HEAD failures
      }
    }

    void probe()

    return () => {
      cancelled = true
    }
  }, [chunksKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear plaintext after timeout (applies to both text and voice)
  useEffect(() => {
    if (state.status !== 'decrypted' && state.status !== 'decrypted-voice') return

    const ttlMs = state.metadata.barSeconds
      ? state.metadata.barSeconds * 1000
      : DEFAULT_PLAINTEXT_TTL_MS

    const startTime = Date.now()
    const endTime = startTime + ttlMs

    const interval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now())
      if (remaining <= 0) {
        setState({ status: 'faded' })
      } else {
        setState((prev) => {
          if (prev.status !== 'decrypted' && prev.status !== 'decrypted-voice') return prev
          return { ...prev, remainingMs: remaining }
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [
    state.status === 'decrypted' || state.status === 'decrypted-voice'
      ? `${state.status}:${state.metadata.barSeconds}`
      : '',
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2: Destructive fetch + decrypt all chunks (after confirmation)
  useEffect(() => {
    if (!confirmed) return

    setState({ status: 'loading' })

    let cancelled = false

    if (!fetchPromiseRef.current) {
      // Fetch one shard per chunk in parallel
      const fetchAll = async (): Promise<string[] | null> => {
        const results = await Promise.all(
          chunks.map(async (chunk) => {
            const ids = chunk.shardIds.length > 0 ? chunk.shardIds : [chunk.shardId]
            // Try shard IDs sequentially until one succeeds
            for (const id of ids) {
              let shard: string | null
              if (chunk.provider) {
                const adapter = createAdapter(chunk.provider)
                shard = await adapter.fetch(id)
              } else {
                shard = await fetchShard(id)
              }
              if (shard !== null) return shard
            }
            return null
          }),
        )

        // If any chunk's shard is missing, the entire note is gone
        if (results.some((s) => s === null)) return null
        return results as string[]
      }
      fetchPromiseRef.current = fetchAll()
    }

    async function load() {
      try {
        const shards = await fetchPromiseRef.current
        if (cancelled) return

        if (shards === null) {
          setState({ status: 'gone' })
          return
        }

        // Decrypt all chunks in parallel as raw bytes; metadata lives on chunk 0
        const decrypted = await Promise.all(
          chunks.map((chunk, i) => openNoteBytes(chunk.urlPayload, shards[i]!)),
        )
        if (cancelled) return

        const firstMetadata: NoteMetadata = decrypted[0]!.metadata
        const ttlMs = firstMetadata.barSeconds
          ? firstMetadata.barSeconds * 1000
          : DEFAULT_PLAINTEXT_TTL_MS

        if (firstMetadata.voiceMime) {
          // --- Voice branch ---
          const mimeCode = firstMetadata.voiceMime as VoiceMimeCode
          const mimeType = VOICE_MIME_CODES[mimeCode]
          if (!mimeType) {
            setState({
              status: 'error',
              message: 'Unsupported voice format.',
            })
            return
          }
          // Preallocate one buffer for all audio bytes to avoid Blob copies
          let total = 0
          for (const d of decrypted) total += d.content.length
          const merged = new Uint8Array(total)
          let offset = 0
          for (const d of decrypted) {
            merged.set(d.content, offset)
            offset += d.content.length
          }
          const blob = new Blob([merged], { type: mimeType })

          setState({
            status: 'decrypted-voice',
            blob,
            mimeType,
            durationMs: firstMetadata.voiceDurationMs ?? 0,
            metadata: firstMetadata,
            remainingMs: ttlMs,
          })
          return
        }

        // --- Text branch: decode bytes as UTF-8 and concat ---
        const decoder = new TextDecoder()
        let combinedPlaintext = decrypted.map((d) => decoder.decode(d.content)).join('')

        // BYOK: second-layer decryption with user-provided key
        if (byokKey) {
          try {
            combinedPlaintext = await decryptByokContent(combinedPlaintext, byokKey)
          } catch {
            setState({
              status: 'error',
              message: 'Second-layer decryption failed — the provided key may not match the encrypted content.',
            })
            return
          }
        }

        setState({
          status: 'decrypted',
          plaintext: combinedPlaintext,
          metadata: firstMetadata,
          remainingMs: ttlMs,
        })
      } catch (err) {
        if (cancelled) return

        if (err instanceof DOMException) {
          setState({
            status: 'error',
            message: 'Failed to decrypt this note. The link may be corrupted or incomplete.',
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
  }, [chunksKey, confirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  return { state, remainingReads }
}

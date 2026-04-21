import { useEffect, useRef, useState } from 'react'
import {
  transcribeBlob,
  isTranscriptionSupported,
  type TranscribeProgress,
} from '@/transcription'
import styles from './TranscribeButton.module.css'

interface TranscribeButtonProps {
  blob: Blob | null
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'running'; progress: TranscribeProgress }
  | { kind: 'done'; text: string }
  | { kind: 'error'; message: string }

const DOWNLOAD_NOTE =
  "transcription runs entirely on your device — nothing is sent to any server. the first time you use it, your browser will download the speech model (~40 MB). it is cached afterwards."

function phaseLabel(p: TranscribeProgress): string {
  if (p.phase === 'download') {
    const pct = p.progress ? Math.round(p.progress * 100) : null
    return pct !== null ? `downloading model · ${pct}%` : 'downloading model…'
  }
  if (p.phase === 'decode') return 'decoding audio…'
  if (p.phase === 'transcribe') return 'transcribing…'
  return 'done'
}

export function TranscribeButton({ blob }: TranscribeButtonProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [supported, setSupported] = useState(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    setSupported(isTranscriptionSupported())
    return () => {
      cancelRef.current = true
    }
  }, [])

  const run = async () => {
    if (!blob) return
    cancelRef.current = false
    setPhase({ kind: 'running', progress: { phase: 'download' } })
    try {
      const result = await transcribeBlob(blob, (p) => {
        if (!cancelRef.current) setPhase({ kind: 'running', progress: p })
      })
      if (cancelRef.current) return
      setPhase({ kind: 'done', text: result.text || '(no speech detected)' })
    } catch (err) {
      if (cancelRef.current) return
      setPhase({
        kind: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'transcription failed — try again or reload the page',
      })
    }
  }

  if (!supported || !blob) return null

  if (phase.kind === 'idle') {
    return (
      <button
        type='button'
        className={styles.trigger}
        onClick={() => setPhase({ kind: 'confirming' })}
      >
        transcribe
      </button>
    )
  }

  if (phase.kind === 'confirming') {
    return (
      <div className={styles.panel}>
        <p className={styles.note}>{DOWNLOAD_NOTE}</p>
        <div className={styles.row}>
          <button type='button' className={styles.primaryBtn} onClick={run}>
            download &amp; transcribe
          </button>
          <button
            type='button'
            className={styles.ghostBtn}
            onClick={() => setPhase({ kind: 'idle' })}
          >
            cancel
          </button>
        </div>
      </div>
    )
  }

  if (phase.kind === 'running') {
    const pct =
      phase.progress.phase === 'download' && phase.progress.progress !== undefined
        ? Math.round(phase.progress.progress * 100)
        : null
    return (
      <div className={styles.panel}>
        <p className={styles.status}>{phaseLabel(phase.progress)}</p>
        {pct !== null && (
          <div className={styles.progress} aria-hidden>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    )
  }

  if (phase.kind === 'error') {
    return (
      <div className={styles.panel}>
        <p className={styles.error}>{phase.message}</p>
        <button
          type='button'
          className={styles.ghostBtn}
          onClick={() => setPhase({ kind: 'idle' })}
        >
          dismiss
        </button>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <p className={styles.transcriptLabel}>transcript</p>
      <p className={styles.transcript}>{phase.text}</p>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useVideoRecorder, type RecordedVideoClip } from '@/video'
import { VIDEO_MAX_DURATION_MS, VIDEO_MAX_BYTES } from '@/constants'
import styles from './VideoComposer.module.css'

interface VideoComposerProps {
  clip: RecordedVideoClip | null
  onClipChange: (clip: RecordedVideoClip | null) => void
  disabled?: boolean
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  return `${(b / 1024).toFixed(1)} KB`
}

export function VideoComposer({ clip, onClipChange, disabled }: VideoComposerProps) {
  const {
    state,
    error,
    durationMs,
    clip: recorderClip,
    livePreviewStream,
    start,
    stop,
    discard,
  } = useVideoRecorder()

  const liveVideoRef = useRef<HTMLVideoElement | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (recorderClip && !clip) {
      onClipChange(recorderClip)
    }
  }, [recorderClip, clip, onClipChange])

  useEffect(() => {
    const el = liveVideoRef.current
    if (!el) return
    el.srcObject = livePreviewStream ?? null
    if (livePreviewStream) {
      el.muted = true
      void el.play().catch(() => {
        /* autoplay may be blocked; user can interact to start */
      })
    }
    return () => {
      if (el) el.srcObject = null
    }
  }, [livePreviewStream])

  const handleStart = () => {
    if (disabled) return
    onClipChange(null)
    void start()
  }

  const handleStop = () => void stop()

  const handleDiscard = () => {
    discard()
    onClipChange(null)
  }

  const remainingMs = Math.max(0, VIDEO_MAX_DURATION_MS - durationMs)
  const overBudget = clip ? clip.blob.size > VIDEO_MAX_BYTES : false

  if (state === 'recording') {
    return (
      <div className={styles.composer}>
        <div className={styles.row}>
          <span className={styles.recordingDot} />
          <span className={styles.label}>recording</span>
          <span className={styles.timer}>
            {formatClock(durationMs)} <span className={styles.sep}>/</span>{' '}
            {formatClock(VIDEO_MAX_DURATION_MS)}
          </span>
        </div>
        <div className={styles.previewFrame}>
          <video
            ref={liveVideoRef}
            className={styles.video}
            playsInline
            muted
            autoPlay
          />
        </div>
        <div className={styles.actions}>
          <button type='button' className={styles.primaryBtn} onClick={handleStop}>
            stop &amp; keep
          </button>
          <button type='button' className={styles.ghostBtn} onClick={handleDiscard}>
            discard
          </button>
          <span className={styles.hint}>auto-stop in {formatClock(remainingMs)}</span>
        </div>
      </div>
    )
  }

  if (clip) {
    return (
      <div className={styles.composer}>
        <div className={styles.row}>
          <span className={styles.previewLabel}>recorded</span>
          <span className={styles.timer}>
            {formatClock(clip.durationMs)} · {formatBytes(clip.blob.size)}
          </span>
        </div>
        <div className={styles.previewFrame}>
          <video
            ref={previewVideoRef}
            className={styles.video}
            src={clip.streamUrl}
            controls
            playsInline
          />
        </div>
        {overBudget && (
          <p className={styles.errorText}>
            clip exceeds the {formatBytes(VIDEO_MAX_BYTES)} ceiling — please re-record something shorter.
          </p>
        )}
        <div className={styles.actions}>
          <button type='button' className={styles.ghostBtn} onClick={handleDiscard} disabled={disabled}>
            re-record
          </button>
        </div>
        <p className={styles.caveat}>
          video notes show your face and surroundings. short links are shared via voidhop;
          the long URL carries encrypted video chunks that remain unreadable without the key.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.composer}>
      <div className={styles.idleBody}>
        <button
          type='button'
          className={styles.recordBtn}
          onClick={handleStart}
          disabled={disabled}
          aria-label='start video recording'
        >
          <span className={styles.recordDot} />
        </button>
        <div className={styles.idleText}>
          <p className={styles.idleTitle}>record a video note</p>
          <p className={styles.idleSub}>
            up to {Math.floor(VIDEO_MAX_DURATION_MS / 1000)} seconds · 240p · encrypted &amp; self-destructing
          </p>
        </div>
      </div>
      {error && <p className={styles.errorText}>{error.message}</p>}
    </div>
  )
}

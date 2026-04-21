import { useEffect } from 'react'
import { useAudioRecorder, type RecordedClip } from '@/audio'
import { AudioPlayer } from '@/components/ui/audio-player'
import { VOICE_MAX_DURATION_MS } from '@/constants'
import styles from './VoiceComposer.module.css'

interface VoiceComposerProps {
  clip: RecordedClip | null
  onClipChange: (clip: RecordedClip | null) => void
  disabled?: boolean
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function SpectrumMeter({ spectrum }: { spectrum: number[] }) {
  return (
    <div className={styles.amplitude} aria-hidden>
      {spectrum.map((v, i) => {
        // Each bar = one voice-band FFT bin. Independent dancing.
        const drive = Math.min(1, v * 1.6)
        const height = Math.min(1, Math.max(0.05, drive))
        const activation = Math.min(1, drive * 1.1)
        return (
          <span
            key={i}
            className={`${styles.bar} ${activation > 0.15 ? styles.barActive : ''}`}
            style={{
              height: `${height * 100}%`,
              opacity: 0.08 + activation * 0.92,
            }}
          />
        )
      })}
    </div>
  )
}

export function VoiceComposer({ clip, onClipChange, disabled }: VoiceComposerProps) {
  const { state, error, durationMs, spectrum, clip: recorderClip, start, stop, discard } = useAudioRecorder()

  useEffect(() => {
    if (recorderClip && !clip) {
      onClipChange(recorderClip)
    }
  }, [recorderClip, clip, onClipChange])

  const handleStart = () => {
    if (disabled) return
    onClipChange(null)
    void start()
  }

  const handleStop = () => {
    void stop()
  }

  const handleDiscard = () => {
    discard()
    onClipChange(null)
  }

  const remainingMs = Math.max(0, VOICE_MAX_DURATION_MS - durationMs)

  if (state === 'recording') {
    return (
      <div className={styles.composer}>
        <div className={styles.row}>
          <span className={styles.recordingDot} />
          <span className={styles.label}>recording</span>
          <span className={styles.timer}>
            {formatClock(durationMs)} <span className={styles.sep}>/</span> {formatClock(VOICE_MAX_DURATION_MS)}
          </span>
        </div>
        <SpectrumMeter spectrum={spectrum} />
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
        </div>
        <AudioPlayer blob={clip.blob} durationMs={clip.durationMs} />
        <div className={styles.actions}>
          <button type='button' className={styles.ghostBtn} onClick={handleDiscard} disabled={disabled}>
            re-record
          </button>
        </div>
        <p className={styles.caveat}>
          voice notes contain your voice. anyone with the link can play once and record externally.
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
          aria-label='start recording'
        >
          <span className={styles.recordDot} />
        </button>
        <div className={styles.idleText}>
          <p className={styles.idleTitle}>record a voice note</p>
          <p className={styles.idleSub}>
            up to {Math.floor(VOICE_MAX_DURATION_MS / 1000)} seconds · encrypted &amp; self-destructing
          </p>
        </div>
      </div>
      {error && (
        <p className={styles.errorText}>{error.message}</p>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useBlobUrl, computeWaveform, WAVEFORM_BAR_COUNT } from '@/audio'
import styles from './AudioPlayer.module.css'

interface AudioPlayerProps {
  blob: Blob | null
  /** Duration override in ms — MediaRecorder webm often reports Infinity for duration. */
  durationMs?: number
}

function formatMs(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function PlayGlyph() {
  return (
    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' aria-hidden='true'>
      <path d='M3.5 2 L11.5 7 L3.5 12 Z' fill='currentColor' />
    </svg>
  )
}

function PauseGlyph() {
  return (
    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' aria-hidden='true'>
      <rect x='3.5' y='2' width='2.5' height='10' rx='0.6' fill='currentColor' />
      <rect x='8' y='2' width='2.5' height='10' rx='0.6' fill='currentColor' />
    </svg>
  )
}

export function AudioPlayer({ blob, durationMs }: AudioPlayerProps) {
  const url = useBlobUrl(blob)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [waveform, setWaveform] = useState<number[]>(() =>
    new Array(WAVEFORM_BAR_COUNT).fill(0.5),
  )
  const [playing, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [totalMs, setTotalMs] = useState<number>(
    durationMs && isFinite(durationMs) ? durationMs : 0,
  )

  // Compute static waveform from the clip bytes.
  useEffect(() => {
    if (!blob) {
      setWaveform(new Array(WAVEFORM_BAR_COUNT).fill(0.5))
      return
    }
    let cancelled = false
    void computeWaveform(blob).then((peaks) => {
      if (!cancelled) setWaveform(peaks)
    })
    return () => {
      cancelled = true
    }
  }, [blob])

  useEffect(() => {
    if (durationMs && isFinite(durationMs)) setTotalMs(durationMs)
  }, [durationMs])

  // Audio element lifecycle.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setCurrentMs(el.currentTime * 1000)
    const onMeta = () => {
      if (isFinite(el.duration) && el.duration > 0) setTotalMs(el.duration * 1000)
    }
    const onEnd = () => {
      setPlaying(false)
      setCurrentMs(0)
      try {
        el.currentTime = 0
      } catch {
        // ignore
      }
    }
    const onPause = () => setPlaying(false)
    const onPlay = () => setPlaying(true)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('durationchange', onMeta)
    el.addEventListener('ended', onEnd)
    el.addEventListener('pause', onPause)
    el.addEventListener('play', onPlay)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('durationchange', onMeta)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('play', onPlay)
    }
  }, [url])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
    } else {
      void el.play().catch(() => setPlaying(false))
    }
  }

  const seekFromClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current
    if (!el || totalMs <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    try {
      el.currentTime = (fraction * totalMs) / 1000
    } catch {
      // ignore seek errors on unseekable streams
    }
    setCurrentMs(fraction * totalMs)
  }

  const progress = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0

  return (
    <div className={styles.player}>
      <audio ref={audioRef} src={url ?? undefined} preload='metadata' />
      <button
        type='button'
        className={styles.playBtn}
        onClick={togglePlay}
        aria-label={playing ? 'pause' : 'play'}
        disabled={!url}
      >
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </button>
      <div
        className={styles.waveform}
        onClick={seekFromClick}
        role='slider'
        aria-label='playback position'
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs)}
        aria-valuenow={Math.round(currentMs)}
        tabIndex={0}
      >
        {waveform.map((peak, i) => {
          const fraction = waveform.length > 0 ? i / waveform.length : 0
          const played = fraction < progress
          const height = Math.max(3, peak * 24)
          return (
            <span
              key={i}
              className={`${styles.bar} ${played ? styles.barPlayed : styles.barUnplayed}`}
              style={{ height: `${height}px` }}
            />
          )
        })}
      </div>
      <div className={styles.time}>
        {formatMs(currentMs)} <span className={styles.sep}>/</span> {formatMs(totalMs)}
      </div>
    </div>
  )
}

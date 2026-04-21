import { useCallback, useEffect, useRef, useState } from 'react'
import {
  compressToTarget,
  isImageCompressionSupported,
} from '@/images'
import { IMAGE_MAX_BYTES, IMAGE_MAX_DIMENSION } from '@/constants'
import { useBlobUrl } from '@/audio'
import type { ImageClip } from '@/hooks/use-create-note'
import styles from './ImageComposer.module.css'

interface ImageComposerProps {
  clip: ImageClip | null
  onClipChange: (clip: ImageClip | null) => void
  disabled?: boolean
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'compressing' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function ImageComposer({ clip, onClipChange, disabled }: ImageComposerProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    clip ? { kind: 'ready' } : { kind: 'idle' },
  )
  const [supported, setSupported] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const previewUrl = useBlobUrl(clip?.blob ?? null)

  useEffect(() => {
    setSupported(isImageCompressionSupported())
  }, [])

  useEffect(() => {
    setPhase(clip ? { kind: 'ready' } : { kind: 'idle' })
  }, [clip])

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setPhase({ kind: 'error', message: 'please pick an image file' })
        return
      }
      setPhase({ kind: 'compressing' })
      try {
        const result = await compressToTarget(file, {
          maxBytes: IMAGE_MAX_BYTES,
          maxDimension: IMAGE_MAX_DIMENSION,
        })
        if (result.blob.size > IMAGE_MAX_BYTES) {
          setPhase({
            kind: 'error',
            message:
              `image too large even after compression (${formatBytes(result.blob.size)}). ` +
              `try a smaller or simpler image — max ${formatBytes(IMAGE_MAX_BYTES)}.`,
          })
          return
        }
        onClipChange({
          blob: result.blob,
          mimeCode: 'a',
          width: result.width,
          height: result.height,
        })
      } catch (err) {
        setPhase({
          kind: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'could not read this image — try a different file',
        })
      }
    },
    [onClipChange],
  )

  // Paste-from-clipboard support.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (disabled || clip) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void handleFile(file)
            return
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [disabled, clip, handleFile])

  const handleDiscard = () => {
    onClipChange(null)
    setPhase({ kind: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  if (!supported) {
    return (
      <div className={styles.composer}>
        <p className={styles.errorText}>image compression is not supported in this browser.</p>
      </div>
    )
  }

  if (clip && phase.kind === 'ready') {
    return (
      <div className={styles.composer}>
        <div className={styles.row}>
          <span className={styles.previewLabel}>image ready</span>
          <span className={styles.meta}>
            {clip.width}×{clip.height} · {formatBytes(clip.blob.size)}
          </span>
        </div>
        {previewUrl && (
          <div className={styles.previewFrame}>
            <img
              src={previewUrl}
              alt='preview'
              className={styles.previewImg}
              draggable={false}
            />
          </div>
        )}
        <div className={styles.actions}>
          <button
            type='button'
            className={styles.ghostBtn}
            onClick={handleDiscard}
            disabled={disabled}
          >
            choose different
          </button>
        </div>
        <p className={styles.caveat}>
          images contain your face and surroundings. anyone who reads can screenshot.
        </p>
      </div>
    )
  }

  if (phase.kind === 'compressing') {
    return (
      <div className={styles.composer}>
        <p className={styles.status}>compressing image…</p>
      </div>
    )
  }

  return (
    <div className={styles.composer}>
      <div className={styles.idleBody}>
        <button
          type='button'
          className={styles.pickBtn}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-label='choose image'
        >
          <PickGlyph />
        </button>
        <div className={styles.idleText}>
          <p className={styles.idleTitle}>attach an image</p>
          <p className={styles.idleSub}>
            compressed to AVIF, max {formatBytes(IMAGE_MAX_BYTES)} · you can also paste from clipboard
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      {phase.kind === 'error' && <p className={styles.errorText}>{phase.message}</p>}
    </div>
  )
}

function PickGlyph() {
  return (
    <svg width='22' height='22' viewBox='0 0 22 22' fill='none' aria-hidden='true'>
      <rect
        x='3'
        y='5'
        width='16'
        height='12'
        rx='2'
        stroke='currentColor'
        strokeWidth='1.4'
      />
      <circle cx='8' cy='9' r='1.4' fill='currentColor' />
      <path
        d='M4.5 16 L9 12 L13 15 L16 12 L18.5 15'
        stroke='currentColor'
        strokeWidth='1.4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

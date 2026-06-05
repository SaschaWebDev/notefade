import { useCallback, useEffect, useRef, useState } from 'react'
import {
  compressToTarget,
  isImageCompressionSupported,
  checkFileSize,
  checkSourceImage,
  readImageDimensions,
} from '@/images'
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_IMAGES,
  IMAGE_TIER1_TARGET_BYTES,
  IMAGE_TIER2_TARGET_BYTES,
  IMAGE_TIER1_MAX_DIMENSION,
  IMAGE_TIER2_MAX_DIMENSION,
} from '@/constants'
import { useBlobUrl } from '@/audio'
import type { ImageClip } from '@/hooks/use-create-note'
import styles from './ImageComposer.module.css'

interface ImageComposerProps {
  clips: ImageClip[]
  onClipsChange: (clips: ImageClip[]) => void
  /** Reports whether compression/re-tiering is in flight so the parent can
   * disable note creation meanwhile. */
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'compressing'; current: number; total: number }
  | { kind: 'retiering'; toTier: 1 | 2 }
  | { kind: 'error'; message: string }

interface Tier {
  target: number
  dim: number
  tier: 1 | 2
}

/** Dynamic quality tier: up to 4 images keep full per-image quality; 5-6
 * images drop to a smaller per-image budget so the gallery still fits the
 * total IMAGE_MAX_BYTES. */
function tierFor(count: number): Tier {
  return count <= 4
    ? { target: IMAGE_TIER1_TARGET_BYTES, dim: IMAGE_TIER1_MAX_DIMENSION, tier: 1 }
    : { target: IMAGE_TIER2_TARGET_BYTES, dim: IMAGE_TIER2_MAX_DIMENSION, tier: 2 }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function Thumb({
  clip,
  onRemove,
  disabled,
}: {
  clip: ImageClip
  onRemove: () => void
  disabled?: boolean
}) {
  const url = useBlobUrl(clip.blob)
  return (
    <div className={styles.thumb}>
      {url && (
        <img src={url} alt='attached image' className={styles.thumbImg} draggable={false} />
      )}
      <span className={styles.thumbMeta}>{formatBytes(clip.blob.size)}</span>
      <button
        type='button'
        className={styles.removeBtn}
        onClick={onRemove}
        disabled={disabled}
        aria-label='remove image'
      >
        ×
      </button>
    </div>
  )
}

export function ImageComposer({ clips, onClipsChange, onBusyChange, disabled }: ImageComposerProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [supported, setSupported] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Serializes adds/removes: concurrent file-selects and pastes are ignored
  // while a batch is in flight, so no queue is needed.
  const busyRef = useRef(false)

  const busy = phase.kind === 'compressing' || phase.kind === 'retiering'
  const totalBytes = clips.reduce((sum, c) => sum + c.blob.size, 0)

  useEffect(() => {
    setSupported(isImageCompressionSupported())
  }, [])

  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])

  /** Recompress clips whose blob was encoded at a different tier than the
   * gallery's current count demands. Sources are retained on each clip, so
   * both downgrades (5th image added) and upgrades (removal back to ≤4)
   * re-encode from the original — no generational quality loss. Sequential
   * on purpose: parallel WASM AVIF encodes spike memory on mobile. */
  const retier = useCallback(async (list: ImageClip[], tier: Tier): Promise<ImageClip[]> => {
    const needsWork = list.some((c) => c.tier !== tier.tier && c.source)
    if (!needsWork) return list
    setPhase({ kind: 'retiering', toTier: tier.tier })
    const next: ImageClip[] = []
    for (const c of list) {
      if (c.tier === tier.tier || !c.source) {
        next.push(c)
        continue
      }
      const result = await compressToTarget(c.source, {
        maxBytes: tier.target,
        maxDimension: tier.dim,
      })
      next.push({ ...c, blob: result.blob, width: result.width, height: result.height, tier: tier.tier })
    }
    return next
  }, [])

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (busyRef.current || files.length === 0) return
      const room = IMAGE_MAX_IMAGES - clips.length
      if (room <= 0) {
        setPhase({ kind: 'error', message: `you can attach up to ${IMAGE_MAX_IMAGES} images` })
        return
      }
      busyRef.current = true
      const toProcess = files.slice(0, room)
      let firstError: string | null =
        files.length > toProcess.length
          ? `only adding ${toProcess.length} more — max ${IMAGE_MAX_IMAGES} images`
          : null

      // Compress at the tier the gallery will land on if every file survives;
      // a final retier below corrects for files that get rejected.
      const targetTier = tierFor(clips.length + toProcess.length)
      const added: ImageClip[] = []
      try {
        for (let i = 0; i < toProcess.length; i++) {
          setPhase({ kind: 'compressing', current: i + 1, total: toProcess.length })
          const file = toProcess[i]!
          if (!file.type.startsWith('image/')) {
            firstError ??= 'please pick an image file'
            continue
          }
          const sizeCheck = checkFileSize(file)
          if (!sizeCheck.ok) {
            firstError ??= sizeCheck.reason
            continue
          }
          try {
            const dims = await readImageDimensions(file)
            const check = checkSourceImage(dims)
            if (!check.ok) {
              firstError ??= check.reason
              continue
            }
            const result = await compressToTarget(file, {
              maxBytes: targetTier.target,
              maxDimension: targetTier.dim,
            })
            if (result.blob.size > targetTier.target) {
              firstError ??=
                `image too large even after compression (${formatBytes(result.blob.size)}). ` +
                `try a smaller or simpler image — max ${formatBytes(targetTier.target)} each.`
              continue
            }
            added.push({
              blob: result.blob,
              mimeCode: 'a',
              width: result.width,
              height: result.height,
              source: file,
              tier: targetTier.tier,
            })
          } catch (err) {
            firstError ??=
              err instanceof Error ? err.message : 'could not read this image — try a different file'
          }
        }

        let next = [...clips, ...added]
        try {
          // Recompute against the count that actually materialized (some
          // files may have been rejected) and fix any tier mismatches.
          next = await retier(next, tierFor(next.length))
        } catch {
          firstError ??= 'could not re-optimize images — remove one and try again'
        }
        if (added.length > 0) onClipsChange(next)
        setPhase(firstError ? { kind: 'error', message: firstError } : { kind: 'idle' })
      } finally {
        busyRef.current = false
      }
    },
    [clips, onClipsChange, retier],
  )

  const handleRemove = useCallback(
    async (idx: number) => {
      if (busyRef.current) return
      busyRef.current = true
      try {
        let remaining = clips.filter((_, i) => i !== idx)
        if (remaining.length > 0) {
          try {
            // Dropping back to ≤4 restores full per-image quality.
            remaining = await retier(remaining, tierFor(remaining.length))
          } catch {
            // Keep current encodes — still within budget, just lower tier.
          }
        }
        onClipsChange(remaining)
        setPhase({ kind: 'idle' })
      } finally {
        busyRef.current = false
      }
    },
    [clips, onClipsChange, retier],
  )

  // Paste-from-clipboard support — appends while there's room.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (disabled || busyRef.current || clips.length >= IMAGE_MAX_IMAGES) return
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        void handleFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [disabled, clips.length, handleFiles])

  const openPicker = () => inputRef.current?.click()

  if (!supported) {
    return (
      <div className={styles.composer}>
        <p className={styles.errorText}>image compression is not supported in this browser.</p>
      </div>
    )
  }

  const showIdle = clips.length === 0 && !busy

  return (
    <div className={styles.composer}>
      {showIdle ? (
        <div className={styles.idleBody}>
          <button
            type='button'
            className={styles.pickBtn}
            onClick={openPicker}
            disabled={disabled}
            aria-label='choose images'
          >
            <PickGlyph />
          </button>
          <div className={styles.idleText}>
            <p className={styles.idleTitle}>attach images</p>
            <p className={styles.idleSub}>
              up to {IMAGE_MAX_IMAGES} images, compressed to AVIF, max {formatBytes(IMAGE_MAX_BYTES)} total
              · you can also paste from clipboard
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.row}>
            <span className={styles.previewLabel}>
              {clips.length === 1 ? 'image ready' : 'images ready'}
            </span>
            <span className={styles.meta}>
              {clips.length}/{IMAGE_MAX_IMAGES} images · {formatBytes(totalBytes)} /{' '}
              {formatBytes(IMAGE_MAX_BYTES)}
            </span>
          </div>
          <div className={styles.grid}>
            {clips.map((clip, i) => (
              <Thumb key={i} clip={clip} onRemove={() => void handleRemove(i)} disabled={disabled || busy} />
            ))}
            {clips.length < IMAGE_MAX_IMAGES && !busy && (
              <button
                type='button'
                className={styles.addTile}
                onClick={openPicker}
                disabled={disabled}
                aria-label='add another image'
              >
                +
              </button>
            )}
          </div>
          {clips.length > 0 && (
            <p className={styles.caveat}>
              images contain your face and surroundings. anyone who reads can screenshot.
            </p>
          )}
        </>
      )}
      {phase.kind === 'compressing' && (
        <p className={styles.status}>
          compressing image {phase.current}/{phase.total}…
        </p>
      )}
      {phase.kind === 'retiering' && (
        <p className={styles.status}>
          {phase.toTier === 2 ? 're-optimizing for 5+ images…' : 'restoring full image quality…'}
        </p>
      )}
      {phase.kind === 'error' && <p className={styles.errorText}>{phase.message}</p>}
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) void handleFiles(files)
          e.target.value = ''
        }}
        style={{ display: 'none' }}
        disabled={disabled}
      />
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

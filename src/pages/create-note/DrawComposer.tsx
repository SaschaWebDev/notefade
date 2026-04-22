import { useCallback, useEffect, useRef, useState } from 'react'
import { compressToTarget, isImageCompressionSupported } from '@/images'
import { IMAGE_MAX_BYTES, IMAGE_MAX_DIMENSION } from '@/constants'
import { useBlobUrl } from '@/audio'
import type { ImageClip } from '@/hooks/use-create-note'
import styles from './DrawComposer.module.css'

interface DrawComposerProps {
  clip: ImageClip | null
  onClipChange: (clip: ImageClip | null) => void
  disabled?: boolean
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

const PALETTE = [
  '#000000', // black
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ffffff', // white (doubles as eraser)
] as const

type Tool = 'brush' | 'eraser'

type Phase =
  | { kind: 'idle' }
  | { kind: 'compressing' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  return `${(b / 1024).toFixed(1)} KB`
}

export function DrawComposer({ clip, onClipChange, disabled }: DrawComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const drawingRef = useRef(false)

  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState<string>('#000000')
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff')
  const [brushSize, setBrushSize] = useState<number>(4)
  const [phase, setPhase] = useState<Phase>(() =>
    clip ? { kind: 'ready' } : { kind: 'idle' },
  )
  const [supported, setSupported] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const previewUrl = useBlobUrl(clip?.blob ?? null)

  useEffect(() => {
    setSupported(isImageCompressionSupported())
  }, [])

  const fillCanvasBackground = useCallback((bg: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Initialize canvas with the current background color on mount.
  // Intentionally runs once — changes to backgroundColor are handled via the
  // setter's explicit canvas repaint + stroke reset.
  useEffect(() => {
    fillCanvasBackground(backgroundColor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When a clip arrives externally (e.g. from resetNote), sync phase.
  useEffect(() => {
    if (clip) setPhase({ kind: 'ready' })
  }, [clip])

  const handleBackgroundChange = (next: string) => {
    if (next === backgroundColor) return
    setBackgroundColor(next)
    fillCanvasBackground(next)
    setHasStrokes(false)
    if (clip) {
      onClipChange(null)
      setPhase({ kind: 'idle' })
    }
  }

  const strokeColor = tool === 'eraser' ? backgroundColor : color

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  const drawDot = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = strokeColor
    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawSegment = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const p = pointerPos(e)
    lastPointRef.current = p
    drawDot(ctx, p.x, p.y) // paint a dot on click so single taps still leave a mark
    setHasStrokes(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const p = pointerPos(e)
    const last = lastPointRef.current
    if (last) drawSegment(ctx, last, p)
    lastPointRef.current = p
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId)
    }
  }

  const handleClear = () => {
    fillCanvasBackground(backgroundColor)
    setHasStrokes(false)
    if (clip) {
      onClipChange(null)
      setPhase({ kind: 'idle' })
    }
  }

  const handleUse = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setPhase({ kind: 'compressing' })

    // Flatten onto an explicitly opaque background before export. Even though
    // the main canvas is already filled with backgroundColor, encoders
    // downstream (AVIF) treat alpha channels independently — so we compose
    // onto a fresh context to guarantee the PNG (and thus the AVIF) carries
    // only RGB data and the receiver sees exactly the chosen bg color.
    const flat = document.createElement('canvas')
    flat.width = canvas.width
    flat.height = canvas.height
    const flatCtx = flat.getContext('2d', { alpha: false })
    if (!flatCtx) {
      setPhase({ kind: 'error', message: 'could not prepare canvas for export' })
      return
    }
    flatCtx.fillStyle = backgroundColor
    flatCtx.fillRect(0, 0, flat.width, flat.height)
    flatCtx.drawImage(canvas, 0, 0)

    const blob: Blob | null = await new Promise((resolve) => {
      flat.toBlob((b) => resolve(b), 'image/png')
    })
    if (!blob) {
      setPhase({ kind: 'error', message: 'could not capture the canvas — try again' })
      return
    }
    try {
      const result = await compressToTarget(blob, {
        maxBytes: IMAGE_MAX_BYTES,
        maxDimension: IMAGE_MAX_DIMENSION,
      })
      if (result.blob.size > IMAGE_MAX_BYTES) {
        setPhase({
          kind: 'error',
          message:
            `drawing still too large after compression (${formatBytes(result.blob.size)}). try using fewer strokes or simpler colors.`,
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
            : 'could not compress the drawing',
      })
    }
  }, [onClipChange, backgroundColor])

  const handleReturnToCanvas = () => {
    onClipChange(null)
    setPhase({ kind: 'idle' })
  }

  if (!supported) {
    return (
      <div className={styles.composer}>
        <p className={styles.errorText}>
          drawing requires browser features not available here.
        </p>
      </div>
    )
  }

  if (clip && phase.kind === 'ready') {
    return (
      <div className={styles.composer}>
        <div className={styles.row}>
          <span className={styles.previewLabel}>drawing ready</span>
          <span className={styles.meta}>
            {clip.width}×{clip.height} · {formatBytes(clip.blob.size)}
          </span>
        </div>
        {previewUrl && (
          <div className={styles.previewFrame}>
            <img
              src={previewUrl}
              alt='drawing preview'
              className={styles.previewImg}
              draggable={false}
            />
          </div>
        )}
        <div className={styles.actions}>
          <button
            type='button'
            className={styles.ghostBtn}
            onClick={handleReturnToCanvas}
            disabled={disabled}
          >
            keep drawing
          </button>
        </div>
        <p className={styles.caveat}>
          drawings encrypt the same way as images — short, low-res, one-time read.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.composer}>
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
        />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            type='button'
            className={`${styles.toolBtn} ${tool === 'brush' ? styles.toolBtnActive : ''}`}
            onClick={() => setTool('brush')}
            title='brush'
            disabled={disabled}
          >
            brush
          </button>
          <button
            type='button'
            className={`${styles.toolBtn} ${tool === 'eraser' ? styles.toolBtnActive : ''}`}
            onClick={() => setTool('eraser')}
            title='eraser'
            disabled={disabled}
          >
            eraser
          </button>
        </div>

        <div className={styles.palette} aria-label='color palette'>
          {PALETTE.map((c) => (
            <button
              key={c}
              type='button'
              className={`${styles.swatch} ${color === c && tool === 'brush' ? styles.swatchActive : ''}`}
              style={{ background: c }}
              onClick={() => {
                setColor(c)
                setTool('brush')
              }}
              aria-label={`pick color ${c}`}
              disabled={disabled}
            />
          ))}
          <label className={styles.customColorLabel} title='custom color'>
            <input
              type='color'
              value={color}
              onChange={(e) => {
                setColor(e.target.value)
                setTool('brush')
              }}
              className={styles.customColorInput}
              disabled={disabled}
            />
            <span
              className={styles.customColorSwatch}
              style={{ background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` }}
            />
          </label>
        </div>

        <div className={styles.bgGroup}>
          <span className={styles.bgLabel}>bg</span>
          <label
            className={styles.bgSwatchLabel}
            title='background color · changing clears the canvas'
          >
            <input
              type='color'
              value={backgroundColor}
              onChange={(e) => handleBackgroundChange(e.target.value)}
              className={styles.bgSwatchInput}
              disabled={disabled}
              aria-label='background color'
            />
            <span className={styles.bgSwatchVisual} style={{ background: backgroundColor }} />
          </label>
        </div>

        <div className={styles.sizeGroup}>
          <span className={styles.sizeLabel}>size</span>
          <input
            type='range'
            min={2}
            max={24}
            step={1}
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
            className={styles.sizeSlider}
            disabled={disabled}
            aria-label='brush size'
          />
          <span className={styles.sizeValue}>{brushSize}px</span>
        </div>

        <div className={styles.actions}>
          <button
            type='button'
            className={styles.ghostBtn}
            onClick={handleClear}
            disabled={disabled || (!hasStrokes && !clip)}
          >
            clear
          </button>
          <button
            type='button'
            className={styles.primaryBtn}
            onClick={handleUse}
            disabled={disabled || !hasStrokes || phase.kind === 'compressing'}
          >
            {phase.kind === 'compressing' ? 'compressing…' : 'use this drawing'}
          </button>
        </div>
      </div>

      {phase.kind === 'error' && <p className={styles.errorText}>{phase.message}</p>}
    </div>
  )
}

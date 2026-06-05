import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBlobUrl } from '@/audio'
import styles from './ImageViewer.module.css'

interface ImageViewerProps {
  blob: Blob | null
}

export function ImageViewer({ blob }: ImageViewerProps) {
  const url = useBlobUrl(blob)
  const [expanded, setExpanded] = useState(false)

  // Escape closes; body scroll is locked while the overlay is open.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [expanded])

  if (!url) return null

  const close = () => setExpanded(false)

  return (
    <>
      <button
        type='button'
        className={styles.frame}
        onClick={() => setExpanded(true)}
        aria-label='view image full screen'
      >
        <img src={url} alt='decrypted note' className={styles.img} draggable={false} />
      </button>
      {expanded &&
        createPortal(
          // Portal to <body> so the fixed overlay escapes any ancestor
          // stacking contexts (the read view fades via ContentFade opacity).
          <div
            className={styles.overlay}
            onClick={close}
            role='dialog'
            aria-modal='true'
            aria-label='full screen image view'
          >
            <button
              type='button'
              className={styles.overlayClose}
              onClick={close}
              aria-label='close full screen view'
            >
              <CloseGlyph />
            </button>
            <img
              src={url}
              alt='decrypted note'
              className={styles.overlayImg}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </>
  )
}

function CloseGlyph() {
  return (
    <svg width='20' height='20' viewBox='0 0 20 20' fill='none' aria-hidden='true'>
      <path
        d='M5 5 L15 15 M15 5 L5 15'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
      />
    </svg>
  )
}

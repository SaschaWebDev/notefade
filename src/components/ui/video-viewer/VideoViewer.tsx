import { useBlobUrl } from '@/audio'
import styles from './VideoViewer.module.css'

interface VideoViewerProps {
  blob: Blob | null
  durationMs?: number
}

export function VideoViewer({ blob }: VideoViewerProps) {
  const url = useBlobUrl(blob)
  if (!url) return null
  return (
    <div className={styles.frame}>
      <video src={url} controls playsInline className={styles.video} />
    </div>
  )
}

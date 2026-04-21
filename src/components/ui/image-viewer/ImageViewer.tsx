import { useBlobUrl } from '@/audio'
import styles from './ImageViewer.module.css'

interface ImageViewerProps {
  blob: Blob | null
}

export function ImageViewer({ blob }: ImageViewerProps) {
  const url = useBlobUrl(blob)
  if (!url) return null
  return (
    <div className={styles.frame}>
      <img src={url} alt='decrypted note' className={styles.img} draggable={false} />
    </div>
  )
}

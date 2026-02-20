import { useReadNote } from '@/hooks/use-read-note'
import { NoteGone } from './NoteGone'
import styles from './ReadNote.module.css'

interface ReadNoteProps {
  shardId: string
  urlPayload: string
}

export function ReadNote({ shardId, urlPayload }: ReadNoteProps) {
  const { state } = useReadNote(shardId, urlPayload)
  const pathname = window.location.pathname

  if (state.status === 'loading') {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span className={styles.loadingText}>decrypting...</span>
      </div>
    )
  }

  if (state.status === 'gone') {
    return <NoteGone />
  }

  if (state.status === 'error') {
    return (
      <div className={styles.container}>
        <div className={styles.errorIcon}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="rgba(248,113,113,0.12)" />
            <path
              d="M10 6v5M10 13.5v.5"
              stroke="#f87171"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className={styles.errorMessage}>{state.message}</p>
        <a href={pathname} className={styles.newLink}>
          create a note
        </a>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.heading}>decrypted note</h2>
        <span className={styles.badge}>read once</span>
      </div>

      <div className={styles.noteContent}>{state.plaintext}</div>

      <div className={styles.footer}>
        <p className={styles.destroyNotice}>
          this note has been read and permanently deleted from the server
        </p>
        <a href={pathname} className={styles.newLink}>
          create your own
        </a>
      </div>
    </div>
  )
}

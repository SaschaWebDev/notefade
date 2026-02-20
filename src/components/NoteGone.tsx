import styles from './NoteGone.module.css'

export function NoteGone() {
  const pathname = window.location.pathname

  return (
    <div className={styles.container}>
      <div className={styles.iconRow}>
        <span className={styles.goneIcon}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.05)" />
            <path
              d="M7 7l6 6M13 7l-6 6"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>

      <h2 className={styles.heading}>gone</h2>
      <p className={styles.subheading}>
        this note has been read and permanently deleted
      </p>

      <div className={styles.divider} />

      <a href={pathname} className={styles.newLink}>
        create a note
      </a>
    </div>
  )
}

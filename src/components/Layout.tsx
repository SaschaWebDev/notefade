import { type ReactNode, useCallback } from 'react'
import styles from './Layout.module.css'

const PILLS = [
  { label: 'AES-256 encrypted', sectionId: 'encryption' },
  { label: 'zero knowledge', sectionId: 'zero-knowledge' },
  { label: 'one-time read', sectionId: 'one-time-read' },
  { label: 'auto-expiring', sectionId: 'auto-expiring' },
] as const

interface LayoutProps {
  children: ReactNode
  isDocs?: boolean
}

export function Layout({ children, isDocs }: LayoutProps) {
  const handleLogoClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      window.location.href = '/'
    },
    [],
  )

  const handlePillClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      if (!isDocs) return
      e.preventDefault()
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    },
    [isDocs],
  )

  return (
    <div className={styles.backdrop}>
      <div className={styles.dotGrid} />

      <div className={`${styles.center} ${isDocs ? styles.centerDocs : ''}`}>
        <header className={styles.header}>
          <a href="/" onClick={handleLogoClick} className={styles.logo}>
            notefade
          </a>
          <p className={styles.tagline}>private notes that vanish</p>
        </header>

        <div className={`${styles.palette} ${isDocs ? styles.paletteDocs : ''}`}>
          {children}
        </div>

        <div className={styles.pills}>
          {PILLS.map(({ label, sectionId }) => (
            <a
              key={sectionId}
              href={`/docs#${sectionId}`}
              className={styles.pill}
              onClick={(e) => handlePillClick(e, sectionId)}
            >
              {label}
            </a>
          ))}
        </div>

        <p className={styles.hint}>end-to-end encrypted in your browser</p>
      </div>
    </div>
  )
}

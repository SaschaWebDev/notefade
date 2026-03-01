import { type ReactNode, useCallback } from 'react'
import { useTheme } from '@/hooks'
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
  const { theme, toggleTheme } = useTheme()
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
    <main className={`${styles.backdrop} ${isDocs ? styles.backdropDocs : ''}`}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggleTheme}
        title={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
        aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
      >
        {theme === 'dark' ? (
          <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
            <circle cx='8' cy='8' r='3.5' stroke='currentColor' strokeWidth='1.3' />
            <path d='M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1' stroke='currentColor' strokeWidth='1.3' strokeLinecap='round' />
          </svg>
        ) : (
          <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
            <path d='M13.5 9.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z' stroke='currentColor' strokeWidth='1.3' strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        )}
      </button>
      <div className={styles.dotGrid} />

      <div className={`${styles.center} ${isDocs ? styles.centerDocs : ''}`}>
        <header className={styles.header}>
          <a href="/" onClick={handleLogoClick} className={styles.logo}>
            notefade
          </a>
          {isDocs ? (
            <p className={styles.tagline}>private notes that <span className={styles.fade}>fade</span></p>
          ) : (
            <h1 className={styles.tagline}>private notes that <span className={styles.fade}>fade</span></h1>
          )}
        </header>

        <div className={`${styles.palette} ${isDocs ? styles.paletteDocs : ''}`}>
          {children}
        </div>

        {!isDocs && (
          <>
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

            <p className={styles.hint}>encrypted entirely in your browser</p>
          </>
        )}
      </div>
    </main>
  )
}

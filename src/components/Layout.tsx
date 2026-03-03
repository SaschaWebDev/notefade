import { type ReactNode, useCallback } from 'react'
import { useTheme } from '@/hooks'
import styles from './Layout.module.css'

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
            <circle cx='8' cy='8' r='3' fill='currentColor' />
            <line x1='8' y1='1' x2='8' y2='3' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
            <line x1='8' y1='13' x2='8' y2='15' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
            <line x1='1' y1='8' x2='3' y2='8' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
            <line x1='13' y1='8' x2='15' y2='8' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
            <line x1='3.05' y1='3.05' x2='4.46' y2='4.46' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
            <line x1='11.54' y1='11.54' x2='12.95' y2='12.95' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
            <line x1='3.05' y1='12.95' x2='4.46' y2='11.54' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
            <line x1='11.54' y1='4.46' x2='12.95' y2='3.05' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
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

      </div>
    </main>
  )
}

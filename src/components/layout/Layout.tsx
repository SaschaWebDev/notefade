import { type ReactNode, useCallback } from 'react'
import { useTheme } from '@/hooks'
import { IconSun, IconMoon, IconDocs } from '../ui/icons'
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
      <a
        href="/docs"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.docsLink}
        title="documentation"
        aria-label="documentation"
      >
        <IconDocs />
      </a>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggleTheme}
        title={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
        aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
      >
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
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

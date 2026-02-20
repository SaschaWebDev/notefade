import { useState, useCallback } from 'react'
import styles from './NoteLink.module.css'

interface NoteLinkProps {
  url: string
  onCreateAnother: () => void
}

export function NoteLink({ url, onCreateAnother }: NoteLinkProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }, [url])

  const pathname = window.location.pathname

  return (
    <div className={styles.container}>
      <div className={styles.iconRow}>
        <span className={styles.checkIcon}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="rgba(79,143,247,0.12)" />
            <path
              d="M6 10.5L8.5 13L14 7.5"
              stroke="#4f8ff7"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <h2 className={styles.heading}>encrypted link ready</h2>
      <p className={styles.description}>
        share this link — it works exactly once
      </p>

      <div className={styles.linkBox}>
        <span className={styles.linkText}>{url}</span>
      </div>

      <button
        type="button"
        className={`${styles.copyButton} ${copied ? styles.copyButtonCopied : ''}`}
        onClick={handleCopy}
      >
        {copied ? 'copied' : 'copy link'}
      </button>

      <a
        href={pathname}
        className={styles.anotherLink}
        onClick={(e) => {
          e.preventDefault()
          onCreateAnother()
        }}
      >
        create another
      </a>
    </div>
  )
}

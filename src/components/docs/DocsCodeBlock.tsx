import { useState, useCallback } from 'react'
import styles from './DocsCodeBlock.module.css'

interface DocsCodeBlockProps {
  code: string
  language?: string
}

export function DocsCodeBlock({ code, language }: DocsCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [code])

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        {language && <span className={styles.language}>{language}</span>}
        <button className={styles.copyBtn} onClick={handleCopy} type="button">
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className={styles.pre}>
        <code className={styles.code}>{code}</code>
      </pre>
    </div>
  )
}

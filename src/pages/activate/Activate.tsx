import { useState, useCallback } from 'react'
import { activateShard } from '@/api'
import type { LaunchCode } from '@/hooks/use-create-note'
import { COPY_FEEDBACK_MS } from '@/constants'
import { IconCheckCircle } from '../../ui/icons'
import styles from './Activate.module.css'

function validateLaunchCode(data: unknown): data is LaunchCode {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.token === 'string' && obj.token.length > 0 &&
    typeof obj.fragment === 'string' && obj.fragment.length > 0
  )
}

export function Activate() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteUrl, setNoteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleActivate = useCallback(async () => {
    setError(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(input.trim())
    } catch {
      setError('Invalid JSON. Paste the launch code JSON or drop the .json file.')
      return
    }

    if (!validateLaunchCode(parsed)) {
      setError('Invalid launch code. Expected token and fragment fields.')
      return
    }

    setLoading(true)
    try {
      await activateShard(parsed.token)
      const url = `${window.location.origin}/#${parsed.fragment}`
      setNoteUrl(url)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Activation failed: ${err.message}`
          : 'Activation failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }, [input])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setInput(reader.result)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleCopy = useCallback(() => {
    if (!noteUrl) return
    navigator.clipboard.writeText(noteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }, [noteUrl])

  if (noteUrl) {
    return (
      <div className={styles.successContainer}>
        <div className={styles.successIcon}>
          <IconCheckCircle />
        </div>
        <h2 className={styles.successHeading}>note activated</h2>
        <p className={styles.successDesc}>
          the shard has been uploaded. the note link is now live.
        </p>
        <div className={styles.urlBox} onClick={handleCopy}>
          {noteUrl}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={handleCopy}>
            {copied ? 'copied' : 'copy link'}
          </button>
          <a href="/" className={styles.actionBtn}>
            create another
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>activate a deferred note</h2>
      <p className={styles.desc}>
        paste the launch code JSON you received when creating a deferred note,
        or drop the <code>.json</code> file below.
      </p>
      <div
        className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <textarea
          className={styles.textarea}
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null) }}
          placeholder='{"token":"...","fragment":"..."}'
          spellCheck={false}
        />
      </div>
      <p className={styles.dropHint}>or drag and drop a .json file</p>
      <p className={styles.dropHint}>tokens expire 30 days after creation. if activation fails, the token may have expired.</p>
      {error && <p className={styles.error}>{error}</p>}
      <button
        type="button"
        className={styles.activateBtn}
        disabled={loading || input.trim().length === 0}
        onClick={handleActivate}
      >
        {loading ? 'activating...' : 'activate'}
      </button>
    </div>
  )
}

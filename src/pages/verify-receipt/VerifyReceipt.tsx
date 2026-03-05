import { useState, useCallback, useEffect } from 'react'
import { verifyReceiptProof } from '@/crypto'
import { IconCheckCircle, IconXCircleOutlined } from '@/components/ui/icons'
import styles from './VerifyReceipt.module.css'

interface ReceiptData {
  plaintext: string
  receiptSeed: string
}

function validateReceipt(data: unknown): data is ReceiptData {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.plaintext === 'string' && obj.plaintext.length > 0 &&
    typeof obj.receiptSeed === 'string' && obj.receiptSeed.length > 0
  )
}

type Result = { kind: 'verified' } | { kind: 'failed' }

export function VerifyReceipt() {
  useEffect(() => {
    document.title = 'verify read receipt — notefade'
    const meta = document.querySelector('meta[name="description"]')
    const prev = meta?.getAttribute('content') ?? ''
    if (meta) {
      meta.setAttribute('content', 'Verify a cryptographic proof-of-read receipt for a notefade note. HMAC-based verification without knowing who read it.')
    }
    return () => {
      document.title = 'notefade — Self-Destructing Encrypted Notes'
      if (meta) meta.setAttribute('content', prev)
    }
  }, [])

  const [receiptInput, setReceiptInput] = useState('')
  const [proofInput, setProofInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleVerify = useCallback(async () => {
    setError(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(receiptInput.trim())
    } catch {
      setError('Invalid JSON. Paste the receipt JSON or drop the .json file.')
      return
    }

    if (!validateReceipt(parsed)) {
      setError('Invalid receipt. Expected plaintext and receiptSeed fields.')
      return
    }

    const proof = proofInput.trim()
    if (proof.length === 0) {
      setError('Paste the proof string from the reader.')
      return
    }

    setLoading(true)
    try {
      const valid = await verifyReceiptProof(parsed.receiptSeed, parsed.plaintext, proof)
      setResult(valid ? { kind: 'verified' } : { kind: 'failed' })
    } catch {
      setError('Verification error. Check that the receipt and proof are valid.')
    } finally {
      setLoading(false)
    }
  }, [receiptInput, proofInput])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptInput(reader.result)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleReset = useCallback(() => {
    setReceiptInput('')
    setProofInput('')
    setError(null)
    setResult(null)
  }, [])

  if (result?.kind === 'verified') {
    return (
      <div className={styles.successContainer}>
        <div className={styles.successIcon}>
          <IconCheckCircle />
        </div>
        <h2 className={styles.successHeading}>receipt verified</h2>
        <p className={styles.successDesc}>
          the proof matches. the reader had access to the original note.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={handleReset}>
            verify another
          </button>
          <a href="/" className={styles.actionBtnPrimary}>
            back to main
          </a>
        </div>
      </div>
    )
  }

  if (result?.kind === 'failed') {
    return (
      <div className={styles.failContainer}>
        <div className={styles.failIcon}>
          <IconXCircleOutlined />
        </div>
        <h2 className={styles.failHeading}>verification failed</h2>
        <p className={styles.failDesc}>
          the proof does not match. the reader may not have seen the original note.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={handleReset}>
            try again
          </button>
          <a href="/" className={styles.actionBtnPrimary}>
            back to main
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>verify a read receipt</h2>
      <p className={styles.desc}>
        paste the writer's receipt JSON (downloaded when creating the note),
        then paste the proof string the reader shared with you.
      </p>

      <p className={styles.label}>receipt</p>
      <div
        className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <textarea
          className={styles.textarea}
          value={receiptInput}
          onChange={(e) => { setReceiptInput(e.target.value); setError(null) }}
          placeholder={'the writer\'s receipt:\n{"plaintext":"...","receiptSeed":"..."}'}
          spellCheck={false}
        />
      </div>
      <p className={styles.dropHint}>or drag and drop a .json file</p>

      <p className={styles.label}>proof string</p>
      <input
        type="text"
        className={styles.proofInput}
        value={proofInput}
        onChange={(e) => { setProofInput(e.target.value); setError(null) }}
        placeholder="paste the reader's proof here"
        spellCheck={false}
      />

      {error && <p className={styles.error}>{error}</p>}
      <button
        type="button"
        className={styles.verifyBtn}
        disabled={loading || receiptInput.trim().length === 0 || proofInput.trim().length === 0}
        onClick={handleVerify}
      >
        {loading ? 'verifying...' : 'verify'}
      </button>
    </div>
  )
}

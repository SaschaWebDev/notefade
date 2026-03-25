import { useState, useEffect, useCallback } from 'react'
import { encrypt, toBase64Url } from '@/crypto'
import { COPY_FEEDBACK_MS } from '@/constants'
import { IconCheck, IconClipboard } from '@/components/ui/icons'
import styles from './Encrypt.module.css'

export function Encrypt() {
  useEffect(() => {
    document.title = 'encrypt content — notefade'
    const meta = document.querySelector('meta[name="description"]')
    const prev = meta?.getAttribute('content') ?? ''
    if (meta) {
      meta.setAttribute('content', 'Encrypt text locally with AES-256-GCM for use with bring-your-own-key notes. Nothing leaves your browser.')
    }
    return () => {
      document.title = 'notefade — Self-Destructing Encrypted Notes'
      if (meta) meta.setAttribute('content', prev)
    }
  }, [])

  const [plaintext, setPlaintext] = useState('')
  const [ciphertextB64, setCiphertextB64] = useState<string | null>(null)
  const [keyB64, setKeyB64] = useState<string | null>(null)
  const [ctCopied, setCtCopied] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)

  const handleEncrypt = useCallback(async () => {
    if (!plaintext.trim()) return

    const { ciphertext, iv, key } = await encrypt(plaintext)

    // BYOK blob format: IV (12 bytes) || ciphertext (includes GCM tag)
    const blob = new Uint8Array(iv.length + ciphertext.length)
    blob.set(iv, 0)
    blob.set(ciphertext, iv.length)

    setCiphertextB64(toBase64Url(blob))
    setKeyB64(toBase64Url(key))
  }, [plaintext])

  const handleReset = () => {
    setPlaintext('')
    setCiphertextB64(null)
    setKeyB64(null)
  }

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const input = document.createElement('input')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setter(true)
    setTimeout(() => setter(false), COPY_FEEDBACK_MS)
  }

  if (ciphertextB64 && keyB64) {
    return (
      <div className={styles.container}>
        <h2 className={styles.heading}>encrypted</h2>
        <p className={styles.desc}>
          copy both values below — you will need them to create a BYOK note
        </p>

        <div className={styles.resultSection}>
          <span className={styles.resultLabel}>encrypted content</span>
          <div className={styles.resultBox}>
            <textarea
              className={styles.resultTextarea}
              value={ciphertextB64}
              readOnly
              rows={4}
            />
            <button
              type='button'
              className={styles.copyBtn}
              onClick={() => handleCopy(ciphertextB64, setCtCopied)}
              title={ctCopied ? 'copied' : 'copy ciphertext'}
            >
              {ctCopied ? <IconCheck size={14} /> : <IconClipboard size={14} />}
            </button>
          </div>

          <span className={styles.resultLabel}>decryption key</span>
          <div className={styles.resultBox}>
            <input
              className={styles.resultInput}
              value={keyB64}
              readOnly
            />
            <button
              type='button'
              className={styles.copyBtn}
              onClick={() => handleCopy(keyB64, setKeyCopied)}
              title={keyCopied ? 'copied' : 'copy key'}
            >
              {keyCopied ? <IconCheck size={14} /> : <IconClipboard size={14} />}
            </button>
          </div>

          <p className={styles.hint}>
            paste the encrypted content as your note message, then add the key
            via the gear icon on the note link page
          </p>
        </div>

        <div className={styles.actions}>
          <button type='button' className={styles.actionBtn} onClick={handleReset}>
            start over
          </button>
          <a href='/' className={styles.actionBtn}>
            create note
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>encrypt content locally</h2>
      <p className={styles.desc}>
        your text never leaves this browser — encrypt for use with
        bring-your-own-key notes
      </p>

      <textarea
        className={styles.textarea}
        value={plaintext}
        onChange={(e) => setPlaintext(e.target.value)}
        placeholder='enter text to encrypt...'
        autoFocus
        spellCheck={false}
      />

      <button
        type='button'
        className={styles.encryptBtn}
        disabled={!plaintext.trim()}
        onClick={handleEncrypt}
      >
        encrypt
      </button>
    </div>
  )
}

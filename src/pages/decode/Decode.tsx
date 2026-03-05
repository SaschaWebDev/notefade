import { useState, useRef, useCallback, useEffect } from 'react'
import { decodeImageStego, decodeZeroWidth } from '@/crypto'
import { COPY_FEEDBACK_MS } from '@/constants'
import { IconImagePlaceholder } from '@/components/ui/icons'
import styles from './Decode.module.css'

const URL_DISPLAY_TRUNCATE = 100

type DecodeState =
  | { status: 'idle' }
  | { status: 'decoding' }
  | { status: 'success'; url: string }
  | { status: 'error'; message: string }

type Mode = 'image' | 'text'

export function Decode() {
  useEffect(() => {
    document.title = 'decode steganography — notefade'
    const meta = document.querySelector('meta[name="description"]')
    const prev = meta?.getAttribute('content') ?? ''
    if (meta) {
      meta.setAttribute('content', 'Extract a hidden notefade link from an image or text. Supports LSB image steganography and zero-width Unicode decoding.')
    }
    return () => {
      document.title = 'notefade — Self-Destructing Encrypted Notes'
      if (meta) meta.setAttribute('content', prev)
    }
  }, [])

  const [mode, setMode] = useState<Mode>('image')
  const [state, setState] = useState<DecodeState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [textInput, setTextInput] = useState('')

  const reset = useCallback(() => {
    setState({ status: 'idle' })
    setCopied(false)
    setTextInput('')
  }, [])

  const switchMode = useCallback((next: Mode) => {
    setMode(next)
    setState({ status: 'idle' })
    setCopied(false)
    setTextInput('')
  }, [])

  const decodeFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setState({ status: 'error', message: 'please upload an image file' })
      return
    }

    setState({ status: 'decoding' })

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setState({ status: 'error', message: 'failed to process image' })
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const result = decodeImageStego(imageData)
      if (result) {
        setState({ status: 'success', url: result })
      } else {
        setState({ status: 'error', message: 'no hidden data found in this image' })
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setState({ status: 'error', message: 'failed to load image' })
    }

    img.src = objectUrl
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) decodeFile(file)
    },
    [decodeFile],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) decodeFile(file)
      e.target.value = ''
    },
    [decodeFile],
  )

  const handleTextDecode = useCallback(() => {
    if (!textInput.trim()) {
      setState({ status: 'error', message: 'paste some text first' })
      return
    }

    const result = decodeZeroWidth(textInput)
    if (result) {
      setState({ status: 'success', url: result })
    } else {
      setState({ status: 'error', message: 'no hidden data found in this text' })
    }
  }, [textInput])

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>decode steganography</h2>
      <p className={styles.desc}>
        extract a hidden link from an image or text.
      </p>

      <div className={styles.tabs}>
        <button
          type='button'
          className={`${styles.tab} ${mode === 'image' ? styles.tabActive : ''}`}
          onClick={() => switchMode('image')}
        >
          image
        </button>
        <button
          type='button'
          className={`${styles.tab} ${mode === 'text' ? styles.tabActive : ''}`}
          onClick={() => switchMode('text')}
        >
          text
        </button>
      </div>

      {mode === 'image' && (
        <div
          className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role='button'
          tabIndex={0}
        >
          <input
            ref={inputRef}
            type='file'
            accept='image/*'
            className={styles.fileInput}
            onChange={handleFileChange}
          />
          <IconImagePlaceholder className={styles.dropIcon} />
          <span className={styles.dropText}>
            {state.status === 'decoding' ? 'decoding...' : 'drop an image or click to upload'}
          </span>
        </div>
      )}

      {mode === 'text' && (
        <>
          <textarea
            className={styles.textarea}
            value={textInput}
            onChange={(e) => { setTextInput(e.target.value); setState({ status: 'idle' }) }}
            placeholder='paste text containing hidden zero-width characters...'
            spellCheck={false}
          />
          <button
            type='button'
            className={styles.decodeBtn}
            disabled={textInput.trim().length === 0}
            onClick={handleTextDecode}
          >
            decode
          </button>
        </>
      )}

      {state.status === 'success' && (
        <div className={styles.result}>
          <span className={styles.resultLabel}>hidden link found</span>
          <a
            href={state.url}
            className={styles.resultLink}
            target='_blank'
            rel='noopener noreferrer'
          >
            {state.url.length > URL_DISPLAY_TRUNCATE ? state.url.slice(0, URL_DISPLAY_TRUNCATE) + '...' : state.url}
          </a>
          <div className={styles.actions}>
            <button
              type='button'
              className={styles.copyBtn}
              onClick={() => {
                if (state.status === 'success') {
                  navigator.clipboard.writeText(state.url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
                }
              }}
            >
              {copied ? 'copied' : 'copy link'}
            </button>
            <a href={state.url} className={styles.openBtn} target='_blank' rel='noopener noreferrer'>
              open link
            </a>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className={styles.error}>
          {state.message}
        </div>
      )}

      <div className={styles.actions}>
        {(state.status === 'success' || state.status === 'error') && (
          <button
            type='button'
            className={styles.actionBtn}
            onClick={reset}
          >
            try again
          </button>
        )}
        <a href='/' className={styles.actionBtnPrimary}>
          back to main
        </a>
      </div>
    </div>
  )
}

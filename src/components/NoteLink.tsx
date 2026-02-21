import { useState, useCallback } from 'react'
import styles from './NoteLink.module.css'

const STORAGE_KEY = 'notefade-base-url'

interface NoteLinkProps {
  url: string
  onCreateAnother: () => void
}

export function NoteLink({ url, onCreateAnother }: NoteLinkProps) {
  const [copyState, setCopyState] = useState<'idle' | 'shown' | 'fading'>('idle')
  const [hasCopied, setHasCopied] = useState(false)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [customBase, setCustomBase] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? ''
  )

  const fragment = url.includes('#') ? url.slice(url.indexOf('#')) : ''
  const displayUrl = customBase
    ? customBase.replace(/\/+$/, '') + '/' + fragment
    : url

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayUrl)
    } catch {
      const input = document.createElement('input')
      input.value = displayUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setHasCopied(true)
    setConfirmingLeave(false)
    setCopyState('shown')
    setTimeout(() => setCopyState('fading'), 1200)
    setTimeout(() => setCopyState('idle'), 1600)
  }, [displayUrl])

  const handleBaseChange = (value: string) => {
    setCustomBase(value)
    if (value) {
      localStorage.setItem(STORAGE_KEY, value)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const handleReset = () => {
    setCustomBase('')
    localStorage.removeItem(STORAGE_KEY)
  }

  const copied = copyState !== 'idle'

  const pathname = window.location.pathname
  const defaultBase = window.location.origin + pathname

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

      <div className={styles.headingRow}>
        <h2 className={styles.heading}>encrypted note ready</h2>
        <button
          type="button"
          className={styles.gearButton}
          onClick={() => setSettingsOpen((prev) => {
            if (prev) {
              handleReset()
            }
            return !prev
          })}
          title="link settings"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.67748 2.02413 3.23978 2.07312 2.95903 2.35386L2.35294 2.95996C2.0722 3.2407 2.0232 3.6784 2.23493 4.01427L2.80942 4.92561C2.62307 5.2645 2.47227 5.62589 2.36216 6.00472L1.31209 6.24287C0.924883 6.33065 0.650024 6.6748 0.650024 7.07183V7.92897C0.650024 8.32601 0.924883 8.67015 1.31209 8.75794L2.36228 8.99603C2.47246 9.375 2.62335 9.73652 2.80979 10.0755L2.2356 10.9867C2.02388 11.3225 2.07287 11.7602 2.35361 12.0409L2.95971 12.647C3.24045 12.9278 3.67815 12.9768 4.01402 12.7651L4.92537 12.1906C5.26429 12.377 5.62571 12.5278 6.00457 12.638L6.24265 13.6878C6.33043 14.075 6.67457 14.3499 7.07161 14.3499H7.92875C8.32579 14.3499 8.66993 14.075 8.75771 13.6878L8.99588 12.6376C9.37462 12.5275 9.73594 12.3767 10.0748 12.1904L10.9862 12.7651C11.3221 12.9768 11.7598 12.9278 12.0405 12.647L12.6466 12.0409C12.9274 11.7602 12.9764 11.3225 12.7646 10.9867L12.1904 10.0755C12.3768 9.73666 12.5275 9.37524 12.6376 8.99636L13.6878 8.75827C14.075 8.67049 14.3499 8.32635 14.3499 7.92931V7.07217C14.3499 6.67513 14.075 6.33099 13.6878 6.2432L12.6376 6.00513C12.5275 5.62629 12.3767 5.26491 12.1904 4.92598L12.7649 4.01453C12.9766 3.67866 12.9276 3.24096 12.6469 2.96022L12.0408 2.35412C11.76 2.07338 11.3223 2.02439 10.9865 2.23611L10.0751 2.81046C9.73622 2.62409 9.37484 2.47326 8.99602 2.36315L8.75791 1.31297C8.67012 0.925765 8.32598 0.650906 7.92895 0.650906L7.07095 0.650238ZM4.92053 4.92126C5.97631 3.86548 7.65891 3.72906 8.87069 4.58398C10.2267 5.54498 10.5765 7.41498 9.62552 8.78098C8.90457 9.80798 7.64917 10.2478 6.49805 9.9478C5.1726 9.60398 4.27266 8.35878 4.27266 6.99978C4.27266 6.22978 4.57266 5.26918 4.92053 4.92126Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      <p className={styles.description}>
        share this link — it works exactly once
      </p>

      {settingsOpen && (
        <div className={styles.settingsRow}>
          <label className={styles.settingsLabel}>base url</label>
          <div className={styles.settingsInputRow}>
            <input
              type="text"
              className={styles.baseUrlInput}
              value={customBase || defaultBase}
              onChange={(e) => handleBaseChange(e.target.value)}
              onFocus={(e) => {
                if (!customBase) {
                  setCustomBase(defaultBase)
                  localStorage.setItem(STORAGE_KEY, defaultBase)
                }
                e.target.select()
              }}
              spellCheck={false}
            />
            {customBase && (
              <button
                type="button"
                className={styles.resetLink}
                onClick={handleReset}
              >
                reset
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className={`${styles.linkBox} ${copied ? styles.linkBoxCopied : ''}`}
        onClick={handleCopy}
      >
        <span className={styles.linkText}>
          {settingsOpen ? (
            <>
              <span className={styles.linkBase}>
                {customBase ? customBase.replace(/\/+$/, '') + '/' : displayUrl.slice(0, displayUrl.indexOf('#'))}
              </span>
              {fragment}
            </>
          ) : displayUrl}
        </span>
        <span className={styles.copyIcon} title={copied ? 'copied' : 'copy to clipboard'}>
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 8.5L6 11L12.5 4.5"
                stroke="#22c55e"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect
                x="5.5"
                y="5.5"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M10.5 5.5V4a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          )}
        </span>
        {copied && (
          <span className={`${styles.copiedHint} ${copyState === 'fading' ? styles.copiedHintFading : ''}`}>
            copied to clipboard
          </span>
        )}
      </button>

      {confirmingLeave && (
        <div className={styles.confirmBanner}>
          you haven't copied the link yet — it can't be recovered
        </div>
      )}

      <a
        href={pathname}
        className={confirmingLeave ? styles.anotherLinkDanger : styles.anotherLink}
        onClick={(e) => {
          e.preventDefault()
          if (!hasCopied && !confirmingLeave) {
            setConfirmingLeave(true)
            return
          }
          onCreateAnother()
        }}
      >
        {confirmingLeave ? 'discard note' : 'create another'}
      </a>
    </div>
  )
}

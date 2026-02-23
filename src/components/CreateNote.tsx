import { useState, useRef, useEffect } from 'react';
import { useCreateNote } from '@/hooks/use-create-note';
import { useTypewriter } from '@/hooks/use-typewriter';
import { ContentFade } from './ContentFade';
import { NoteLink } from './NoteLink';
import styles from './CreateNote.module.css';

function isValidApiUrl(url: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('https://') ||
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1')
  );
}

export function CreateNote() {
  const {
    message,
    setMessage,
    ttl,
    setTtl,
    noteUrl,
    loading,
    error,
    isOverLimit,
    isEmpty,
    maxChars,
    ttlOptions,
    apiUrl,
    setApiUrl,
    resetApiUrl,
    isCustomServer,
    handleCreate,
    resetNote,
  } = useCreateNote();
  const [focused, setFocused] = useState(false);
  const [byosOpen, setByosOpen] = useState(false);
  const showTypewriter = isEmpty && !focused;
  const placeholder = useTypewriter(showTypewriter);
  const apiInputRef = useRef<HTMLInputElement>(null);

  const isUnsafeApi = isCustomServer && !isValidApiUrl(apiUrl);

  useEffect(() => {
    if (byosOpen) {
      apiInputRef.current?.focus();
      apiInputRef.current?.select();
    }
  }, [byosOpen]);

  const contentKey = noteUrl ? 'link' : 'form';

  return (
    <ContentFade contentKey={contentKey}>
      {noteUrl ? (
        <NoteLink url={noteUrl} onCreateAnother={resetNote} />
      ) : (
        <div className={styles.container}>
          <div className={styles.textareaWrap}>
            <textarea
              className={`${styles.textarea} ${isOverLimit ? styles.textareaOver : ''}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={5}
              disabled={loading}
            />
            {showTypewriter && (
              <span className={styles.placeholder} aria-hidden>
                {placeholder}
                <span className={styles.cursor} />
              </span>
            )}
          </div>

          {byosOpen && (
            <div className={styles.byosPanel}>
              <label className={styles.byosLabel}>api server</label>
              <div className={styles.byosInputRow}>
                <input
                  ref={apiInputRef}
                  type='text'
                  className={`${styles.byosInput} ${isUnsafeApi ? styles.byosInputUnsafe : ''}`}
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder='https://your-worker.example.com'
                  spellCheck={false}
                />
                {isCustomServer && (
                  <button
                    type='button'
                    className={styles.byosReset}
                    onClick={() => {
                      resetApiUrl();
                      setByosOpen(false);
                    }}
                    title='reset to default'
                  >
                    <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                      <path
                        d='M1.5 1.5v4h4'
                        stroke='currentColor'
                        strokeWidth='1.3'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M2.1 8.5a5 5 0 108.4-4.6A5 5 0 002.1 5.5L1.5 5.5'
                        stroke='currentColor'
                        strokeWidth='1.3'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </button>
                )}
              </div>
              {isUnsafeApi && (
                <p className={styles.byosWarning}>
                  non-https API — shards may not be transmitted securely
                </p>
              )}
            </div>
          )}

          <div className={styles.footer}>
            <div className={styles.footerLeft}>
              <span className={styles.ttlLabel}>self-destruct</span>
              <div className={styles.ttlToggle}>
                <div
                  className={styles.ttlSlider}
                  style={{
                    transform: `translateX(${ttlOptions.findIndex((o) => o.value === ttl) * 100}%)`,
                  }}
                />
                {ttlOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type='button'
                    className={`${styles.ttlOption} ${ttl === opt.value ? styles.ttlOptionActive : ''}`}
                    onClick={() => setTtl(opt.value)}
                    disabled={loading}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.footerRight}>
              <button
                type='button'
                className={`${styles.gearButton} ${isCustomServer ? styles.gearButtonActive : ''}`}
                onClick={() => setByosOpen((prev) => !prev)}
                title='custom server'
              >
                <svg width='15' height='15' viewBox='0 0 15 15' fill='none'>
                  <path
                    d='M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.67748 2.02413 3.23978 2.07312 2.95903 2.35386L2.35294 2.95996C2.0722 3.2407 2.0232 3.6784 2.23493 4.01427L2.80942 4.92561C2.62307 5.2645 2.47227 5.62589 2.36216 6.00472L1.31209 6.24287C0.924883 6.33065 0.650024 6.6748 0.650024 7.07183V7.92897C0.650024 8.32601 0.924883 8.67015 1.31209 8.75794L2.36228 8.99603C2.47246 9.375 2.62335 9.73652 2.80979 10.0755L2.2356 10.9867C2.02388 11.3225 2.07287 11.7602 2.35361 12.0409L2.95971 12.647C3.24045 12.9278 3.67815 12.9768 4.01402 12.7651L4.92537 12.1906C5.26429 12.377 5.62571 12.5278 6.00457 12.638L6.24265 13.6878C6.33043 14.075 6.67457 14.3499 7.07161 14.3499H7.92875C8.32579 14.3499 8.66993 14.075 8.75771 13.6878L8.99588 12.6376C9.37462 12.5275 9.73594 12.3767 10.0748 12.1904L10.9862 12.7651C11.3221 12.9768 11.7598 12.9278 12.0405 12.647L12.6466 12.0409C12.9274 11.7602 12.9764 11.3225 12.7646 10.9867L12.1904 10.0755C12.3768 9.73666 12.5275 9.37524 12.6376 8.99636L13.6878 8.75827C14.075 8.67049 14.3499 8.32635 14.3499 7.92931V7.07217C14.3499 6.67513 14.075 6.33099 13.6878 6.2432L12.6376 6.00513C12.5275 5.62629 12.3767 5.26491 12.1904 4.92598L12.7649 4.01453C12.9766 3.67866 12.9276 3.24096 12.6469 2.96022L12.0408 2.35412C11.76 2.07338 11.3223 2.02439 10.9865 2.23611L10.0751 2.81046C9.73622 2.62409 9.37484 2.47326 8.99602 2.36315L8.75791 1.31297C8.67012 0.925765 8.32598 0.650906 7.92895 0.650906L7.07095 0.650238ZM4.92053 4.92126C5.97631 3.86548 7.65891 3.72906 8.87069 4.58398C10.2267 5.54498 10.5765 7.41498 9.62552 8.78098C8.90457 9.80798 7.64917 10.2478 6.49805 9.9478C5.1726 9.60398 4.27266 8.35878 4.27266 6.99978C4.27266 6.22978 4.57266 5.26918 4.92053 4.92126Z'
                    fill='currentColor'
                    fillRule='evenodd'
                    clipRule='evenodd'
                  />
                </svg>
              </button>

              {isOverLimit ? (
                <button
                  type='button'
                  className={styles.truncateButton}
                  onClick={() => setMessage(message.slice(0, maxChars))}
                >
                  <span>{message.length} chars</span>
                  <span>truncate to {maxChars}</span>
                </button>
              ) : (
                <span className={styles.charCount}>
                  {message.length}/{maxChars}
                </span>
              )}

              <button
                type='button'
                className={styles.encryptButton}
                onClick={handleCreate}
                disabled={isEmpty || isOverLimit || loading}
              >
                {loading ? 'encrypting...' : 'encrypt'}
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>
      )}
    </ContentFade>
  );
}

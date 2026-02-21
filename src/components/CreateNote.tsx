import { useState } from 'react';
import { useCreateNote } from '@/hooks/use-create-note';
import { useTypewriter } from '@/hooks/use-typewriter';
import { NoteLink } from './NoteLink';
import styles from './CreateNote.module.css';

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
    handleCreate,
    resetNote,
  } = useCreateNote();
  const [focused, setFocused] = useState(false);
  const showTypewriter = isEmpty && !focused;
  const placeholder = useTypewriter(showTypewriter);

  if (noteUrl) {
    return <NoteLink url={noteUrl} onCreateAnother={resetNote} />;
  }

  return (
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
  );
}

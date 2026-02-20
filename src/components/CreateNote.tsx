import { useCreateNote } from '@/hooks/use-create-note';
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

  if (noteUrl) {
    return <NoteLink url={noteUrl} onCreateAnother={resetNote} />;
  }

  return (
    <div className={styles.container}>
      <textarea
        className={`${styles.textarea} ${isOverLimit ? styles.textareaOver : ''}`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder='type your secret...'
        rows={5}
        disabled={loading}
      />

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
          <span
            className={`${styles.charCount} ${isOverLimit ? styles.charCountOver : ''}`}
          >
            {message.length}/{maxChars}
          </span>

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

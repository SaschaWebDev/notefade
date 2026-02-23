import { useState, useMemo, type ReactNode } from 'react';
import { useReadNote } from '@/hooks/use-read-note';
import { fromBase64Url, computeCheck } from '@/crypto';
import { ContentFade } from './ContentFade';
import { NoteGone } from './NoteGone';
import styles from './ReadNote.module.css';

interface ReadNoteProps {
  shardId: string;
  urlPayload: string;
  check: string | null;
}

function validateFragment(
  shardId: string,
  urlPayload: string,
  check: string | null,
): string | null {
  if (!/^[a-f0-9]{4,32}$/i.test(shardId)) {
    return 'This link has an invalid shard ID. It may be incomplete or corrupted.'
  }
  try {
    const bytes = fromBase64Url(urlPayload)
    // Minimum: urlShare(48) + IV(12) + GCM tag(16) = 76 bytes
    if (bytes.length < 76) {
      return 'This link is too short to contain an encrypted note. It may be truncated.'
    }
  } catch {
    return 'This link contains invalid data. It may be corrupted or incomplete.'
  }
  // Verify integrity check if present (new-format URLs)
  if (check !== null && computeCheck(urlPayload) !== check) {
    return 'This link appears to be corrupted. One or more characters may have been added, removed, or changed.'
  }
  return null
}

export function ReadNote({ shardId, urlPayload, check }: ReadNoteProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [checked, setChecked] = useState(false);
  const validationError = useMemo(
    () => validateFragment(shardId, urlPayload, check),
    [shardId, urlPayload, check],
  );
  const { state } = useReadNote(
    validationError ? '' : shardId,
    urlPayload,
    confirmed && !validationError,
  );
  const pathname = window.location.pathname;

  // Derive state key for transitions
  const stateKey = validationError
    ? 'invalid'
    : !confirmed && state.status === 'gone'
      ? 'gone'
      : !confirmed && state.status === 'error'
        ? 'pre-error'
        : !confirmed
          ? 'disclaimer'
          : state.status === 'loading' || state.status === 'idle'
            ? 'loading'
            : state.status === 'gone'
              ? 'gone'
              : state.status === 'error'
                ? 'error'
                : state.status === 'faded'
                  ? 'faded'
                  : 'decrypted';

  let content: ReactNode;

  if (!validationError && state.status === 'gone') {
    content = <NoteGone />;
  } else if (!validationError && !confirmed && state.status === 'error') {
    content = (
      <div className={styles.containerCentered}>
        <div className={styles.errorIcon}>
          <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
            <circle cx='10' cy='10' r='10' fill='rgba(248,113,113,0.12)' />
            <path
              d='M10 6v5M10 13.5v.5'
              stroke='#f87171'
              strokeWidth='1.5'
              strokeLinecap='round'
            />
          </svg>
        </div>
        <p className={styles.errorMessage}>{state.message}</p>
        <a href={pathname} className={styles.newLink}>
          create note
        </a>
      </div>
    );
  } else if (validationError) {
    content = (
      <div className={styles.containerCentered}>
        <div className={styles.stateIcon}>
          <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
            <circle cx='10' cy='10' r='10' fill='rgba(255,255,255,0.05)' />
            <path
              d='M7 7l6 6M13 7l-6 6'
              stroke='rgba(255,255,255,0.3)'
              strokeWidth='1.5'
              strokeLinecap='round'
            />
          </svg>
        </div>
        <h2 className={styles.stateHeading}>invalid link</h2>
        <p className={styles.stateSubheading}>{validationError}</p>
        <a href={pathname} className={styles.newLink}>
          create note
        </a>
      </div>
    );
  } else if (!confirmed) {
    content = (
      <div className={styles.disclaimer}>
        <div className={styles.disclaimerIcon}>
          <svg width='24' height='24' viewBox='0 0 24 24' fill='none'>
            <path
              d='M12 9v4M12 17h.01'
              stroke='#f59e0b'
              strokeWidth='1.5'
              strokeLinecap='round'
            />
            <path
              d='M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
              stroke='#f59e0b'
              strokeWidth='1.5'
              strokeLinecap='round'
              strokeLinejoin='round'
              fill='rgba(245,158,11,0.08)'
            />
          </svg>
        </div>

        <h2 className={styles.disclaimerHeading}>
          someone sent you a private note
        </h2>
        <p className={styles.disclaimerText}>
          this note can only be read <strong>once</strong>
        </p>
        <p className={styles.disclaimerDetail}>
          opening it will permanently destroy the key needed to decrypt it.
          <br />
          the content itself was never stored on any server.
        </p>

        <label className={styles.checkboxLabel}>
          <input
            type='checkbox'
            className={styles.checkbox}
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span className={styles.checkboxText}>
            I understand this note will self-destruct after reading
          </span>
        </label>

        <button
          type='button'
          className={styles.revealButton}
          disabled={!checked}
          onClick={() => setConfirmed(true)}
        >
          reveal note
        </button>
      </div>
    );
  } else if (state.status === 'idle' || state.status === 'loading') {
    content = (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span className={styles.loadingText}>decrypting...</span>
      </div>
    );
  } else if (state.status === 'error') {
    content = (
      <div className={styles.containerCentered}>
        <div className={styles.errorIcon}>
          <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
            <circle cx='10' cy='10' r='10' fill='rgba(248,113,113,0.12)' />
            <path
              d='M10 6v5M10 13.5v.5'
              stroke='#f87171'
              strokeWidth='1.5'
              strokeLinecap='round'
            />
          </svg>
        </div>
        <p className={styles.errorMessage}>{state.message}</p>
        <a href={pathname} className={styles.newLink}>
          create note
        </a>
      </div>
    );
  } else if (state.status === 'faded') {
    content = (
      <div className={styles.containerCentered}>
        <div className={styles.stateIcon}>
          <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
            <circle cx='10' cy='10' r='10' fill='rgba(255,255,255,0.05)' />
            <path
              d='M6 10h8'
              stroke='rgba(255,255,255,0.3)'
              strokeWidth='1.5'
              strokeLinecap='round'
            />
          </svg>
        </div>
        <h2 className={styles.stateHeading}>note has faded</h2>
        <p className={styles.stateSubheading}>
          the decrypted content has been cleared from memory for your security
        </p>
        <a href={pathname} className={styles.newLink}>
          create note
        </a>
      </div>
    );
  } else if (state.status === 'decrypted') {
    content = (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.heading}>decrypted note</h2>
          <span className={styles.badge}>this note has self-destructed</span>
        </div>

        <div className={styles.noteContent}>{state.plaintext}</div>

        <div className={styles.footer}>
          <p className={styles.destroyNotice}>
            this note has been read and permanently deleted from the server
          </p>
          <a href={pathname} className={styles.newLink}>
            create another
          </a>
        </div>
      </div>
    );
  }

  return <ContentFade contentKey={stateKey}>{content}</ContentFade>;
}

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useReadNote } from '@/hooks/use-read-note';
import { fromBase64Url, computeCheck, computeReceiptProof } from '@/crypto';
import { getProviderLabel } from '@/api/provider-registry';
import type { ProviderConfig } from '@/api/provider-types';
import { ContentFade } from './ContentFade';
import { NoteGone } from './NoteGone';
import { NoteMarkdown, hasMarkdownPatterns } from './NoteMarkdown';
import styles from './ReadNote.module.css';

interface ReadNoteProps {
  shardId: string;
  shardIds: string[];
  urlPayload: string;
  check: string | null;
  provider: ProviderConfig | null;
  timeLockAt: number | null;
}

function validateFragment(
  shardId: string,
  urlPayload: string,
  check: string | null,
): string | null {
  if (!/^[a-f0-9]{4,32}$/i.test(shardId)) {
    return 'This link has an invalid shard ID. It may be incomplete or corrupted.';
  }
  try {
    const bytes = fromBase64Url(urlPayload);
    // Minimum: urlShare(48) + IV(12) + GCM tag(16) = 76 bytes
    if (bytes.length < 76) {
      return 'This link is too short to contain an encrypted note. It may be truncated.';
    }
  } catch {
    return 'This link contains invalid data. It may be corrupted or incomplete.';
  }
  // Verify integrity check if present (new-format URLs)
  if (check !== null && computeCheck(urlPayload) !== check) {
    return 'This link appears to be corrupted. One or more characters may have been added, removed, or changed.';
  }
  return null;
}

function getProviderDisplayName(provider: ProviderConfig): string {
  if (provider.t === 'self') {
    try {
      return new URL(provider.u).hostname;
    } catch {
      return provider.u;
    }
  }
  return getProviderLabel(provider.t);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTimeLockCountdown(unlockAt: number): string {
  const diff = unlockAt * 1000 - Date.now();
  if (diff <= 0) return 'now';
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function ReadNote({
  shardId,
  shardIds,
  urlPayload,
  check,
  provider,
  timeLockAt,
}: ReadNoteProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [viewMode, setViewMode] = useState<'raw' | 'formatted'>('formatted');
  const [receiptProof, setReceiptProof] = useState<string | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [timeLockReady, setTimeLockReady] = useState(
    timeLockAt === null || timeLockAt * 1000 <= Date.now(),
  );
  const [, setTimeLockTick] = useState(0);

  const validationError = useMemo(
    () => validateFragment(shardId, urlPayload, check),
    [shardId, urlPayload, check],
  );

  // Time-lock countdown
  useEffect(() => {
    if (timeLockAt === null || timeLockReady) return;
    const interval = setInterval(() => {
      if (timeLockAt * 1000 <= Date.now()) {
        setTimeLockReady(true);
        clearInterval(interval);
      } else {
        setTimeLockTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLockAt, timeLockReady]);

  const { state } = useReadNote(
    validationError || !timeLockReady ? '' : shardId,
    urlPayload,
    confirmed && !validationError && timeLockReady,
    provider,
    shardIds,
  );
  const pathname = window.location.pathname;

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
  }, []);

  // Generate receipt proof
  const handleReceiptProof = useCallback(async () => {
    if (state.status !== 'decrypted' || !state.metadata.receiptSeed) return;
    const proof = await computeReceiptProof(
      state.metadata.receiptSeed,
      state.plaintext,
    );
    setReceiptProof(proof);
  }, [state]);

  // Derive state key for transitions
  const stateKey = validationError
    ? 'invalid'
    : !timeLockReady
      ? 'timelock'
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

  // Time-lock gate (Feature 2)
  if (!validationError && !timeLockReady && timeLockAt !== null) {
    content = (
      <div className={styles.containerCentered}>
        <h2 className={styles.stateHeadingInline}>
          <span className={styles.stateIcon}>
            <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
              <circle cx='10' cy='10' r='10' fill='rgba(79,143,247,0.12)' />
              <circle
                cx='10'
                cy='10'
                r='5'
                stroke='#4f8ff7'
                strokeWidth='1.2'
                fill='none'
              />
              <path
                d='M10 7v3l2 1.5'
                stroke='#4f8ff7'
                strokeWidth='1.2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </span>
          time-locked note
        </h2>
        <p className={styles.stateSubheading}>
          this note unlocks in{' '}
          <strong>{formatTimeLockCountdown(timeLockAt)}</strong>
        </p>
        <p
          className={styles.stateSubheading}
          style={{ fontSize: '12px', opacity: 0.5 }}
        >
          {new Date(timeLockAt * 1000).toLocaleString()}
        </p>
      </div>
    );
  } else if (!validationError && state.status === 'gone') {
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
        <h2 className={styles.stateHeadingInline}>
          <span className={styles.stateIcon}>
            <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
              <circle cx='10' cy='10' r='10' fill='rgba(255,255,255,0.05)' />
              <path
                d='M7 7l6 6M13 7l-6 6'
                stroke='rgba(255,255,255,0.3)'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
            </svg>
          </span>
          invalid link
        </h2>
        <p className={styles.stateSubheading}>{validationError}</p>
        <a href={pathname} className={styles.newLink}>
          create note
        </a>
      </div>
    );
  } else if (!confirmed) {
    content = (
      <div className={styles.disclaimer}>
        <h2 className={styles.disclaimerHeading}>
          <span className={styles.disclaimerIcon}>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none'>
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
          </span>
          someone sent you a private note
        </h2>

        {provider && (
          <div className={styles.customServerBanner}>
            shard stored on: {getProviderDisplayName(provider)}
          </div>
        )}
        <p className={styles.disclaimerText}>
          this note can only be read{' '}
          <strong>
            {shardIds.length > 1 ? `${shardIds.length} times` : 'once'}
          </strong>
        </p>
        <p className={styles.disclaimerDetail}>
          opening it will permanently destroy the key needed to decrypt it
          <br />
          the content itself was never stored on any server
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
        <h2 className={styles.stateHeadingInline}>
          <span className={styles.stateIcon}>
            <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
              <circle cx='10' cy='10' r='10' fill='rgba(255,255,255,0.05)' />
              <path
                d='M6 10h8'
                stroke='rgba(255,255,255,0.3)'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
            </svg>
          </span>
          note has faded
        </h2>
        <p className={styles.stateSubheading}>
          the decrypted content has been cleared from memory for your security
        </p>
        <a href={pathname} className={styles.newLink}>
          create note
        </a>
      </div>
    );
  } else if (state.status === 'decrypted') {
    const showToggle = hasMarkdownPatterns(state.plaintext);
    const hasBarTimer =
      state.metadata.barSeconds !== undefined && state.metadata.barSeconds > 0;
    const hasReceipt = Boolean(state.metadata.receiptSeed);

    content = (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.heading}>decrypted secret note</h2>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>
              this note url has self-destructed
            </span>
            {hasBarTimer && (
              <span className={styles.barBadge}>
                fades in {formatDuration(state.remainingMs)}
              </span>
            )}
          </div>
        </div>

        {showToggle && (
          <div className={styles.formatToggle}>
            <button
              type='button'
              className={
                viewMode === 'raw'
                  ? `${styles.formatToggleBtn} ${styles.formatToggleActive}`
                  : styles.formatToggleBtn
              }
              onClick={() => setViewMode('raw')}
            >
              raw
            </button>
            <button
              type='button'
              className={
                viewMode === 'formatted'
                  ? `${styles.formatToggleBtn} ${styles.formatToggleActive}`
                  : styles.formatToggleBtn
              }
              onClick={() => setViewMode('formatted')}
            >
              rendered
            </button>
          </div>
        )}

        <div
          className={
            viewMode === 'formatted' && showToggle
              ? `${styles.noteContent} ${styles.noteContentFormatted}`
              : styles.noteContent
          }
        >
          {viewMode === 'formatted' && showToggle ? (
            <NoteMarkdown plaintext={state.plaintext} />
          ) : (
            state.plaintext
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerActions}>
            <button
              type='button'
              className={styles.copyButton}
              onClick={() => handleCopy(state.plaintext)}
            >
              copy note
            </button>

            {hasReceipt && !receiptProof && (
              <button
                type='button'
                className={styles.receiptButton}
                onClick={handleReceiptProof}
              >
                generate proof of read
              </button>
            )}
          </div>

          {receiptProof && (
            <div className={styles.receiptSection}>
              <span className={styles.receiptLabel}>proof of read</span>
              <div
                className={styles.receiptProof}
                onClick={() => {
                  navigator.clipboard.writeText(receiptProof);
                  setReceiptCopied(true);
                  setTimeout(() => setReceiptCopied(false), 1500);
                }}
              >
                {receiptProof}
              </div>
              <span className={styles.receiptHint}>
                {receiptCopied
                  ? 'copied'
                  : 'click to copy — send this to the note creator'}
              </span>
            </div>
          )}

          <a href={pathname} className={styles.newLink}>
            create another
          </a>
        </div>
      </div>
    );
  }

  return <ContentFade contentKey={stateKey}>{content}</ContentFade>;
}

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { useReadNote } from '@/hooks/use-read-note';
import { useReadMultiNote } from '@/hooks/use-read-multi-note';
import { fromBase64Url, computeCheck, computeReceiptProof } from '@/crypto';
import type { ParsedFragment } from '@/hooks/use-hash-route';
import { getProviderLabel } from '@/api/provider-registry';
import type { ProviderConfig } from '@/api/provider-types';
import { COPY_FEEDBACK_MS } from '@/constants';
import { formatDuration, formatTimeLockCountdown } from '@/utils/time';
import { ContentFade } from '@/components/ui/content-fade';
import { AudioPlayer } from '@/components/ui/audio-player';
import { ImageViewer } from '@/components/ui/image-viewer';
import { VideoViewer } from '@/components/ui/video-viewer';
import { TranscribeButton } from '@/components/ui/transcribe-button';
import { NoteGone } from '../note-gone';
import {
  NoteMarkdown,
  hasMarkdownPatterns,
  hasPlainUrls,
} from '@/components/ui/note-markdown';
import {
  IconTimeLockClock,
  IconError,
  IconXCircle,
  IconWarning,
  IconFade,
  IconClipboard,
  IconCheck,
} from '@/components/ui/icons';
import styles from './ReadNote.module.css';

const SHARD_ID_PATTERN = /^[a-f0-9]{4,32}$/i;
const MIN_PAYLOAD_BYTES = 76;

interface ReadNoteProps {
  shardId: string;
  shardIds: string[];
  urlPayload: string;
  check: string | null;
  provider: ProviderConfig | null;
  timeLockAt: number | null;
  multiChunks?: ParsedFragment[] | null;
  byokKey?: string | null;
}

function validateFragment(
  shardId: string,
  urlPayload: string,
  check: string | null,
): string | null {
  if (!SHARD_ID_PATTERN.test(shardId)) {
    return 'This link has an invalid shard ID. It may be incomplete or corrupted.';
  }
  try {
    const bytes = fromBase64Url(urlPayload);
    // Minimum: urlShare(48) + IV(12) + GCM tag(16) = 76 bytes
    if (bytes.length < MIN_PAYLOAD_BYTES) {
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

export function ReadNote({
  shardId,
  shardIds,
  urlPayload,
  check,
  provider,
  timeLockAt,
  multiChunks,
  byokKey,
}: ReadNoteProps) {
  const isMultiChunk = multiChunks != null && multiChunks.length > 1;
  const [confirmed, setConfirmed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [viewMode, setViewMode] = useState<'raw' | 'formatted'>('formatted');
  const [receiptProof, setReceiptProof] = useState<string | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [noteCopied, setNoteCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
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

  const singleResult = useReadNote(
    isMultiChunk ? '' : validationError || !timeLockReady ? '' : shardId,
    urlPayload,
    !isMultiChunk && confirmed && !validationError && timeLockReady,
    provider,
    shardIds,
    byokKey,
  );
  const multiResult = useReadMultiNote(
    isMultiChunk ? multiChunks : [],
    isMultiChunk && confirmed && !validationError && timeLockReady,
    byokKey,
  );
  const { state, remainingReads } = isMultiChunk ? multiResult : singleResult;
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
            <IconTimeLockClock />
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
        <a href={pathname} className={styles.newLink}>
          back to main
        </a>
      </div>
    );
  } else if (!validationError && state.status === 'gone') {
    content = <NoteGone />;
  } else if (!validationError && !confirmed && state.status === 'error') {
    content = (
      <div className={styles.containerCentered}>
        <div className={styles.errorIcon}>
          <IconError />
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
            <IconXCircle />
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
            <IconWarning />
          </span>
          someone sent you a private note
        </h2>

        {provider && (
          <div className={styles.customServerBanner}>
            shard stored on: {getProviderDisplayName(provider)}
          </div>
        )}
        <p className={styles.disclaimerText}>
          {shardIds.length > 1 ? (
            remainingReads !== null ? (
              <>
                this note has{' '}
                <strong>
                  {remainingReads} of {shardIds.length}
                </strong>{' '}
                reads remaining
              </>
            ) : (
              <>
                this note can be read up to{' '}
                <strong>{shardIds.length} times</strong>
              </>
            )
          ) : (
            <>
              this note can only be read <strong>once</strong>
            </>
          )}
        </p>
        <p className={styles.disclaimerDetail}>
          {shardIds.length > 1 ? (
            <>
              opening it will use one read — the note is destroyed when all
              reads are consumed
              <br />
              the content itself was never stored on any server
            </>
          ) : (
            <>
              opening it will permanently destroy the key needed to decrypt it
              <br />
              the content itself was never stored on any server
            </>
          )}
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

        <button
          type='button'
          className={styles.copyUrlButton}
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setUrlCopied(true);
            setTimeout(() => setUrlCopied(false), COPY_FEEDBACK_MS);
          }}
        >
          {urlCopied ? 'copied!' : 'copy link'}
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
          <IconError />
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
            <IconFade />
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
  } else if (state.status === 'decrypted-voice') {
    const hasBarTimer =
      state.metadata.barSeconds !== undefined && state.metadata.barSeconds > 0;
    content = (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.heading}>decrypted voice note</h2>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>this note url has self-destructed</span>
            {hasBarTimer && (
              <span className={styles.barBadge}>
                fades in {formatDuration(state.remainingMs)}
              </span>
            )}
          </div>
        </div>
        <div className={styles.voicePlayback}>
          <AudioPlayer blob={state.blob} durationMs={state.durationMs} />
          <TranscribeButton blob={state.blob} />
        </div>
      </div>
    );
  } else if (state.status === 'decrypted-image') {
    const hasBarTimer =
      state.metadata.barSeconds !== undefined && state.metadata.barSeconds > 0;
    content = (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.heading}>decrypted image</h2>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>this note url has self-destructed</span>
            {hasBarTimer && (
              <span className={styles.barBadge}>
                fades in {formatDuration(state.remainingMs)}
              </span>
            )}
          </div>
        </div>
        <ImageViewer blob={state.blob} />
      </div>
    );
  } else if (state.status === 'decrypted-video') {
    const hasBarTimer =
      state.metadata.barSeconds !== undefined && state.metadata.barSeconds > 0;
    content = (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.heading}>decrypted video note</h2>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>this note url has self-destructed</span>
            {hasBarTimer && (
              <span className={styles.barBadge}>
                fades in {formatDuration(state.remainingMs)}
              </span>
            )}
          </div>
        </div>
        <VideoViewer blob={state.blob} durationMs={state.durationMs} />
      </div>
    );
  } else if (state.status === 'decrypted') {
    const showToggle =
      hasMarkdownPatterns(state.plaintext) || hasPlainUrls(state.plaintext);
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
            {byokKey && (
              <span className={styles.badge}>
                decrypted with your key
              </span>
            )}
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

        <div className={styles.noteContentWrapper}>
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
          <button
            type='button'
            className={styles.copyIcon}
            onClick={() => {
              handleCopy(state.plaintext);
              setNoteCopied(true);
              setTimeout(() => setNoteCopied(false), COPY_FEEDBACK_MS);
            }}
            title={noteCopied ? 'copied' : 'copy to clipboard'}
          >
            {noteCopied ? <IconCheck /> : <IconClipboard />}
          </button>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerActions}>
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
                  setTimeout(() => setReceiptCopied(false), COPY_FEEDBACK_MS);
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

          <a href={`${pathname}?reply`} className={styles.newLink}>
            reply with note
          </a>
        </div>
      </div>
    );
  }

  return <ContentFade contentKey={stateKey}>{content}</ContentFade>;
}

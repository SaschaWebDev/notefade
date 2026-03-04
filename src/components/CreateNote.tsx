import { useState, useRef, useEffect, useCallback } from 'react';
import { useCreateNote } from '@/hooks/use-create-note';
import { useTypewriter } from '@/hooks/use-typewriter';
import { PROVIDERS, getProviderEntry } from '@/api/provider-registry';
import type { ProviderConfig, ProviderType } from '@/api/provider-types';
import { ContentFade } from './ContentFade';
import { NoteLink } from './NoteLink';
import { NoteMarkdown, hasMarkdownPatterns } from './NoteMarkdown';
import { generateDecoyMessage } from '@/crypto';
import styles from './CreateNote.module.css';

const BYOS_PROVIDER_TYPES = PROVIDERS.map((p) => p.type);

function getConfigFieldValue(config: ProviderConfig, key: string): string {
  // All provider config fields use single-char keys (t, u, k, a, n, d)
  // Access them safely via the discriminated union
  switch (key) {
    case 'u':
      return 'u' in config ? config.u : '';
    case 'k':
      return 'k' in config ? config.k : '';
    case 'a':
      return 'a' in config ? config.a : '';
    case 'n':
      return 'n' in config ? config.n : '';
    case 'd':
      return 'd' in config ? config.d : '';
    default:
      return '';
  }
}

function isProviderConfigComplete(config: ProviderConfig | null): boolean {
  if (!config) return false;
  const entry = getProviderEntry(config.t);
  if (!entry) return false;
  return entry.fields.every((f) => {
    const value = getConfigFieldValue(config, f.key);
    return value.length > 0;
  });
}

function OnOffToggle({
  enabled,
  onToggle,
  disabled,
  small,
  offLabel = 'off',
  onLabel = 'on',
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  small?: boolean;
  offLabel?: string;
  onLabel?: string;
}) {
  const btnStyle = small
    ? ({ fontSize: '13px', padding: '5px 10px' } as const)
    : undefined;
  return (
    <div className={styles.ttlToggle}>
      <div
        className={styles.ttlSlider}
        style={{
          width: 'calc(100% / 2 - 2px)',
          transform: `translateX(${enabled ? '100%' : '0%'})`,
        }}
      />
      <button
        type='button'
        className={`${styles.ttlOption} ${!enabled ? styles.ttlOptionActive : ''}`}
        onClick={onToggle}
        disabled={disabled}
        style={btnStyle}
      >
        {offLabel}
      </button>
      <button
        type='button'
        className={`${styles.ttlOption} ${enabled ? styles.ttlOptionActive : ''}`}
        onClick={onToggle}
        disabled={disabled}
        style={btnStyle}
      >
        {onLabel}
      </button>
    </div>
  );
}

interface CreateNoteProps {
  onNoteCreated?: (hasUrl: boolean) => void;
}

export function CreateNote({ onNoteCreated }: CreateNoteProps = {}) {
  const {
    message,
    setMessage,
    ttl,
    setTtl,
    noteUrl,
    compactUrl,
    shardId,
    expiresAt,
    loading,
    error,
    isOverLimit,
    isEmpty,
    maxChars,
    ttlOptions,
    providerConfig,
    setProviderConfig,
    resetProvider,
    isCustomServer,
    providerType,
    setProviderType,
    password,
    setPassword,
    passwordEnabled,
    setPasswordEnabled,
    readCount,
    setReadCount,
    maxReadCount,
    barDuration,
    setBarDuration,
    barOptions,
    timeLockEnabled,
    setTimeLockEnabled,
    timeLockAt,
    setTimeLockAt,
    deferredMode,
    setDeferredMode,
    launchCode,
    receiptEnabled,
    setReceiptEnabled,
    receiptVerification,
    decoyMessages,
    setDecoyMessages,
    decoyUrls,
    handleCreate,
    resetNote,
    resetExpertSettings,
  } = useCreateNote();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pwCopied, setPwCopied] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const [launchCodeCopied, setLaunchCodeCopied] = useState(false);
  const [noteUrlCopied, setNoteUrlCopied] = useState(false);
  const [hasEverCopiedUrl, setHasEverCopiedUrl] = useState(false);
  const [hasEverCopiedLaunchCode, setHasEverCopiedLaunchCode] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [byosMode, setByosMode] = useState<'default' | 'custom'>(
    isCustomServer ? 'custom' : 'default',
  );
  const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
  const [hasSelection, setHasSelection] = useState(false);
  const [decoyEnabled, setDecoyEnabled] = useState(false);
  const [decoyCount, setDecoyCount] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closeExpertPanel = useCallback(() => {
    if (expertOpen) {
      setExpertOpen(false);
      requestAnimationFrame(() => {
        document
          .querySelector('header')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [expertOpen]);

  const showTypewriter = isEmpty && !focused;
  const placeholder = useTypewriter(showTypewriter);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const showFormatToggle = hasMarkdownPatterns(message);
  const showToolbar = focused || !isEmpty;

  const wrapSelection = useCallback(
    (prefix: string, suffix: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = message.slice(start, end);
      const placeholder = selected || 'text';
      const wrapped = prefix + placeholder + suffix;
      const next = message.slice(0, start) + wrapped + message.slice(end);
      setMessage(next);
      // Restore focus and selection after React re-render
      const selectStart = start + prefix.length;
      const selectEnd = selectStart + placeholder.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(selectStart, selectEnd);
      });
    },
    [message, setMessage],
  );

  const insertBullet = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = message.slice(start, end);
    if (selected.includes('\n')) {
      // Wrap each line with bullet prefix
      const bulleted = selected
        .split('\n')
        .map((line) => (line.trim() ? `- ${line}` : line))
        .join('\n');
      const next = message.slice(0, start) + bulleted + message.slice(end);
      setMessage(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start + bulleted.length);
      });
    } else {
      // Insert a new bullet at cursor
      const needsNewline = start > 0 && message[start - 1] !== '\n';
      const insert = (needsNewline ? '\n' : '') + '- ';
      const next = message.slice(0, start) + insert + message.slice(end);
      setMessage(next);
      const cursor = start + insert.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursor, cursor);
      });
    }
  }, [message, setMessage]);

  const insertNumberedList = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = message.slice(start, end);
    if (selected.includes('\n')) {
      const numbered = selected
        .split('\n')
        .map((line, i) => (line.trim() ? `${i + 1}. ${line}` : line))
        .join('\n');
      const next = message.slice(0, start) + numbered + message.slice(end);
      setMessage(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start + numbered.length);
      });
    } else {
      const needsNewline = start > 0 && message[start - 1] !== '\n';
      const insert = (needsNewline ? '\n' : '') + '1. ';
      const next = message.slice(0, start) + insert + message.slice(end);
      setMessage(next);
      const cursor = start + insert.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursor, cursor);
      });
    }
  }, [message, setMessage]);

  const insertToggle = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = message.slice(start, end);
    if (selected.includes('\n')) {
      const toggled = selected
        .split('\n')
        .map((line) => (line.trim() ? `- [ ] ${line}` : line))
        .join('\n');
      const next = message.slice(0, start) + toggled + message.slice(end);
      setMessage(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start + toggled.length);
      });
    } else {
      const needsNewline = start > 0 && message[start - 1] !== '\n';
      const insert = (needsNewline ? '\n' : '') + '- [ ] ';
      const next = message.slice(0, start) + insert + message.slice(end);
      setMessage(next);
      const cursor = start + insert.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursor, cursor);
      });
    }
  }, [message, setMessage]);

  const insertHeading = useCallback(
    (level: 1 | 2 | 3) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = message.slice(start, end);
      const prefix = '#'.repeat(level) + ' ';
      const needsNewline = start > 0 && message[start - 1] !== '\n';
      const before = needsNewline ? '\n' : '';
      const placeholder = selected || 'heading';
      const insert = before + prefix + placeholder;
      const next = message.slice(0, start) + insert + message.slice(end);
      setMessage(next);
      const selectStart = start + before.length + prefix.length;
      const selectEnd = selectStart + placeholder.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(selectStart, selectEnd);
      });
    },
    [message, setMessage],
  );

  const insertQuote = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = message.slice(start, end);
    if (selected.includes('\n')) {
      const quoted = selected
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : line))
        .join('\n');
      const next = message.slice(0, start) + quoted + message.slice(end);
      setMessage(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start + quoted.length);
      });
    } else {
      const needsNewline = start > 0 && message[start - 1] !== '\n';
      const insert = (needsNewline ? '\n' : '') + '> ';
      const next = message.slice(0, start) + insert + message.slice(end);
      setMessage(next);
      const cursor = start + insert.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursor, cursor);
      });
    }
  }, [message, setMessage]);

  const insertDivider = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const needsNewlineBefore = start > 0 && message[start - 1] !== '\n';
    const insert = (needsNewlineBefore ? '\n' : '') + '---\n';
    const next = message.slice(0, start) + insert + message.slice(start);
    setMessage(next);
    const cursor = start + insert.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  }, [message, setMessage]);

  /** Prevent toolbar buttons from stealing focus from the textarea on mobile */
  const keepFocus = useCallback((e: React.MouseEvent) => { e.preventDefault(); }, []);

  const currentProviderType = providerType ?? 'self';
  const currentEntry = getProviderEntry(currentProviderType);

  useEffect(() => {
    onNoteCreated?.(Boolean(noteUrl));
  }, [noteUrl, onNoteCreated]);

  useEffect(() => {
    if (expertOpen && byosMode === 'custom') {
      firstFieldRef.current?.focus();
    }
  }, [expertOpen, byosMode, currentProviderType]);

  const handleModeSwitch = (mode: 'default' | 'custom') => {
    setByosMode(mode);
    if (mode === 'default') {
      resetProvider();
    } else {
      if (!providerConfig) {
        setProviderType('self');
      }
    }
  };

  const handleFieldChange = (fieldKey: string, value: string) => {
    if (!providerConfig) return;
    const updated = { ...providerConfig, [fieldKey]: value } as ProviderConfig;
    setProviderConfig(updated);
  };

  const handleDecoyToggle = () => {
    if (!decoyEnabled) {
      setDecoyEnabled(true);
      setDecoyMessages([generateDecoyMessage()]);
      setDecoyCount(1);
    } else {
      setDecoyEnabled(false);
      setDecoyMessages([]);
      setDecoyCount(1);
    }
  };

  const handleDecoyCountChange = (n: number) => {
    setDecoyCount(n);
    setDecoyMessages((prev: string[]) => {
      if (n > prev.length) {
        const added = Array.from({ length: n - prev.length }, () => generateDecoyMessage());
        return [...prev, ...added];
      }
      return prev.slice(0, n);
    });
  };

  const handleDecoyMessageChange = (index: number, value: string) => {
    setDecoyMessages((prev: string[]) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleDecoyRegenerate = (index: number) => {
    setDecoyMessages((prev: string[]) => {
      const next = [...prev];
      next[index] = generateDecoyMessage();
      return next;
    });
  };

  const handleReset = () => {
    resetExpertSettings();
    resetProvider();
    setByosMode('default');
    setDecoyEnabled(false);
    setDecoyCount(1);
    closeExpertPanel();
  };

  const hasExpertChanges =
    readCount !== 1 ||
    barDuration !== 300 ||
    timeLockEnabled ||
    deferredMode ||
    receiptEnabled ||
    decoyMessages.length > 0 ||
    isCustomServer;

  // Deferred activation requires a server-side worker (default API or self-hosted API).
  // BYOS adapters that connect directly to storage from the browser (cf-kv, cf-d1, etc.)
  // have no server-side worker to hold DEFER_SECRET, so defer is unavailable for them.
  const canDefer = !providerConfig || providerConfig.t === 'self';

  const expertClauses: React.ReactNode[] = [];
  if (readCount > 1)
    expertClauses.push(
      <span key='reads'>
        <span className={styles.sentenceText}>can be </span>
        <a
          href='/docs#one-time-read'
          target='_blank'
          rel='noopener noreferrer'
          className={styles.sentenceLink}
          onClick={() => closeExpertPanel()}
        >
          read
        </a>
        <span className={styles.sentenceText}> </span>
        <span className={styles.sentenceTagPlain}>{readCount} times</span>
      </span>,
    );
  if (barDuration !== 300) {
    const barLabel =
      barOptions.find((o) => o.value === barDuration)?.label ??
      `${barDuration}s`;
    expertClauses.push(
      <span key='fade'>
        <span className={styles.sentenceText}>will </span>
        <a
          href='/docs#auto-expiring'
          target='_blank'
          rel='noopener noreferrer'
          className={styles.sentenceLink}
          onClick={() => closeExpertPanel()}
        >
          fade
        </a>
        <span className={styles.sentenceText}> </span>
        <span className={styles.sentenceTagPlain}>within {barLabel}</span>
      </span>,
    );
  }
  if (timeLockEnabled && timeLockAt)
    expertClauses.push(
      <span key='lock'>
        <span className={styles.sentenceText}>has </span>
        <a
          href='/docs#time-lock'
          target='_blank'
          rel='noopener noreferrer'
          className={styles.sentenceLink}
          onClick={() => closeExpertPanel()}
        >
          time-locked
        </a>
        <span className={styles.sentenceText}> first read</span>
        <span className={styles.sentenceTagPlain}>
          {new Date(timeLockAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </span>,
    );
  if (deferredMode && receiptEnabled)
    expertClauses.push(
      <span key='defer-receipt'>
        <span className={styles.sentenceText}>uses </span>
        <a
          href='/docs#deferred-activation'
          target='_blank'
          rel='noopener noreferrer'
          className={styles.sentenceLink}
          onClick={() => closeExpertPanel()}
        >
          dead drop
        </a>
        <span className={styles.sentenceText}> and </span>
        <a
          href='/docs#proof-of-read'
          target='_blank'
          rel='noopener noreferrer'
          className={styles.sentenceLink}
          onClick={() => closeExpertPanel()}
        >
          proof of read
        </a>
      </span>,
    );
  else if (deferredMode)
    expertClauses.push(
      <span key='defer'>
        <span className={styles.sentenceText}>uses </span>
        <a
          href='/docs#deferred-activation'
          target='_blank'
          rel='noopener noreferrer'
          className={styles.sentenceLink}
          onClick={() => closeExpertPanel()}
        >
          dead drop
        </a>
      </span>,
    );
  else if (receiptEnabled)
    expertClauses.push(
      <span key='receipt'>
        <span className={styles.sentenceText}>uses </span>
        <a
          href='/docs#proof-of-read'
          target='_blank'
          rel='noopener noreferrer'
          className={styles.sentenceLink}
          onClick={() => closeExpertPanel()}
        >
          proof of read
        </a>
      </span>,
    );
  if (decoyMessages.length > 0)
    expertClauses.push(
      <span key='decoys'>
        <span className={styles.sentenceText}>includes </span>
        <a
          href='/docs#decoy-links'
          target='_blank'
          rel='noopener noreferrer'
          className={styles.sentenceLink}
          onClick={() => closeExpertPanel()}
        >
          {decoyMessages.length} decoy {decoyMessages.length === 1 ? 'link' : 'links'}
        </a>
      </span>,
    );
  const contentKey = launchCode ? 'launch' : noteUrl ? 'link' : 'form';

  return (
    <ContentFade contentKey={contentKey}>
      {launchCode ? (
        <div className={styles.container}>
          <div className={styles.launchCodePanel}>
            <h3 className={styles.launchCodeHeading}>deferred note created</h3>
            <p className={styles.launchCodeDesc}>
              <strong style={{ color: 'var(--accent)' }}>save both the note link and the launch code below</strong>
              <br />
              you won't see them again. if either is lost, the note is
              unrecoverable.
              <br />
              the link becomes active only after you upload the launch code.
              <br />
              the note's ttl starts counting from the moment you activate, not
              from now. the launch code must be activated within 30 days.
            </p>
            {noteUrl && (
              <>
                <p className={styles.launchCodeLabel}>
                  {noteUrlCopied
                    ? 'copied to clipboard'
                    : 'note link (inactive until activated)'}
                </p>
                <div
                  className={styles.launchCodeBoxScroll}
                  onClick={() => {
                    navigator.clipboard.writeText(noteUrl);
                    setNoteUrlCopied(true);
                    setHasEverCopiedUrl(true);
                    setConfirmingLeave(false);
                    setTimeout(() => setNoteUrlCopied(false), 1500);
                  }}
                  title='click to copy'
                >
                  {noteUrl}
                </div>
                <div className={styles.launchCodeActions}>
                  <button
                    type='button'
                    className={styles.launchCodeBtn}
                    onClick={() => {
                      navigator.clipboard.writeText(noteUrl);
                      setNoteUrlCopied(true);
                      setHasEverCopiedUrl(true);
                      setConfirmingLeave(false);
                      setTimeout(() => setNoteUrlCopied(false), 1500);
                    }}
                  >
                    {noteUrlCopied ? 'copied' : 'copy link'}
                  </button>
                </div>
              </>
            )}
            <p className={styles.launchCodeLabel}>
              {launchCodeCopied ? 'copied to clipboard' : 'launch code'}
            </p>
            <div
              className={styles.launchCodeBoxScroll}
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(launchCode));
                setLaunchCodeCopied(true);
                setHasEverCopiedLaunchCode(true);
                setConfirmingLeave(false);
                setTimeout(() => setLaunchCodeCopied(false), 1500);
              }}
              title='click to copy'
            >
              {JSON.stringify(launchCode)}
            </div>
            <div className={styles.launchCodeActions}>
              <button
                type='button'
                className={styles.launchCodeBtn}
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(launchCode));
                  setLaunchCodeCopied(true);
                  setHasEverCopiedLaunchCode(true);
                  setConfirmingLeave(false);
                  setTimeout(() => setLaunchCodeCopied(false), 1500);
                }}
              >
                {launchCodeCopied ? 'copied' : 'copy launch code'}
              </button>
              <button
                type='button'
                className={styles.launchCodeBtn}
                onClick={() => {
                  setHasEverCopiedLaunchCode(true);
                  setConfirmingLeave(false);
                  const blob = new Blob([JSON.stringify(launchCode, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'notefade-launch-code.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                download as file
              </button>
            </div>
            <p
              className={styles.launchCodeDesc}
              style={{ marginTop: 12, marginBottom: 0 }}
            >
              when ready,{' '}
              <a href='/activate' style={{ color: 'var(--accent)' }}>
                activate at /activate
              </a>
            </p>
          </div>
          <div className={styles.createAnotherWrap}>
            {confirmingLeave && (
              <div className={styles.confirmBanner}>
                {!hasEverCopiedUrl && !hasEverCopiedLaunchCode
                  ? "you haven't copied the note link or the launch code yet"
                  : !hasEverCopiedUrl
                    ? "you haven't copied the note link yet"
                    : "you haven't copied the launch code yet"}
              </div>
            )}
            <a
              href={window.location.pathname}
              className={
                confirmingLeave
                  ? styles.createAnotherLinkDanger
                  : styles.createAnotherLink
              }
              onClick={(e) => {
                e.preventDefault();
                const allCopied = hasEverCopiedUrl && hasEverCopiedLaunchCode;
                if (!allCopied && !confirmingLeave) {
                  setConfirmingLeave(true);
                  return;
                }
                setHasEverCopiedUrl(false);
                setHasEverCopiedLaunchCode(false);
                setConfirmingLeave(false);
                setExpertOpen(false);
                setShowPassword(false);
                resetNote();
              }}
            >
              {confirmingLeave ? 'leave anyway' : 'create another'}
            </a>
          </div>
        </div>
      ) : noteUrl ? (
        <NoteLink
          url={noteUrl}
          compactUrl={compactUrl ?? undefined}
          expiresAt={expiresAt}
          shardId={shardId ?? ''}
          providerConfig={providerConfig}
          password={password}
          onCreateAnother={resetNote}
          readCount={readCount}
          receiptVerification={receiptVerification}
          decoyUrls={decoyUrls}
        />
      ) : (
        <div className={styles.container}>
          <div className={styles.textareaWrap}>
            <div
              className={`${styles.toolbar} ${showToolbar ? styles.toolbarVisible : ''}`}
            >
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={() => wrapSelection('**', '**')}
                onMouseDown={keepFocus}
                title='Bold'
                tabIndex={-1}
                disabled={!hasSelection}
              >
                B
              </button>
              <button
                type='button'
                className={`${styles.toolbarBtn} ${styles.toolbarBtnItalic}`}
                onClick={() => wrapSelection('*', '*')}
                onMouseDown={keepFocus}
                title='Italic'
                tabIndex={-1}
                disabled={!hasSelection}
              >
                I
              </button>
              <span className={styles.toolbarDivider} />
              <button
                type='button'
                className={styles.toolbarBtnHeading}
                onClick={() => insertHeading(1)}
                onMouseDown={keepFocus}
                title='Heading 1'
                tabIndex={-1}
              >
                H1
              </button>
              <button
                type='button'
                className={styles.toolbarBtnHeading}
                onClick={() => insertHeading(2)}
                onMouseDown={keepFocus}
                title='Heading 2'
                tabIndex={-1}
              >
                H2
              </button>
              <button
                type='button'
                className={styles.toolbarBtnHeading}
                onClick={() => insertHeading(3)}
                onMouseDown={keepFocus}
                title='Heading 3'
                tabIndex={-1}
              >
                H3
              </button>
              <span className={styles.toolbarDivider} />
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={insertBullet}
                onMouseDown={keepFocus}
                title='Bullet list'
                tabIndex={-1}
              >
                <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                  <circle cx='2.5' cy='4' r='1.2' fill='currentColor' />
                  <circle cx='2.5' cy='7' r='1.2' fill='currentColor' />
                  <circle cx='2.5' cy='10' r='1.2' fill='currentColor' />
                  <line
                    x1='5.5'
                    y1='4'
                    x2='12'
                    y2='4'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                  <line
                    x1='5.5'
                    y1='7'
                    x2='12'
                    y2='7'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                  <line
                    x1='5.5'
                    y1='10'
                    x2='12'
                    y2='10'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                </svg>
              </button>
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={insertNumberedList}
                onMouseDown={keepFocus}
                title='Numbered list'
                tabIndex={-1}
              >
                <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                  <text
                    x='1'
                    y='5.5'
                    fill='currentColor'
                    fontSize='5'
                    fontWeight='600'
                    fontFamily='system-ui'
                  >
                    1
                  </text>
                  <text
                    x='1'
                    y='8.5'
                    fill='currentColor'
                    fontSize='5'
                    fontWeight='600'
                    fontFamily='system-ui'
                  >
                    2
                  </text>
                  <text
                    x='1'
                    y='11.5'
                    fill='currentColor'
                    fontSize='5'
                    fontWeight='600'
                    fontFamily='system-ui'
                  >
                    3
                  </text>
                  <line
                    x1='5.5'
                    y1='4'
                    x2='12'
                    y2='4'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                  <line
                    x1='5.5'
                    y1='7'
                    x2='12'
                    y2='7'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                  <line
                    x1='5.5'
                    y1='10'
                    x2='12'
                    y2='10'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                </svg>
              </button>
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={insertToggle}
                onMouseDown={keepFocus}
                title='Toggle item'
                tabIndex={-1}
              >
                <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                  <rect
                    x='1.5'
                    y='3'
                    width='4.5'
                    height='4.5'
                    rx='1'
                    stroke='currentColor'
                    strokeWidth='1.2'
                  />
                  <line
                    x1='8'
                    y1='5.25'
                    x2='12.5'
                    y2='5.25'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                  <rect
                    x='1.5'
                    y='9'
                    width='4.5'
                    height='4.5'
                    rx='1'
                    stroke='currentColor'
                    strokeWidth='1.2'
                  />
                  <path
                    d='M2.8 11.25L4 12.5L5.5 10'
                    stroke='currentColor'
                    strokeWidth='1.1'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <line
                    x1='8'
                    y1='11.25'
                    x2='12.5'
                    y2='11.25'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                </svg>
              </button>
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={insertQuote}
                onMouseDown={keepFocus}
                title='Quote'
                tabIndex={-1}
              >
                <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                  <path
                    d='M3 4.5C3 3.67 3.67 3 4.5 3H5.5C5.78 3 6 3.22 6 3.5V5.5C6 6.33 5.33 7 4.5 7H4C4 8 4.5 9 5.5 9.5C5.22 10 4.5 10.5 3.5 10C2.5 9.5 2 8 2 6.5V5C2 4.72 2 4.5 3 4.5Z'
                    fill='currentColor'
                  />
                  <path
                    d='M9 4.5C9 3.67 9.67 3 10.5 3H11.5C11.78 3 12 3.22 12 3.5V5.5C12 6.33 11.33 7 10.5 7H10C10 8 10.5 9 11.5 9.5C11.22 10 10.5 10.5 9.5 10C8.5 9.5 8 8 8 6.5V5C8 4.72 8 4.5 9 4.5Z'
                    fill='currentColor'
                  />
                </svg>
              </button>
              <span className={styles.toolbarDivider} />
              <button
                type='button'
                className={styles.toolbarBtn}
                onClick={insertDivider}
                onMouseDown={keepFocus}
                title='Horizontal rule'
                tabIndex={-1}
              >
                <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                  <line
                    x1='1'
                    y1='7'
                    x2='13'
                    y2='7'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                  />
                </svg>
              </button>
              <div className={styles.toolbarSpacer} />
              {showFormatToggle && (
                <div
                  className={`${styles.formatToggle} ${styles.formatToggleDesktop}`}
                >
                  <button
                    type='button'
                    className={`${styles.formatToggleBtn} ${viewMode === 'write' ? styles.formatToggleActive : ''}`}
                    onClick={() => setViewMode('write')}
                    onMouseDown={keepFocus}
                  >
                    raw
                  </button>
                  <button
                    type='button'
                    className={`${styles.formatToggleBtn} ${viewMode === 'preview' ? styles.formatToggleActive : styles.formatTogglePulse}`}
                    onClick={() => setViewMode('preview')}
                    onMouseDown={keepFocus}
                  >
                    rendered
                  </button>
                </div>
              )}
            </div>

            {viewMode === 'preview' && showFormatToggle ? (
              <div className={styles.previewArea}>
                <NoteMarkdown plaintext={message} />
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  className={`${styles.textarea} ${isOverLimit ? styles.textareaOver : ''}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onSelect={(e) => {
                    const ta = e.currentTarget;
                    setHasSelection(ta.selectionStart !== ta.selectionEnd);
                  }}
                  rows={5}
                  disabled={loading}
                />
                {showTypewriter && (
                  <span className={styles.placeholder} aria-hidden>
                    {placeholder}
                    <span className={styles.cursor} />
                  </span>
                )}
              </>
            )}
            <div className={styles.charCountRow}>
              {showFormatToggle && (
                <div
                  className={`${styles.formatToggle} ${styles.formatToggleMobile}`}
                >
                  <button
                    type='button'
                    className={`${styles.formatToggleBtn} ${viewMode === 'write' ? styles.formatToggleActive : ''}`}
                    onClick={() => setViewMode('write')}
                    onMouseDown={keepFocus}
                  >
                    raw
                  </button>
                  <button
                    type='button'
                    className={`${styles.formatToggleBtn} ${viewMode === 'preview' ? styles.formatToggleActive : styles.formatTogglePulse}`}
                    onClick={() => setViewMode('preview')}
                    onMouseDown={keepFocus}
                  >
                    rendered
                  </button>
                </div>
              )}
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
                  {message.length}/{maxChars} chars
                </span>
              )}
            </div>
          </div>

          {expertOpen && (
            <div className={styles.expertPanel}>
              {/* — destruction — */}
              <div className={styles.expertSection}>
                <span className={styles.expertSectionHeader}>destruction</span>
                <div className={styles.expertSectionRow}>
                  <div className={styles.advancedRowWrap}>
                    <div className={styles.advancedRow}>
                      <span className={styles.advancedLabel}>
                        reads before destruct
                      </span>
                      <div className={styles.sliderGroup}>
                        <input
                          type='range'
                          className={styles.rangeSlider}
                          value={readCount}
                          onChange={(e) =>
                            setReadCount(parseInt(e.target.value, 10))
                          }
                          min={1}
                          max={maxReadCount}
                          step={1}
                          disabled={loading}
                        />
                        <span className={styles.sliderValue}>{readCount}</span>
                      </div>
                    </div>
                    {readCount === 1 && (
                      <span className={styles.advancedHint}>(one-time read)</span>
                    )}
                  </div>
                  <div className={styles.advancedRow}>
                    <span className={styles.advancedLabel}>
                      fade after reading
                    </span>
                    <div className={styles.ttlToggle}>
                      <div
                        className={styles.ttlSlider}
                        style={{
                          width: `calc(100% / ${barOptions.length} - 2px)`,
                          transform: `translateX(${barOptions.findIndex((o) => o.value === barDuration) * 100}%)`,
                        }}
                      />
                      {barOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type='button'
                          className={`${styles.ttlOption} ${barDuration === opt.value ? styles.ttlOptionActive : ''}`}
                          onClick={() => setBarDuration(opt.value)}
                          disabled={loading}
                          style={{ fontSize: '13px', padding: '5px 10px' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.expertDivider} />

              {/* — security — */}
              <div className={styles.expertSection}>
                <span className={styles.expertSectionHeader}>security</span>
                <div className={styles.expertSectionRow}>
                  <div className={styles.advancedRowWrap}>
                    <div className={styles.advancedRow}>
                      <span className={styles.advancedLabel}>time-lock</span>
                      <OnOffToggle
                        enabled={timeLockEnabled}
                        onToggle={() => {
                          if (!timeLockEnabled && !timeLockAt) {
                            setTimeLockAt(
                              new Date(Date.now() + 86400000)
                                .toISOString()
                                .slice(0, 16),
                            );
                          }
                          setTimeLockEnabled(!timeLockEnabled);
                        }}
                        disabled={loading}
                        small
                      />
                    </div>
                    {timeLockEnabled && (
                      <input
                        type='datetime-local'
                        className={styles.timeLockInput}
                        value={timeLockAt}
                        onChange={(e) => setTimeLockAt(e.target.value)}
                        min={new Date(Date.now() + 60000)
                          .toISOString()
                          .slice(0, 16)}
                        max={new Date(Date.now() + ttl * 1000)
                          .toISOString()
                          .slice(0, 16)}
                        disabled={loading}
                      />
                    )}
                    {timeLockEnabled && (
                      <span className={styles.advancedHint}>
                        client-enforced, not cryptographic
                      </span>
                    )}
                  </div>
                  <div className={styles.advancedRowWrap}>
                    <div className={styles.advancedRow}>
                      <span className={styles.advancedLabel}>dead drop mode</span>
                      <OnOffToggle
                        enabled={deferredMode}
                        onToggle={() => setDeferredMode(!deferredMode)}
                        disabled={loading || !canDefer}
                        small
                      />
                    </div>
                    {!canDefer && (
                      <span className={styles.advancedHint}>
                        requires default API or self-hosted worker
                      </span>
                    )}
                    {deferredMode && canDefer && (
                      <span className={styles.advancedHint}>
                        encrypt now, activate later via launch code
                      </span>
                    )}
                  </div>
                  <div className={styles.advancedRowWrap}>
                    <div className={styles.advancedRow}>
                      <span className={styles.advancedLabel}>proof of read</span>
                      <OnOffToggle
                        enabled={receiptEnabled}
                        onToggle={() => setReceiptEnabled(!receiptEnabled)}
                        disabled={loading}
                        small
                      />
                    </div>
                    {receiptEnabled && (
                      <span className={styles.advancedHint}>
                        reader can prove they decrypted the note
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.expertDivider} />

              {/* — plausible deniability — */}
              <div className={styles.expertSection}>
                <span className={styles.expertSectionHeader}>plausible deniability</span>
                <div className={styles.advancedRow}>
                  <span className={styles.advancedLabel}>decoy links</span>
                  <OnOffToggle
                    enabled={decoyEnabled}
                    onToggle={handleDecoyToggle}
                    disabled={loading}
                    small
                  />
                </div>
                {decoyEnabled && (
                  <>
                    <div className={styles.advancedRow}>
                      <span className={styles.advancedLabel}>count</span>
                      <div className={styles.sliderGroup}>
                        <input
                          type='range'
                          className={styles.rangeSlider}
                          value={decoyCount}
                          onChange={(e) => handleDecoyCountChange(Number(e.target.value))}
                          min={1}
                          max={3}
                          step={1}
                          disabled={loading}
                        />
                        <span className={styles.sliderValue}>{decoyCount}</span>
                      </div>
                    </div>
                    <div className={styles.decoyInputList}>
                      {decoyMessages.map((msg, i) => (
                        <div key={i} className={styles.decoyInputRow}>
                          <input
                            type='text'
                            className={styles.decoyInputField}
                            value={msg}
                            onChange={(e) => handleDecoyMessageChange(i, e.target.value)}
                            placeholder={`decoy message ${i + 1}`}
                            maxLength={1800}
                            disabled={loading}
                          />
                          <button
                            type='button'
                            className={styles.decoyRegenerateBtn}
                            onClick={() => handleDecoyRegenerate(i)}
                            disabled={loading}
                            title='regenerate message'
                          >
                            <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                              <path d='M2.5 7a4.5 4.5 0 018.3-2.4' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' />
                              <path d='M11.5 7a4.5 4.5 0 01-8.3 2.4' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' />
                              <path d='M10.2 2.2l.6 2.4-2.4-.6' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round' />
                              <path d='M3.8 11.8l-.6-2.4 2.4.6' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round' />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <span className={styles.advancedHint}>
                      real encrypted notes with alternate content, sent alongside your actual link
                    </span>
                  </>
                )}
              </div>

              <div className={styles.expertDivider} />

              {/* — server — */}
              <div className={styles.expertSection}>
                <span className={styles.expertSectionHeader}>server</span>
                <div>
                  <div className={styles.byosHeader}>
                    <span className={styles.byosTitle}>
                      custom self-hosted server
                    </span>
                    <span className={styles.byosSubtitle}>
                      meaningless 16 bytes stored
                    </span>
                  </div>

                  <div className={styles.serverToggle}>
                    <div
                      className={styles.serverToggleSlider}
                      style={{
                        transform:
                          byosMode === 'custom'
                            ? 'translateX(100%)'
                            : 'translateX(0)',
                      }}
                    />
                    <button
                      type='button'
                      className={`${styles.serverToggleOption} ${byosMode === 'default' ? styles.serverToggleOptionActive : ''}`}
                      onClick={() => handleModeSwitch('default')}
                    >
                      notefade server
                    </button>
                    <button
                      type='button'
                      className={`${styles.serverToggleOption} ${byosMode === 'custom' ? styles.serverToggleOptionActive : ''}`}
                      onClick={() => handleModeSwitch('custom')}
                    >
                      bring my own server
                    </button>
                  </div>

                  {byosMode === 'custom' && (
                    <div className={styles.byosConfig}>
                      <label className={styles.byosLabel}>provider</label>
                      <select
                        className={styles.byosSelect}
                        value={currentProviderType}
                        onChange={(e) =>
                          setProviderType(e.target.value as ProviderType)
                        }
                      >
                        {BYOS_PROVIDER_TYPES.map((type) => {
                          const entry = getProviderEntry(type);
                          return (
                            <option key={type} value={type}>
                              {entry?.label ?? type}
                            </option>
                          );
                        })}
                      </select>

                      {currentEntry?.showCredentialWarning && (
                        <p className={styles.credentialWarning}>
                          credentials are stored in the link and visible in
                          browser devtools
                        </p>
                      )}

                      {currentEntry?.fields.map((field, i) => (
                        <div key={field.key} className={styles.byosFieldGroup}>
                          <label className={styles.byosLabel}>
                            {field.label}
                          </label>
                          <input
                            ref={i === 0 ? firstFieldRef : undefined}
                            type={field.secret ? 'password' : 'text'}
                            className={styles.byosInput}
                            value={
                              providerConfig
                                ? getConfigFieldValue(providerConfig, field.key)
                                : ''
                            }
                            onChange={(e) =>
                              handleFieldChange(field.key, e.target.value)
                            }
                            placeholder={field.placeholder}
                            spellCheck={false}
                            autoComplete='off'
                          />
                        </div>
                      ))}

                    </div>
                  )}
                </div>
              </div>

              {hasExpertChanges && (
                <button
                  type='button'
                  className={styles.byosResetButton}
                  onClick={handleReset}
                >
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 14 14'
                    fill='none'
                  >
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
                  reset all
                </button>
              )}
            </div>
          )}

          <div className={styles.footer}>
            <div className={styles.footerTop}>
              <span className={styles.sentenceLine}>
                <span className={styles.sentenceText}>
                  your secret note will{' '}
                </span>
              </span>
              <span className={styles.sentenceLine}>
                <a
                  href='/docs#one-time-read'
                  target='_blank'
                  rel='noopener noreferrer'
                  className={styles.sentenceLink}
                  onClick={() => closeExpertPanel()}
                >
                  self-destruct
                </a>
                <span className={styles.sentenceText}> in </span>
                <span className={styles.sentenceControl}>
                  <span className={styles.ttlToggle}>
                    <span
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
                        onClick={() => {
                          setTtl(opt.value);
                          closeExpertPanel();
                        }}
                        disabled={loading}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </span>
                </span>
              </span>

              <span className={styles.sentenceLine}>
                <span className={styles.sentenceText}>
                  {' '}{expertClauses.length === 0 && <span className={styles.desktopOnly}>and </span>}is {passwordEnabled ? '' : 'not '}
                </span>
                <a
                  href='/docs#encryption'
                  target='_blank'
                  rel='noopener noreferrer'
                  className={styles.sentenceLink}
                  onClick={() => closeExpertPanel()}
                >
                  password protected
                </a>
                <span className={styles.sentenceText}> </span>
                <span className={styles.sentenceControl}>
                  <OnOffToggle
                    enabled={passwordEnabled}
                    onToggle={() => {
                      if (passwordEnabled) setPassword('');
                      setPasswordEnabled(!passwordEnabled);
                      closeExpertPanel();
                    }}
                    disabled={loading}
                  />
                </span>
              </span>
              {passwordEnabled && (
                <span className={styles.sentenceLine}>
                  <span className={styles.sentenceText}> with </span>
                  <span className={styles.sentenceControl}>
                    <span className={styles.passwordInputWrapper}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={styles.passwordInlineInput}
                        style={{ width: `${Math.max(14, password.length + 1)}ch` }}
                        value={password}
                        onChange={(e) =>
                          setPassword(e.target.value.slice(0, 24))
                        }
                        maxLength={24}
                        placeholder='password'
                        spellCheck={false}
                        autoComplete='off'
                        disabled={loading}
                      />
                      <button
                        type='button'
                        className={`${styles.copyPasswordButton} ${pwCopied ? styles.copyPasswordButtonCopied : ''}`}
                        onClick={() => {
                          if (pwCopied) return;
                          navigator.clipboard.writeText(password);
                          setShowPassword(false);
                          setPwCopied(true);
                          setTimeout(() => setPwCopied(false), 1500);
                        }}
                        title={pwCopied ? 'copied' : 'copy password'}
                        tabIndex={-1}
                        disabled={loading || password.length === 0}
                      >
                        {pwCopied ? (
                          <svg
                            width='14'
                            height='14'
                            viewBox='0 0 14 14'
                            fill='none'
                          >
                            <path
                              d='M3 7.5L5.5 10L11 4.5'
                              stroke='#22c55e'
                              strokeWidth='1.5'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                            />
                          </svg>
                        ) : (
                          <svg
                            width='14'
                            height='14'
                            viewBox='0 0 14 14'
                            fill='none'
                          >
                            <rect
                              x='4.5'
                              y='4.5'
                              width='7'
                              height='7'
                              rx='1.5'
                              stroke='currentColor'
                              strokeWidth='1.2'
                            />
                            <path
                              d='M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5'
                              stroke='currentColor'
                              strokeWidth='1.2'
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        type='button'
                        className={styles.showPasswordButton}
                        onClick={() => setShowPassword((prev) => !prev)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg
                            width='14'
                            height='14'
                            viewBox='0 0 14 14'
                            fill='none'
                          >
                            <path
                              d='M1.5 7s2.2-3.5 5.5-3.5S12.5 7 12.5 7s-2.2 3.5-5.5 3.5S1.5 7 1.5 7z'
                              stroke='currentColor'
                              strokeWidth='1.2'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                            />
                            <circle
                              cx='7'
                              cy='7'
                              r='1.8'
                              stroke='currentColor'
                              strokeWidth='1.2'
                            />
                          </svg>
                        ) : (
                          <svg
                            width='14'
                            height='14'
                            viewBox='0 0 14 14'
                            fill='none'
                          >
                            <path
                              d='M2 2l10 10M5.6 5.7a1.8 1.8 0 002.7 2.6'
                              stroke='currentColor'
                              strokeWidth='1.2'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                            />
                            <path
                              d='M4 4.3C2.7 5.2 1.5 7 1.5 7s2.2 3.5 5.5 3.5c1 0 1.9-.3 2.7-.8M9.5 9.2c1.5-1 2.9-2.7 3-2.7s-2.2-3.5-5.5-3.5c-.6 0-1.2.1-1.7.3'
                              stroke='currentColor'
                              strokeWidth='1.2'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        type='button'
                        className={styles.generatePasswordButton}
                        onClick={() => {
                          const charset =
                            'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*_';
                          const lenByte = new Uint8Array(1);
                          crypto.getRandomValues(lenByte);
                          const len = 16 + ((lenByte[0] ?? 0) % 9);
                          const bytes = new Uint8Array(len);
                          crypto.getRandomValues(bytes);
                          const pw = Array.from(
                            bytes,
                            (b) => charset[b % charset.length],
                          ).join('');
                          setPassword(pw);
                          setShowPassword(true);
                        }}
                        title='generate random password'
                        tabIndex={-1}
                        disabled={loading}
                      >
                        <svg
                          width='14'
                          height='14'
                          viewBox='0 0 14 14'
                          fill='none'
                        >
                          <path
                            d='M2.5 7a4.5 4.5 0 018.3-2.4'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                          />
                          <path
                            d='M11.5 7a4.5 4.5 0 01-8.3 2.4'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                          />
                          <path
                            d='M10.2 2.2l.6 2.4-2.4-.6'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                          <path
                            d='M3.8 11.8l-.6-2.4 2.4.6'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                        </svg>
                      </button>
                    </span>
                  </span>
                </span>
              )}

              {expertClauses.map((clause, i) => {
                const isLast = i === expertClauses.length - 1;
                const sep = isLast && expertClauses.length > 1 ? ' and ' : ' ';
                return (
                  <span key={i} className={styles.sentenceLine}>
                    <span className={styles.sentenceText}>{sep}</span>
                    {clause}
                  </span>
                );
              })}
              {isCustomServer && (
                <span className={styles.sentenceLine}>
                  <span className={styles.sentenceText}> at </span>
                  <a
                    href='/docs#self-hosting'
                    target='_blank'
                    rel='noopener noreferrer'
                    className={styles.sentenceLink}
                    onClick={() => closeExpertPanel()}
                  >
                    your server
                  </a>
                </span>
              )}
            </div>

            <div className={styles.footerRight}>
              <button
                type='button'
                className={`${styles.gearButton} ${expertOpen ? styles.gearButtonActive : ''}`}
                onClick={() => {
                  if (expertOpen) {
                    if (isCustomServer && !isProviderConfigComplete(providerConfig)) {
                      handleReset();
                    }
                    closeExpertPanel();
                  } else {
                    setExpertOpen(true);
                  }
                }}
                title='expert settings'
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

              <button
                type='button'
                className={styles.encryptButton}
                onClick={handleCreate}
                disabled={
                  isEmpty ||
                  isOverLimit ||
                  loading ||
                  (isCustomServer &&
                    !isProviderConfigComplete(providerConfig)) ||
                  (passwordEnabled && password.length === 0)
                }
              >
                {loading ? 'encrypting...' : 'encrypt'}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.error}>{`server error: ${error}`}</div>
          )}
        </div>
      )}
    </ContentFade>
  );
}

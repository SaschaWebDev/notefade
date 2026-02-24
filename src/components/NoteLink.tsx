import { useState, useCallback, useRef, useEffect } from 'react';
import { deleteShard, createAdapter } from '@/api';
import type { ProviderConfig } from '@/api/provider-types';
import styles from './NoteLink.module.css';

const STORAGE_KEY = 'notefade-base-url';

type DestroyState = 'idle' | 'confirming' | 'destroying' | 'destroyed';

interface NoteLinkProps {
  url: string;
  expiresAt: number;
  shardId: string;
  providerConfig: ProviderConfig | null;
  password: string;
  onCreateAnother: () => void;
}

function formatCountdown(diff: number): string {
  if (diff <= 0) return '0s';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0)
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDate(expiresAt: number): string {
  const date = new Date(expiresAt);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useCountdown(expiresAt: number): number {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, expiresAt - Date.now()),
  );

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

export function NoteLink({
  url,
  expiresAt,
  shardId,
  providerConfig,
  password,
  onCreateAnother,
}: NoteLinkProps) {
  const remaining = useCountdown(expiresAt);
  const [copyState, setCopyState] = useState<'idle' | 'shown' | 'fading'>(
    'idle',
  );
  const [hasCopied, setHasCopied] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pwCopied, setPwCopied] = useState<'idle' | 'shown' | 'fading'>('idle');
  const [destroyState, setDestroyState] = useState<DestroyState>('idle');
  const [destroyError, setDestroyError] = useState<string | null>(null);
  const [customBase, setCustomBase] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  );

  const pathname = window.location.pathname;
  const defaultBase = window.location.origin + pathname;

  const fragment = url.includes('#') ? url.slice(url.indexOf('#')) : '';
  const displayUrl = customBase
    ? customBase.replace(/\/+$/, '') + '/' + fragment
    : url;

  const handleCopy = useCallback(async () => {
    if (copyState !== 'idle') return;
    try {
      await navigator.clipboard.writeText(displayUrl);
    } catch {
      const input = document.createElement('input');
      input.value = displayUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setHasCopied(true);
    setConfirmingLeave(false);
    setCopyState('shown');
    setTimeout(() => setCopyState('fading'), 1200);
    setTimeout(() => setCopyState('idle'), 1600);
  }, [displayUrl, copyState]);

  const handleDestroy = useCallback(async () => {
    setDestroyState('destroying');
    setDestroyError(null);
    try {
      let deleted: boolean;
      if (providerConfig) {
        const adapter = createAdapter(providerConfig);
        deleted = await adapter.delete(shardId);
      } else {
        deleted = await deleteShard(shardId);
      }
      if (deleted) {
        setDestroyState('destroyed');
      } else {
        setDestroyState('idle');
        setDestroyError('note already read or expired');
      }
    } catch {
      setDestroyState('confirming');
      setDestroyError('failed to destroy — try again');
    }
  }, [shardId, providerConfig]);

  const isValidBaseUrl = (url: string): boolean => {
    if (!url) return true;
    return (
      url.startsWith('https://') ||
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1')
    );
  };

  const isCustom = Boolean(customBase) && customBase !== defaultBase;
  const isUnsafeBase = isCustom && !isValidBaseUrl(customBase);

  const handleBaseChange = (value: string) => {
    setCustomBase(value);
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleReset = () => {
    setCustomBase('');
    localStorage.removeItem(STORAGE_KEY);
    setSettingsOpen(false);
  };

  const copied = copyState !== 'idle';

  const baseUrlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settingsOpen) {
      baseUrlInputRef.current?.focus();
      baseUrlInputRef.current?.select();
    }
  }, [settingsOpen]);

  return (
    <div className={styles.container}>
      <h2
        className={
          destroyState === 'destroyed'
            ? styles.headingDestroyed
            : styles.heading
        }
      >
        <span className={styles.checkIcon}>
          {destroyState === 'destroyed' ? (
            <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
              <circle cx='10' cy='10' r='10' fill='rgba(239,68,68,0.12)' />
              <path
                d='M7 7l6 6M13 7l-6 6'
                stroke='rgba(239,68,68,0.85)'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
            </svg>
          ) : (
            <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
              <circle cx='10' cy='10' r='10' fill='rgba(79,143,247,0.12)' />
              <path
                d='M6 10.5L8.5 13L14 7.5'
                stroke='#4f8ff7'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          )}
        </span>
        {destroyState === 'destroyed'
          ? 'note securely destroyed'
          : fragment.startsWith('#protected:')
            ? 'encrypted password protected note ready'
            : 'encrypted note ready'}
      </h2>
      <p className={styles.description}>
        {destroyState === 'destroyed'
          ? 'the link is now permanently invalid'
          : fragment.startsWith('#protected:')
            ? 'share this link and password — it works exactly once'
            : 'share this link — it works exactly once'}
      </p>

      {destroyState !== 'destroyed' && (
        <div className={styles.metaRow}>
          <div
            className={styles.expiryBadge}
            onClick={() =>
              navigator.clipboard.writeText(String(Math.floor(expiresAt / 1000)))
            }
            role='button'
            tabIndex={0}
            title='copy unix timestamp'
            style={{ cursor: 'pointer' }}
          >
            <svg
              className={styles.expiryIcon}
              width='12'
              height='12'
              viewBox='0 0 12 12'
              fill='none'
            >
              <circle
                cx='6'
                cy='6'
                r='5'
                stroke='currentColor'
                strokeWidth='1.2'
              />
              <path
                d='M6 3.5V6l2 1.5'
                stroke='currentColor'
                strokeWidth='1.2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
            {remaining <= 0 ? (
              'expired'
            ) : (
              <>
                self-destructs in (
                <span className={styles.countdown}>
                  {formatCountdown(remaining)}
                </span>
                ) at {formatDate(expiresAt)}
              </>
            )}
          </div>

          {fragment.startsWith('#protected:') && password.length > 0 && (
            <div className={styles.passwordDisplay}>
              <span className={styles.passwordLabel}>password</span>
              <span className={styles.passwordText}>
                {showPw ? password : '\u2022'.repeat(Math.min(password.length, 20))}
              </span>
              <button
                type='button'
                className={styles.passwordAction}
                onClick={() => {
                  if (pwCopied !== 'idle') return;
                  navigator.clipboard.writeText(password);
                  setShowPw(false);
                  setPwCopied('shown');
                  setTimeout(() => setPwCopied('fading'), 1200);
                  setTimeout(() => setPwCopied('idle'), 1600);
                }}
                title={pwCopied !== 'idle' ? 'copied' : 'copy password'}
              >
                {pwCopied !== 'idle' ? (
                  <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                    <path
                      d='M3 7.5L5.5 10L11 4.5'
                      stroke='#22c55e'
                      strokeWidth='1.5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                ) : (
                  <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
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
                className={styles.passwordAction}
                onClick={() => setShowPw((prev) => !prev)}
                title={showPw ? 'hide password' : 'reveal password'}
              >
                {showPw ? (
                  <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
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
                  <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
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
            </div>
          )}
        </div>
      )}

      {destroyState !== 'destroyed' && (
        <>
          <div
            className={`${styles.linkBox} ${copied ? styles.linkBoxCopied : ''}`}
            onClick={handleCopy}
            role='button'
            tabIndex={0}
          >
            <span className={styles.linkText}>
              {settingsOpen ? (
                <>
                  <span className={styles.linkBase}>
                    {customBase
                      ? customBase.replace(/\/+$/, '') + '/'
                      : displayUrl.slice(0, displayUrl.indexOf('#'))}
                  </span>
                  {fragment}
                </>
              ) : (
                displayUrl
              )}
            </span>
            <div className={styles.linkActions}>
              <button
                type='button'
                className={styles.copyIcon}
                onClick={handleCopy}
                title={copied ? 'copied' : 'copy to clipboard'}
              >
                {copied ? (
                  <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
                    <path
                      d='M3.5 8.5L6 11L12.5 4.5'
                      stroke='#22c55e'
                      strokeWidth='1.5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                ) : (
                  <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
                    <rect
                      x='5.5'
                      y='5.5'
                      width='7'
                      height='7'
                      rx='1.5'
                      stroke='currentColor'
                      strokeWidth='1.2'
                    />
                    <path
                      d='M10.5 5.5V4a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5'
                      stroke='currentColor'
                      strokeWidth='1.2'
                    />
                  </svg>
                )}
              </button>
              <button
                type='button'
                className={`${styles.settingsIcon} ${settingsOpen ? styles.settingsIconActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsOpen((prev) => {
                    if (prev) {
                      handleReset();
                    }
                    return !prev;
                  });
                }}
                title='change base URL'
              >
                <svg width='14' height='14' viewBox='0 0 15 15' fill='none'>
                  <path
                    d='M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.67748 2.02413 3.23978 2.07312 2.95903 2.35386L2.35294 2.95996C2.0722 3.2407 2.0232 3.6784 2.23493 4.01427L2.80942 4.92561C2.62307 5.2645 2.47227 5.62589 2.36216 6.00472L1.31209 6.24287C0.924883 6.33065 0.650024 6.6748 0.650024 7.07183V7.92897C0.650024 8.32601 0.924883 8.67015 1.31209 8.75794L2.36228 8.99603C2.47246 9.375 2.62335 9.73652 2.80979 10.0755L2.2356 10.9867C2.02388 11.3225 2.07287 11.7602 2.35361 12.0409L2.95971 12.647C3.24045 12.9278 3.67815 12.9768 4.01402 12.7651L4.92537 12.1906C5.26429 12.377 5.62571 12.5278 6.00457 12.638L6.24265 13.6878C6.33043 14.075 6.67457 14.3499 7.07161 14.3499H7.92875C8.32579 14.3499 8.66993 14.075 8.75771 13.6878L8.99588 12.6376C9.37462 12.5275 9.73594 12.3767 10.0748 12.1904L10.9862 12.7651C11.3221 12.9768 11.7598 12.9278 12.0405 12.647L12.6466 12.0409C12.9274 11.7602 12.9764 11.3225 12.7646 10.9867L12.1904 10.0755C12.3768 9.73666 12.5275 9.37524 12.6376 8.99636L13.6878 8.75827C14.075 8.67049 14.3499 8.32635 14.3499 7.92931V7.07217C14.3499 6.67513 14.075 6.33099 13.6878 6.2432L12.6376 6.00513C12.5275 5.62629 12.3767 5.26491 12.1904 4.92598L12.7649 4.01453C12.9766 3.67866 12.9276 3.24096 12.6469 2.96022L12.0408 2.35412C11.76 2.07338 11.3223 2.02439 10.9865 2.23611L10.0751 2.81046C9.73622 2.62409 9.37484 2.47326 8.99602 2.36315L8.75791 1.31297C8.67012 0.925765 8.32598 0.650906 7.92895 0.650906L7.07095 0.650238ZM4.92053 4.92126C5.97631 3.86548 7.65891 3.72906 8.87069 4.58398C10.2267 5.54498 10.5765 7.41498 9.62552 8.78098C8.90457 9.80798 7.64917 10.2478 6.49805 9.9478C5.1726 9.60398 4.27266 8.35878 4.27266 6.99978C4.27266 6.22978 4.57266 5.26918 4.92053 4.92126Z'
                    fill='currentColor'
                    fillRule='evenodd'
                    clipRule='evenodd'
                  />
                </svg>
              </button>
            </div>
            {copied && (
              <span
                className={`${styles.copiedHint} ${copyState === 'fading' ? styles.copiedHintFading : ''}`}
              >
                copied to clipboard
              </span>
            )}
          </div>

          {settingsOpen && (
            <div className={styles.settingsRow}>
              <label className={styles.settingsLabel}>
                custom frontend base url
              </label>
              <div className={styles.settingsInputRow}>
                <input
                  ref={baseUrlInputRef}
                  type='text'
                  className={`${styles.baseUrlInput} ${isUnsafeBase ? styles.baseUrlInputUnsafe : ''}`}
                  value={customBase || defaultBase}
                  onChange={(e) => handleBaseChange(e.target.value)}
                  onFocus={(e) => {
                    if (!customBase) {
                      setCustomBase(defaultBase);
                      localStorage.setItem(STORAGE_KEY, defaultBase);
                    }
                    e.target.select();
                  }}
                  spellCheck={false}
                />
                {customBase && (
                  <button
                    type='button'
                    className={styles.resetLink}
                    onClick={handleReset}
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
              {isUnsafeBase && (
                <p className={styles.unsafeWarning}>
                  non-https base URL — links may not be secure
                </p>
              )}
            </div>
          )}
        </>
      )}

      {confirmingLeave && (
        <div className={styles.confirmBanner}>
          you haven't copied the link yet — it can't be recovered
        </div>
      )}

      <a
        href={pathname}
        className={
          confirmingLeave ? styles.anotherLinkDanger : styles.anotherLink
        }
        onClick={(e) => {
          e.preventDefault();
          if (!hasCopied && !confirmingLeave && destroyState !== 'destroyed') {
            setConfirmingLeave(true);
            return;
          }
          onCreateAnother();
        }}
      >
        {confirmingLeave ? 'leave anyway' : 'create another'}
      </a>

      {destroyState !== 'destroyed' && (
        <div className={styles.destroySection}>
          {destroyState === 'confirming' ? (
            <>
              <div className={styles.destroyBanner}>
                this will permanently invalidate the link
              </div>
              <div className={styles.destroyActions}>
                <button
                  type='button'
                  className={styles.destroyConfirmButton}
                  onClick={handleDestroy}
                >
                  confirm destroy
                </button>
                <button
                  type='button'
                  className={styles.destroyCancelButton}
                  onClick={() => {
                    setDestroyState('idle');
                    setDestroyError(null);
                  }}
                >
                  cancel
                </button>
              </div>
              {destroyError && (
                <p className={styles.destroyError}>{destroyError}</p>
              )}
            </>
          ) : destroyState === 'destroying' ? (
            <span className={styles.destroyButton} style={{ opacity: 0.5 }}>
              destroying...
            </span>
          ) : (
            <>
              <button
                type='button'
                className={styles.destroyButton}
                onClick={() => setDestroyState('confirming')}
              >
                destroy now
              </button>
              {destroyError && (
                <p className={styles.destroyError}>{destroyError}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

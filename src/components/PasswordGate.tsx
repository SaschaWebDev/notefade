import { useState, type FormEvent } from 'react';
import { unprotectFragment } from '@/crypto';
import { parseFragment } from '@/hooks/use-hash-route';
import { ReadNote } from './ReadNote';
import { ContentFade } from './ContentFade';
import styles from './PasswordGate.module.css';

interface PasswordGateProps {
  protectedData: string;
}

type GateState =
  | { status: 'idle' }
  | { status: 'unlocking' }
  | { status: 'error'; message: string }
  | { status: 'unlocked'; shardId: string; shardIds: string[]; urlPayload: string; check: string | null; provider: import('@/api/provider-types').ProviderConfig | null; timeLockAt: number | null }

export function PasswordGate({ protectedData }: PasswordGateProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<GateState>({ status: 'idle' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || state.status === 'unlocking') return;

    setState({ status: 'unlocking' });

    try {
      const innerFragment = await unprotectFragment(protectedData, password);

      // Clear URL bar for security
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      const parsed = parseFragment(innerFragment);
      if (!parsed) {
        setState({ status: 'error', message: 'Decrypted data is not a valid note link.' });
        return;
      }

      setState({
        status: 'unlocked',
        shardId: parsed.shardId,
        shardIds: parsed.shardIds,
        urlPayload: parsed.urlPayload,
        check: parsed.check,
        provider: parsed.provider,
        timeLockAt: parsed.timeLockAt,
      });
    } catch {
      setState({ status: 'error', message: 'wrong password' });
    }
  };

  if (state.status === 'unlocked') {
    return (
      <ReadNote
        shardId={state.shardId}
        shardIds={state.shardIds}
        urlPayload={state.urlPayload}
        check={state.check}
        provider={state.provider}
        timeLockAt={state.timeLockAt}
      />
    );
  }

  const stateKey = state.status === 'unlocking' ? 'unlocking' : 'gate';

  return (
    <ContentFade contentKey={stateKey}>
      {state.status === 'unlocking' ? (
        <div className={styles.container}>
          <div className={styles.spinner} />
          <span className={styles.unlockingText}>unlocking...</span>
        </div>
      ) : (
        <div className={styles.container}>
          <div className={styles.icon}>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='none'>
              <rect
                x='5'
                y='11'
                width='14'
                height='10'
                rx='2'
                stroke='rgba(255,255,255,0.4)'
                strokeWidth='1.5'
                fill='rgba(255,255,255,0.03)'
              />
              <path
                d='M8 11V8a4 4 0 018 0v3'
                stroke='rgba(255,255,255,0.4)'
                strokeWidth='1.5'
                strokeLinecap='round'
                fill='none'
              />
              <circle cx='12' cy='16' r='1.5' fill='rgba(255,255,255,0.3)' />
            </svg>
          </div>

          <h2 className={styles.heading}>this note is password protected</h2>
          <p className={styles.subheading}>
            enter the password to unlock and read it
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='password'
                autoFocus
                autoComplete='off'
                spellCheck={false}
              />
              <button
                type='button'
                className={styles.showPasswordButton}
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width='16' height='16' viewBox='0 0 14 14' fill='none'>
                    <path d='M1.5 7s2.2-3.5 5.5-3.5S12.5 7 12.5 7s-2.2 3.5-5.5 3.5S1.5 7 1.5 7z' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round' />
                    <circle cx='7' cy='7' r='1.8' stroke='currentColor' strokeWidth='1.2' />
                  </svg>
                ) : (
                  <svg width='16' height='16' viewBox='0 0 14 14' fill='none'>
                    <path d='M2 2l10 10M5.6 5.7a1.8 1.8 0 002.7 2.6' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round' />
                    <path d='M4 4.3C2.7 5.2 1.5 7 1.5 7s2.2 3.5 5.5 3.5c1 0 1.9-.3 2.7-.8M9.5 9.2c1.5-1 2.9-2.7 3-2.7s-2.2-3.5-5.5-3.5c-.6 0-1.2.1-1.7.3' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round' />
                  </svg>
                )}
              </button>
            </div>

            {state.status === 'error' && (
              <p className={styles.error}>{state.message}</p>
            )}

            <button
              type='submit'
              className={styles.unlockButton}
              disabled={password.length === 0}
            >
              unlock
            </button>
          </form>
        </div>
      )}
    </ContentFade>
  );
}

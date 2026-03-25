import { useState, type FormEvent } from 'react';
import { unprotectFragment } from '@/crypto';
import { parseFragment, parseMultiFragment } from '@/hooks/use-hash-route';
import type { ParsedFragment } from '@/hooks/use-hash-route';
import { MULTI_PREFIX } from '@/constants';
import { ReadNote } from '../read-note';
import { ContentFade } from '@/components/ui/content-fade';
import { IconPadlock, IconEye, IconEyeOff } from '@/components/ui/icons';
import styles from './PasswordGate.module.css';

interface PasswordGateProps {
  protectedData: string;
  byokKey?: string | null;
}

type GateState =
  | { status: 'idle' }
  | { status: 'unlocking' }
  | { status: 'error'; message: string }
  | { status: 'unlocked'; shardId: string; shardIds: string[]; urlPayload: string; check: string | null; provider: import('@/api/provider-types').ProviderConfig | null; timeLockAt: number | null; multiChunks: ParsedFragment[] | null }

export function PasswordGate({ protectedData, byokKey }: PasswordGateProps) {
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

      // Check for multi-chunk inside the protected fragment
      if (innerFragment.startsWith(MULTI_PREFIX)) {
        const body = innerFragment.slice(MULTI_PREFIX.length);
        const chunks = parseMultiFragment(body);
        if (!chunks || chunks.length === 0) {
          setState({ status: 'error', message: 'Decrypted data is not a valid note link.' });
          return;
        }
        const first = chunks[0]!;
        setState({
          status: 'unlocked',
          shardId: first.shardId,
          shardIds: first.shardIds,
          urlPayload: first.urlPayload,
          check: first.check,
          provider: first.provider,
          timeLockAt: first.timeLockAt,
          multiChunks: chunks,
        });
        return;
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
        multiChunks: null,
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
        multiChunks={state.multiChunks}
        byokKey={byokKey}
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
            <IconPadlock />
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
                  <IconEye size={16} />
                ) : (
                  <IconEyeOff size={16} />
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

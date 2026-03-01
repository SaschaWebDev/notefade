import type { ReactNode } from 'react';
import { LandingShell, FadeSection } from './LandingShell';
import styles from './LandingComparison.module.css';

interface ComparisonRow {
  readonly label: string;
  readonly notefade: ReactNode;
  readonly typical: ReactNode;
}

function CheckIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
      <path
        d='M3 7.5L5.5 10L11 4'
        stroke='#34d399'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function Yes() {
  return (
    <span className={styles.checkYes}>
      <CheckIcon />
      Yes
    </span>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <span className={styles.checkText}>
      <CheckIcon />
      {children}
    </span>
  );
}

function Some() {
  return (
    <span className={styles.warnSome}>
      <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
        <path
          d='M3 8.5c1.5-2 3.5-2 4 0s2.5 2 4 0'
          stroke='#f59e0b'
          strokeWidth='1.5'
          strokeLinecap='round'
        />
      </svg>
      Some
    </span>
  );
}

function No() {
  return (
    <span className={styles.checkNo}>
      <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
        <path
          d='M4 5.5l6 6M10 5.5l-6 6'
          stroke='#f87171'
          strokeWidth='1.5'
          strokeLinecap='round'
        />
      </svg>
      No
    </span>
  );
}

const COMPARISON: readonly ComparisonRow[] = [
  // --- Core ---
  {
    label: 'One-time read',
    notefade: <Yes />,
    typical: (
      <Check>
        <span className={styles.greenText}>Most</span>
      </Check>
    ),
  },
  {
    label: 'No app install required',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(web tool)</span>
      </Check>
    ),
    typical: (
      <Check>
        <span className={styles.greenText}>Yes</span>
      </Check>
    ),
  },
  {
    label: 'Time-expiring notes',
    notefade: (
      <Check>
        <span className={styles.greenText}>All notes auto expire</span>
      </Check>
    ),
    typical: <Some />,
  },
  {
    label: 'Password protection',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(optional)</span>
      </Check>
    ),
    typical: <Some />,
  },
  // --- Encryption & crypto ---
  {
    label: 'Encryption',
    notefade: (
      <>
        <Check>
          <span className={styles.greenText}>
            Beyond encryption, math proven unbreakable
          </span>
        </Check>
        <br />
        <span className={styles.dimDetail}>
          Encrypted{' '}
          <a
            href='https://security.stackexchange.com/questions/176376/what-exactly-is-client-side-encryption#:~:text=this%20means%20you%20don%27t%20need%20to%20trust%20the%20service%20provider%20to%20handle%20your%20data%20confidentially.'
            target='_blank'
            rel='noopener noreferrer'
            className={styles.dimLink}
          >
            client-side
          </a>{' '}
          with{' '}
          <a
            href='https://security.stackexchange.com/questions/82389/calculate-time-taken-to-break-aes-key#:~:text=around%201.75%20vigintillion%20(that%27s%201.75*1063)%20years%2C%20or%20around%201.3*1053%20times%20the%20age%20of%20the%20universe.'
            target='_blank'
            rel='noopener noreferrer'
            className={styles.dimLink}
          >
            AES-256-GCM
          </a>{' '}
          in browser,
          <br />
          then{' '}
          <a
            href='https://en.wikipedia.org/wiki/One-time_pad#:~:text=These%20requirements%20make%20the%20OTP%20the%20only%20known%20encryption%20system%20that%20is%20mathematically%20proven%20to%20be%20unbreakable%20under%20the%20principles%20of%20information%20theory.'
            target='_blank'
            rel='noopener noreferrer'
            className={styles.dimLink}
          >
            zero-knowledge XOR split
          </a>{' '}
          to{' '}
          <a
            href='https://www.lenovo.com/us/en/glossary/ephemeral/?orgRef=https%253A%252F%252Fwww.google.com%252F#:~:text=Ephemeral%20keys%2C%20also%20known%20as%20temporary%20keys%20or%20session%20keys%2C%20are%20frequently%20used%20in%20encryption%20protocols%20like%20Diffie%2DHellman%20key%20exchange.%20These%20keys%20are%20generated%20for%20individual%20sessions%20and%20discarded%20once%20the%20session%20is%20complete.'
            target='_blank'
            rel='noopener noreferrer'
            className={styles.dimLink}
          >
            ephemeral shards
          </a>
          ,<br />
          reconstructed only by the reader
        </span>
      </>
    ),
    typical: (
      <span className={styles.checkNo}>
        <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
          <path
            d='M4 5.5l6 6M10 5.5l-6 6'
            stroke='#f87171'
            strokeWidth='1.5'
            strokeLinecap='round'
          />
        </svg>
        Server-side (trust in provider)
      </span>
    ),
  },
  {
    label: 'Zero crypto dependencies',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(Web Crypto API)</span>
      </Check>
    ),
    typical: <No />,
  },
  {
    label: 'Researched secure crypto algorithm',
    notefade: <Yes />,
    typical: <Some />,
  },
  {
    label: 'Password / hash never reaches server',
    notefade: <Yes />,
    typical: <No />,
  },
  // --- Server & data ---
  {
    label: 'Server knows nothing',
    notefade: (
      <Check>
        <span className={styles.greenText}>Meaningless data</span>{' '}
        <span className={styles.dimDetail}>(16-byte shard)</span>
      </Check>
    ),
    typical: (
      <span className={styles.checkNo}>
        <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
          <path
            d='M4 5.5l6 6M10 5.5l-6 6'
            stroke='#f87171'
            strokeWidth='1.5'
            strokeLinecap='round'
          />
        </svg>
        Full encrypted message (with metadata)
      </span>
    ),
  },
  {
    label: 'Secret note never reaches server',
    notefade: (
      <Check>
        <span className={styles.greenText}>Never</span>
      </Check>
    ),
    typical: (
      <span className={styles.checkNo}>
        <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
          <path
            d='M4 5.5l6 6M10 5.5l-6 6'
            stroke='#f87171'
            strokeWidth='1.5'
            strokeLinecap='round'
          />
        </svg>
        Stored on server
      </span>
    ),
  },
  {
    label: 'Data breach proof',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(nothing to steal)</span>
      </Check>
    ),
    typical: <No />,
  },
  {
    label: 'Subpoena-proof',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(no data exists)</span>
      </Check>
    ),
    typical: <No />,
  },
  // --- Privacy & trust ---
  {
    label: 'No cookies or tracking',
    notefade: <Yes />,
    typical: <No />,
  },
  {
    label: 'No third-party scripts',
    notefade: <Yes />,
    typical: <No />,
  },
  {
    label: 'GDPR compliant by design',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(no personal data)</span>
      </Check>
    ),
    typical: <Some />,
  },
  {
    label: 'Open source, transparent, tested',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(code &amp; docs)</span>
      </Check>
    ),
    typical: (
      <span className={styles.checkNo}>
        <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
          <path
            d='M4 5.5l6 6M10 5.5l-6 6'
            stroke='#f87171'
            strokeWidth='1.5'
            strokeLinecap='round'
          />
        </svg>
        Usually not
      </span>
    ),
  },
  {
    label: 'Reproducible, verifiable builds',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(SRI + manifests)</span>
      </Check>
    ),
    typical: <No />,
  },
  // --- Usability & access ---
  {
    label: 'Without accounts or sign-up',
    notefade: <Yes />,
    typical: (
      <Check>
        <span className={styles.greenText}>Most</span>
      </Check>
    ),
  },
  {
    label: 'Read anytime without writer online',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(async read/write)</span>
      </Check>
    ),
    typical: <Some />,
  },
  {
    label: 'Self-host server',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(optional)</span>
      </Check>
    ),
    typical: <No />,
  },
  {
    label: 'Self-host frontend',
    notefade: (
      <Check>
        <span className={styles.greenText}>Yes</span>{' '}
        <span className={styles.dimDetail}>(optional)</span>
      </Check>
    ),
    typical: <No />,
  },
];

export function LandingComparisonContent() {
  return (
    <>
      {/* Comparison Table Section */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <FadeSection>
            <h2 className={styles.sectionLabel}>notefade.com vs. Others</h2>
          </FadeSection>

          <FadeSection delay={100}>
            <div className={styles.tableWrapper}>
              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th className={styles.thLabel}></th>
                    <th className={styles.thNotefade}>notefade.com</th>
                    <th className={styles.thTypical}>
                      Other secret note services
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr
                      key={row.label}
                      className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}
                    >
                      <td className={styles.tdLabel}>{row.label}</td>
                      <td className={styles.tdNotefade}>{row.notefade}</td>
                      <td className={styles.tdTypical}>{row.typical}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeSection>

          <FadeSection delay={200}>
            <p className={styles.tableFootnote}>
              We can&apos;t prevent screenshots, clipboard copying, or someone
              simply remembering the content — no one can. What we guarantee is
              that nothing meaningful ever exists on our servers.
            </p>
          </FadeSection>
        </div>
      </section>
    </>
  );
}

export function LandingComparison() {
  return (
    <LandingShell>
      <LandingComparisonContent />
    </LandingShell>
  );
}

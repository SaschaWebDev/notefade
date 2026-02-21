import { LandingShell, FadeSection } from './LandingShell';
import styles from './LandingV4.module.css';

const EXPLANATIONS = [
  {
    title: 'The Split',
    body: 'A 32-byte encryption key is generated in your browser and split via XOR. 16 bytes go to our server as a meaningless shard. The remaining 32-byte share stays in the URL. Neither half works alone — both are required to reconstruct the key.',
  },
  {
    title: 'The Fetch',
    body: 'When the recipient opens the link, the client fetches the 16-byte shard from our server. The server deletes it immediately — before responding. One read, then gone.',
  },
  {
    title: 'The Fade',
    body: 'With both halves reunited, the client reconstructs the key, decrypts the note, and displays it. The shard is already gone. The key is zeroed. Nothing remains on any server.',
  },
] as const;

interface ComparisonRow {
  readonly label: string;
  readonly notefade: string;
  readonly typical: string;
}

const COMPARISON: readonly ComparisonRow[] = [
  {
    label: 'Server stores',
    notefade: '16-byte shard',
    typical: 'full encrypted message',
  },
  {
    label: 'Content visible to server',
    notefade: 'never',
    typical: 'encrypted, but stored',
  },
  {
    label: 'After reading',
    notefade: 'shard deleted',
    typical: 'still accessible',
  },
  {
    label: 'Encryption',
    notefade: 'client-side AES-256-GCM',
    typical: 'server-side or TLS only',
  },
  {
    label: 'Accounts required',
    notefade: 'none',
    typical: 'usually',
  },
];

function ArchitectureDiagram() {
  return (
    <div className={styles.diagramWrapper}>
      <svg
        viewBox="0 0 980 380"
        className={styles.diagram}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Architecture diagram showing the encryption and decryption flow"
      >
        <defs>
          <linearGradient id="v4-strokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(79, 143, 247, 0.6)" />
            <stop offset="50%" stopColor="rgba(79, 143, 247, 0.2)" />
            <stop offset="100%" stopColor="rgba(79, 143, 247, 0.6)" />
          </linearGradient>

          <linearGradient id="v4-nodeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(79, 143, 247, 0.08)" />
            <stop offset="100%" stopColor="rgba(79, 143, 247, 0.02)" />
          </linearGradient>

          <linearGradient id="v4-splitAccent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(79, 143, 247, 0.4)" />
            <stop offset="100%" stopColor="rgba(79, 143, 247, 0.15)" />
          </linearGradient>

          <filter id="v4-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ---- Connector lines (drawn first, behind nodes) ---- */}

        {/* User -> Encrypt */}
        <line
          x1="130" y1="190" x2="230" y2="190"
          className={styles.connector}
        />

        {/* Encrypt -> Split Key */}
        <line
          x1="370" y1="190" x2="430" y2="190"
          className={styles.connector}
        />

        {/* Split Key -> URL Fragment (upward branch) */}
        <path
          d="M 570 190 Q 600 190, 620 120 L 650 100"
          fill="none"
          className={styles.connector}
        />

        {/* Split Key -> Server Shard (downward branch) */}
        <path
          d="M 570 190 Q 600 190, 620 260 L 650 280"
          fill="none"
          className={styles.connector}
        />

        {/* URL Fragment -> Recipient (converge upward) */}
        <path
          d="M 790 100 Q 810 100, 820 140 L 830 160"
          fill="none"
          className={styles.connector}
        />

        {/* Server Shard -> Recipient (converge downward) */}
        <path
          d="M 790 280 Q 810 280, 820 240 L 830 220"
          fill="none"
          className={styles.connector}
        />

        {/* Animated flow lines (overlay) */}
        <line
          x1="130" y1="190" x2="230" y2="190"
          className={styles.flowLine}
        />
        <line
          x1="370" y1="190" x2="430" y2="190"
          className={styles.flowLine}
        />
        <path
          d="M 570 190 Q 600 190, 620 120 L 650 100"
          fill="none"
          className={styles.flowLineUp}
        />
        <path
          d="M 570 190 Q 600 190, 620 260 L 650 280"
          fill="none"
          className={styles.flowLineDown}
        />
        <path
          d="M 790 100 Q 810 100, 820 140 L 830 160"
          fill="none"
          className={styles.flowLineConvergeUp}
        />
        <path
          d="M 790 280 Q 810 280, 820 240 L 830 220"
          fill="none"
          className={styles.flowLineConvergeDown}
        />

        {/* ---- Nodes ---- */}

        {/* User */}
        <rect x="20" y="160" width="110" height="60" rx="12" className={styles.node} />
        <text x="75" y="195" className={styles.nodeLabel}>User</text>

        {/* Encrypt */}
        <rect x="230" y="160" width="140" height="60" rx="12" className={styles.node} />
        <text x="300" y="195" className={styles.nodeLabel}>Encrypt Note</text>
        <text x="300" y="212" className={styles.nodeSubLabel}>AES-256-GCM</text>

        {/* Split Key */}
        <rect x="430" y="155" width="140" height="70" rx="12" className={styles.nodeSplit} />
        <text x="500" y="188" className={styles.nodeLabel}>Split Key</text>
        <text x="500" y="210" className={styles.nodeSubLabel}>XOR into 2 shares</text>

        {/* URL Fragment */}
        <rect x="650" y="70" width="140" height="60" rx="12" className={styles.node} />
        <text x="720" y="96" className={styles.nodeLabel}>URL Fragment</text>
        <text x="720" y="116" className={styles.nodeSubLabel}>32-byte share + IV</text>

        {/* Server Shard */}
        <rect x="650" y="250" width="140" height="60" rx="12" className={styles.node} />
        <text x="720" y="276" className={styles.nodeLabel}>Server Shard</text>
        <text x="720" y="296" className={styles.nodeSubLabel}>16 bytes, auto-expiring</text>

        {/* Recipient / Decrypt */}
        <rect x="830" y="155" width="55" height="70" rx="12" className={styles.nodeRecipient} />
        <text x="857" y="185" className={styles.nodeLabel}>
          <tspan x="857" dy="0">Decrypt</tspan>
          <tspan x="857" dy="16">&amp; Read</tspan>
        </text>

        {/* Branch labels */}
        <text x="612" y="75" className={styles.branchLabel}>stays in browser</text>
        <text x="612" y="315" className={styles.branchLabel}>deleted after fetch</text>

        {/* Decrypt & Read -> Gone */}
        <line
          x1="885" y1="190" x2="910" y2="190"
          className={styles.connector}
        />
        <line
          x1="885" y1="190" x2="910" y2="190"
          className={styles.flowLine}
        />

        {/* Gone */}
        <rect x="910" y="160" width="55" height="60" rx="12" className={styles.nodeGone} />
        <text x="937" y="195" className={styles.nodeLabel}>Gone</text>

        {/* Small arrow heads */}
        <polygon points="227,186 227,194 235,190" className={styles.arrowHead} />
        <polygon points="427,186 427,194 435,190" className={styles.arrowHead} />
        <polygon points="827,186 827,194 835,190" className={styles.arrowHead} />
        <polygon points="907,186 907,194 915,190" className={styles.arrowHead} />
      </svg>
    </div>
  );
}

export function LandingV4Content() {
  return (
    <>
      {/* Architecture Diagram Section */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <FadeSection>
            <h2 className={styles.sectionLabel}>how it works — the full picture</h2>
          </FadeSection>

          <FadeSection delay={100}>
            <ArchitectureDiagram />
          </FadeSection>

          <div className={styles.explanationGrid}>
            {EXPLANATIONS.map((item, i) => (
              <FadeSection key={item.title} className={styles.explanationCard} delay={200 + i * 100}>
                <h3 className={styles.explanationTitle}>{item.title}</h3>
                <p className={styles.explanationBody}>{item.body}</p>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* Comparison Table Section */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <FadeSection>
            <h2 className={styles.sectionLabel}>notefade vs. typical secret sharing</h2>
          </FadeSection>

          <FadeSection delay={100}>
            <div className={styles.tableWrapper}>
              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th className={styles.thLabel}></th>
                    <th className={styles.thNotefade}>notefade</th>
                    <th className={styles.thTypical}>typical service</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
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
              We can&apos;t prevent screenshots or clipboard copying — no one can. What we guarantee
              is that nothing meaningful ever exists on our servers.
            </p>
          </FadeSection>
        </div>
      </section>
    </>
  );
}

export function LandingV4() {
  return (
    <LandingShell>
      <LandingV4Content />
    </LandingShell>
  );
}

import { LandingShell, FadeSection } from './LandingShell';
import styles from './LandingV4.module.css';

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
    typical: 'some',
  },
  {
    label: 'Both parties online at same time',
    notefade: 'no',
    typical: 'some',
  },
];

export function LandingV4Content() {
  return (
    <>
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

import { LandingShell, FadeSection } from './LandingShell';
import styles from './LandingV1.module.css';

const LOG_ENTRIES = [
  { line: 1, time: '[00:00.000]', label: 'WRITE',   kind: 'write',   desc: 'user composes a secret note' },
  { line: 2, time: '[00:00.012]', label: 'ENCRYPT', kind: 'encrypt', desc: 'AES-256-GCM encrypts in browser' },
  { line: 3, time: '[00:00.013]', label: 'SPLIT',   kind: 'split',   desc: '32-byte key splits via XOR' },
  { line: 4, time: '[00:00.089]', label: 'STORE',   kind: 'store',   desc: '16 bytes \u2192 server KV (with TTL)' },
  { line: 5, time: '[00:01.204]', label: 'READ',    kind: 'read',    desc: 'recipient opens link, shard fetched' },
  { line: 6, time: '[00:01.205]', label: 'GONE',    kind: 'gone',    desc: 'shard deleted. key reconstructed. note decrypted. nothing remains.' },
] as const;

const LABEL_STYLES: Record<string, string | undefined> = {
  write:   styles.labelWrite,
  encrypt: styles.labelEncrypt,
  split:   styles.labelSplit,
  store:   styles.labelStore,
  read:    styles.labelRead,
  gone:    styles.labelGone,
};

const ASCII_DIAGRAM = [
  '\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510',
  '\u2502          32-byte encryption key       \u2502',
  '\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
  '           \u2502           \u2502',
  '      XOR split    XOR split',
  '           \u2502           \u2502',
  '   \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25bc\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2500\u2500\u25bc\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510',
  '   \u2502 16 bytes \u2502  \u2502   32 bytes   \u2502',
  '   \u2502  server  \u2502  \u2502  URL share   \u2502',
  '   \u2502  shard   \u2502  \u2502  (+ IV + ct) \u2502',
  '   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
].join('\n');

const QUERY_LINES = [
  { key: 'stored:',  value: '16 bytes',      kind: 'green' },
  { key: 'content:', value: 'none',           kind: 'dim' },
  { key: 'knows:',   value: 'nothing',        kind: 'dim' },
  { key: 'deleted:', value: 'on first read',  kind: 'amber' },
] as const;

const QUERY_VAL_STYLES: Record<string, string | undefined> = {
  green: styles.queryValGreen,
  dim:   styles.queryValDim,
  amber: styles.queryValAmber,
};

function cls(...names: ReadonlyArray<string | undefined>): string {
  return names.filter(Boolean).join(' ');
}

export function LandingV1Content() {
  return (
    <section className={styles.section}>
      <FadeSection>
        <div className={styles.terminal}>
            {/* Window chrome */}
            <div className={styles.chrome}>
              <span className={cls(styles.chromeDot, styles.chromeDotRed)} />
              <span className={cls(styles.chromeDot, styles.chromeDotYellow)} />
              <span className={cls(styles.chromeDot, styles.chromeDotGreen)} />
              <span className={styles.chromeTitle}>notefade &mdash; lifecycle</span>
            </div>

            <div className={styles.body}>
              {/* Log entries */}
              <FadeSection delay={100}>
                <div className={styles.logSection}>
                  {LOG_ENTRIES.map((entry) => (
                    <div key={entry.line} className={styles.logEntry}>
                      <span className={styles.lineNum}>{entry.line}</span>
                      <span className={styles.timestamp}>{entry.time}</span>
                      <span className={cls(styles.label, LABEL_STYLES[entry.kind])}>
                        {entry.label}
                      </span>
                      <span className={cls(
                        styles.desc,
                        entry.kind === 'gone' ? styles.descGone : undefined,
                      )}>
                        {entry.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </FadeSection>

              <div className={styles.termSep} />

              {/* ASCII diagram */}
              <FadeSection delay={250}>
                <div className={styles.diagramSection}>
                  <div className={styles.diagramHeader}>key split</div>
                  <pre className={styles.ascii}>{ASCII_DIAGRAM}</pre>
                </div>
              </FadeSection>

              <div className={styles.termSep} />

              {/* Query section */}
              <FadeSection delay={400}>
                <div className={styles.querySection}>
                  <div className={styles.promptLine}>
                    <span className={styles.promptSymbol}>$</span>
                    <span className={styles.promptCmd}>query server_storage</span>
                  </div>
                  <div className={styles.queryResult}>
                    {QUERY_LINES.map((q) => (
                      <div key={q.key}>
                        <span className={styles.queryKey}>{q.key}</span>
                        <span className={QUERY_VAL_STYLES[q.kind]}>{q.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeSection>

              {/* Blinking cursor */}
              <div className={styles.cursorLine}>
                <span className={styles.promptSymbol}>$</span>
                <span className={styles.cursor} />
              </div>
            </div>
          </div>
        </FadeSection>
      </section>
  );
}

export function LandingV1() {
  return (
    <LandingShell>
      <LandingV1Content />
    </LandingShell>
  );
}

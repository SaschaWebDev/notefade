import { useState, useEffect, useRef, type ReactNode } from 'react';
import { CreateNote } from './CreateNote';
import styles from './Landing.module.css';

const PILLS = [
  { label: 'AES-256 encrypted', href: '/docs#encryption' },
  { label: 'zero knowledge', href: '/docs#zero-knowledge' },
  { label: 'one-time read', href: '/docs#one-time-read' },
  { label: 'auto-expiring', href: '/docs#auto-expiring' },
] as const;

const STEPS = [
  {
    labelTop: 'write',
    labelBottom: 'note',
    desc: 'your secret stays in the browser. nothing leaves until you hit encrypt.',
  },
  {
    labelTop: 'encrypt',
    labelBottom: 'trustless',
    desc: 'AES-256-GCM encrypts locally. the key splits — half in the link, half on our server. neither works alone.',
  },
  {
    labelTop: 'destruct',
    labelBottom: 'on read',
    desc: 'one click opens and decrypts. the server shard deletes itself. the link goes dark.',
  },
] as const;

const NEVER_STORED = [
  'your message',
  'encryption keys',
  'IP addresses',
  'metadata',
  'who sent it',
  'who read it',
] as const;

function FadeSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${styles.fadeSection} ${visible ? styles.fadeSectionVisible : ''} ${className ?? ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function Landing() {
  return (
    <div className={styles.page}>
      <div className={styles.dotGrid} />

      <section className={styles.hero}>
        <header className={styles.header}>
          <h1 className={styles.logo}>notefade</h1>
          <p className={styles.tagline}>private notes that vanish</p>
        </header>

        <div className={styles.palette}>
          <CreateNote />
        </div>

        <div className={styles.pills}>
          {PILLS.map(({ label, href }) => (
            <a key={href} href={href} className={styles.pill}>
              {label}
            </a>
          ))}
        </div>

        <p className={styles.hint}>encrypted entirely in your browser</p>

        <div className={styles.scrollCue}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <FadeSection>
            <h2 className={styles.sectionLabel}>how it works</h2>
          </FadeSection>

          <div className={styles.steps}>
            {STEPS.map((step, i) => (
              <FadeSection key={step.labelTop} className={styles.step} delay={i * 100}>
                <div className={styles.stepBadge}>
                  {step.labelTop}<br />{step.labelBottom}
                </div>
                <p className={styles.stepDesc}>{step.desc}</p>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.serverSection}>
        <div className={styles.serverInner}>
          <FadeSection>
            <div className={styles.byteDisplay}>16</div>
            <div className={styles.byteUnit}>bytes</div>
            <p className={styles.serverDesc}>
              that's all the server ever holds — a random key shard that
              means nothing alone. deleted on first read, or when the
              timer runs out.
            </p>
          </FadeSection>

          <FadeSection delay={120}>
            <div className={styles.neverList}>
              {NEVER_STORED.map((item) => (
                <span key={item} className={styles.neverItem}>
                  {item}
                </span>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      <footer className={styles.footer}>
        <a href="/docs" className={styles.footerLink}>
          how it works — full technical details
        </a>
      </footer>
    </div>
  );
}

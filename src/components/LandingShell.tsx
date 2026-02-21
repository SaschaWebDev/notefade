import { useState, useEffect, useRef, type ReactNode } from 'react';
import { CreateNote } from './CreateNote';
import styles from './LandingShell.module.css';

const PILLS = [
  { label: 'AES-256 encrypted', href: '/docs#encryption' },
  { label: 'zero knowledge', href: '/docs#zero-knowledge' },
  { label: 'one-time read', href: '/docs#one-time-read' },
  { label: 'auto-expiring', href: '/docs#auto-expiring' },
] as const;

export function FadeSection({
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

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.dotGrid} />

      <section className={styles.hero}>
        <header className={styles.header}>
          <h1 className={styles.logo}>notefade</h1>
          <p className={styles.tagline}>private notes that <span className={styles.fade}>fade</span></p>
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

      {children}

      <footer className={styles.footer}>
        <a href="/docs" className={styles.footerLink}>
          how it works — full technical details
        </a>
      </footer>
    </div>
  );
}

export { styles as shellStyles };

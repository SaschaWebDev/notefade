import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { CreateNote } from '../create-note';
import { useTheme } from '@/hooks';
import { OFFICIAL_HOSTS } from '@/constants';
import { IconSun, IconMoon, IconChevronDown, IconClose, IconDocs } from '@/components/ui/icons';
import styles from './LandingShell.module.css';

const PILL_ROWS = [
  [
    { label: 'AES-256 encrypted', href: '/docs#encryption' },
    { label: 'zero knowledge', href: '/docs#zero-knowledge' },
    { label: 'one-time read', href: '/docs#one-time-read' },
  ],
  [
    { label: 'no tracking', href: '/docs#no-tracking' },
    { label: 'open source', href: '/docs#open-source' },
    { label: 'auto-expiring', href: '/docs#auto-expiring' },
  ],
  [
    { label: 'nothing stored', href: '/docs#zero-knowledge' },
    { label: 'no accounts', href: '/docs#no-accounts' },
  ],
] as const;

const CTA_CARDS: readonly {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    href: '/activate',
    title: 'activate a deferred note',
    description: 'upload a launch code to make a pre-created note live',
    icon: (
      <svg
        width='20'
        height='20'
        viewBox='0 0 20 20'
        fill='none'
        className={styles.ctaIcon}
      >
        <path
          d='M10 2v6m0 0l3-3m-3 3L7 5'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='M3 10a7 7 0 1014 0'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
        />
      </svg>
    ),
  },
  {
    href: '/decode',
    title: 'decode steganography',
    description: 'extract a hidden link from an image or text',
    icon: (
      <svg
        width='20'
        height='20'
        viewBox='0 0 20 20'
        fill='none'
        className={styles.ctaIcon}
      >
        <rect
          x='2'
          y='2'
          width='16'
          height='16'
          rx='3'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <circle
          cx='7'
          cy='7'
          r='1.5'
          stroke='currentColor'
          strokeWidth='1.2'
        />
        <path
          d='M2 14l4.5-4.5 3 3L13 9l5 5'
          stroke='currentColor'
          strokeWidth='1.2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    ),
  },
  {
    href: '/verify',
    title: 'verify proof of read',
    description:
      'confirm that a reader actually opened your note with a receipt',
    icon: (
      <svg
        width='20'
        height='20'
        viewBox='0 0 20 20'
        fill='none'
        className={styles.ctaIcon}
      >
        <path
          d='M10 1.5L3 5v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V5l-7-3.5z'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='M7 10.5l2 2 4-4.5'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    ),
  },
  {
    href: '/encrypt',
    title: 'encrypt content',
    description: 'encrypt text locally for use with bring-your-own-key notes',
    icon: (
      <svg
        width='20'
        height='20'
        viewBox='0 0 20 20'
        fill='none'
        className={styles.ctaIcon}
      >
        <rect
          x='4'
          y='9'
          width='12'
          height='8'
          rx='2'
          stroke='currentColor'
          strokeWidth='1.5'
        />
        <path
          d='M7 9V6a3 3 0 016 0v3'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
        />
        <circle cx='10' cy='13' r='1.5' fill='currentColor' />
      </svg>
    ),
  },
];

function CtaCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <a href={href} className={styles.ctaCard}>
      {icon}
      <span className={styles.ctaTitle}>{title}</span>
      <span className={styles.ctaDesc}>{description}</span>
    </a>
  );
}

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

const FAQ_ITEMS = [
  {
    question: 'Can you read my notes?',
    answer:
      'No. Your note is encrypted in your browser before anything leaves your device. We store a 16-byte key fragment that is completely meaningless on its own — it exists as a mechanism so your note can only be unlocked once, and even that is then deleted forever.',
  },
  {
    question: 'What happens after someone reads my note?',
    answer:
      'The key fragment on our server is deleted immediately. The link stops working. There is no copy, backup, or undo. The part to assemble your note is gone.',
  },
  {
    question: 'What if nobody reads it?',
    answer:
      'It expires automatically. You choose the time window\u200a—\u200a1 hour, 24 hours, or 7 days. After that, the (meaningless) server key fragment is gone and access impossible.',
  },
  {
    question: 'Can you prevent screenshots or copy-paste?',
    answer:
      'No, and we won\u2019t pretend otherwise. Once decrypted in the browser, the reader can capture the content (also by just memorizing it in the brain). This is a limitation of all screen-based communication. This tool will ensure that only one chosen reader will see the information exactly once.',
  },
  {
    question: 'What encryption do you use?',
    answer:
      'AES-256-GCM via the Web Crypto API built into your browser. No external crypto libraries. AES-256 has so many possible keys that brute-forcing it would take longer than the remaining life of the universe — even with every computer on Earth working together. This encrypts your content and then embeds it directly into the shareable link. The key is generated fresh for each note, then split using XOR — a mathematically proven unbreakable split where with only one piece, every other possible key is equally likely. It\u2019s not just hard to crack, it\u2019s impossible regardless of computing power. The larger piece lives in your link (FNV-1a integrity check), and the smallest possible ephemeral shard is stored on our server that self-destructs after one read. Both pieces must reunite to decrypt. Every link is also padded to a uniform length with random fill, so even the URL size reveals nothing about the message.',
  },
  {
    question: 'Do I need an account?',
    answer:
      'No. No sign-up, no email, no cookies. You write a note, get a link, share it. We store 16 characters, to make your note mathematically unbreakable read once and would store nothing if math would allow for that.',
  },
  {
    question: 'How can I trust your code?',
    answer:
      'Never trust, verify. The code is fully transparent and open source on GitHub. The security and encryption mechanisms (spoiler: mathematically proven unbreakable) can be reviewed in our technical docs. A status indicator shows whether you\u2019re on the official domain to prevent fakes. Don\u2019t trust the server? There barely is one \u2014 just a direct connection to a key-value database storing meaningless 16 bytes per note. Still not enough? Bring your own. Connect your own key storage via the configuration. Don\u2019t trust the frontend? It\u2019s all local in your browser \u2014 but you can grab a release package from GitHub and host it yourself anyway. Want to go further? Every production build includes subresource integrity checks and a build manifest with SHA-256 hashes. Clone the repo, build it yourself, and verify the output matches what we serve \u2014 reproducible builds, zero trust required.',
  },
  {
    question: 'Can only messages be sent?',
    answer:
      'Yes. To maintain this level of security and guarantee your privacy, only text up to 1,800 characters can be sent \u2014 everything is embedded directly in the link itself, so nothing extra ever touches a server.',
  },
  {
    question: 'How do I send the note?',
    answer:
      'After creating your note, you get a unique link. Copy it and send it however you like \u2014 email, messaging app, carrier pigeon. You can also scan or export a QR code directly from the link page. The link is the note. Whoever opens it first reads the content, and then it\u2019s gone.',
  },
  {
    question: 'What if I regret sending a note?',
    answer:
      'You can destroy it before anyone reads it. Use the \u201CDestroy now\u201D button on the note link page to immediately delete the server shard. Once destroyed, the link is dead \u2014 no one can open it, including you.',
  },
  {
    question: 'Can someone recover a read note from browser history?',
    answer:
      'No. The encrypted payload lives in the URL fragment, which is cleared after decryption. Even if someone finds the link in their history, the server shard is already gone \u2014 the note cannot be reassembled.',
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const measure = () => setHeight(el.scrollHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [answer]);

  return (
    <div className={styles.faqItem}>
      <button
        className={styles.faqQuestion}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <IconChevronDown
          className={`${styles.faqChevron} ${open ? styles.faqChevronOpen : ''}`}
        />
      </button>
      <div
        ref={innerRef}
        className={styles.faqAnswer}
        style={{ maxHeight: open ? `${height}px` : '0px' }}
      >
        <div className={styles.faqAnswerInner}>
          {answer}
        </div>
      </div>
    </div>
  );
}

function useBuildVerified(): boolean {
  const scripts = document.querySelectorAll('script[integrity]');
  const links = document.querySelectorAll('link[rel="stylesheet"][integrity]');
  return scripts.length > 0 || links.length > 0;
}

function DomainIndicator() {
  const isOfficial = (OFFICIAL_HOSTS as readonly string[]).includes(window.location.hostname);
  const buildVerified = useBuildVerified();

  return (
    <div
      className={`${styles.domainIndicator} ${isOfficial ? styles.domainOfficial : styles.domainWarning}`}
    >
      {isOfficial ? (
        <>
          <span className={`${styles.domainDot} ${styles.domainDotOfficial}`} />
          <span className={styles.domainText}>
            You are on the official notefade.com website
          </span>
          {buildVerified && (
            <>
              <span className={styles.domainSep}>&middot;</span>
              <a href='/docs#verifying-builds' className={styles.buildBadge}>
                &#10003; Build Verified
              </a>
            </>
          )}
        </>
      ) : (
        <div className={styles.domainText}>
          <span className={styles.domainHeadline}>
            <span
              className={`${styles.domainDot} ${styles.domainDotWarning}`}
            />
            warning
          </span>{' '}
          &mdash; This is not the official notefade.com
        </div>
      )}
    </div>
  );
}

function touchDist(a: Touch, b: Touch) {
  const dx = b.clientX - a.clientX;
  const dy = b.clientY - a.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function LandingShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [noteCreated, setNoteCreated] = useState(false);
  const handleNoteCreated = useCallback(
    (hasUrl: boolean) => setNoteCreated(hasUrl),
    [],
  );
  const [overlayOpen, setOverlayOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const touchRef = useRef({ dist: 0, baseScale: 1, startX: 0, startY: 0 });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  });

  useEffect(() => {
    if (!overlayOpen) return;
    const el = contentRef.current;
    if (!el) return;

    function onStart(e: TouchEvent) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      if (t0 && t1) {
        touchRef.current.dist = touchDist(t0, t1);
        touchRef.current.baseScale = scaleRef.current;
      } else if (t0 && e.touches.length === 1 && scaleRef.current > 1) {
        touchRef.current.startX = t0.clientX - posRef.current.x;
        touchRef.current.startY = t0.clientY - posRef.current.y;
      }
    }

    function onMove(e: TouchEvent) {
      const img = imgRef.current;
      if (!img) return;
      const t0 = e.touches[0];
      const t1 = e.touches[1];

      if (t0 && t1) {
        e.preventDefault();
        const d = touchDist(t0, t1);
        const s = Math.min(
          Math.max(touchRef.current.baseScale * (d / touchRef.current.dist), 1),
          5,
        );
        scaleRef.current = s;
        img.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) scale(${s})`;
      } else if (t0 && e.touches.length === 1 && scaleRef.current > 1) {
        e.preventDefault();
        const x = t0.clientX - touchRef.current.startX;
        const y = t0.clientY - touchRef.current.startY;
        posRef.current = { x, y };
        img.style.transform = `translate(${x}px, ${y}px) scale(${scaleRef.current})`;
      }
    }

    function onEnd() {
      if (scaleRef.current <= 1.05) {
        scaleRef.current = 1;
        posRef.current = { x: 0, y: 0 };
        if (imgRef.current) imgRef.current.style.transform = '';
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [overlayOpen]);

  function closeOverlay() {
    scaleRef.current = 1;
    posRef.current = { x: 0, y: 0 };
    if (imgRef.current) imgRef.current.style.transform = '';
    setOverlayOpen(false);
  }

  return (
    <main className={styles.page}>
      <DomainIndicator />
      <a
        href='/docs'
        target='_blank'
        rel='noopener noreferrer'
        className={styles.docsLink}
        title='documentation'
        aria-label='documentation'
      >
        <IconDocs />
      </a>
      <button
        type='button'
        className={styles.themeToggle}
        onClick={toggleTheme}
        title={
          theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'
        }
        aria-label={
          theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'
        }
      >
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>
      <div className={styles.dotGrid} />

      <section className={styles.hero}>
        <header className={styles.header}>
          <a href='/' className={styles.logo}>
            notefade
          </a>
          <h1 className={styles.tagline}>
            private notes that <span className={styles.fade}>fade</span>
          </h1>
        </header>

        <div className={styles.palette}>
          <CreateNote onNoteCreated={handleNoteCreated} />
        </div>

        {!noteCreated && (
          <>
            <div className={styles.pills}>
              {PILL_ROWS.map((row, i) => (
                <div key={i} className={styles.pillRow}>
                  {row.map(({ label, href }) => (
                    <a key={label} href={href} className={styles.pill}>
                      {label}
                    </a>
                  ))}
                </div>
              ))}
            </div>

            <p className={styles.hint}>encrypted entirely in your browser</p>
          </>
        )}

        {!noteCreated && (
          <div className={styles.scrollCue}>
            <IconChevronDown stroke='rgba(255,255,255,0.2)' />
          </div>
        )}
      </section>

      {!noteCreated && (
        <>
          <section className={styles.ctaSection}>
            <FadeSection>
              <h2 className={styles.sectionLabel}>tools</h2>
            </FadeSection>
            <div className={styles.ctaCards}>
              {CTA_CARDS.map((card, i) => (
                <FadeSection key={card.href} delay={(i + 1) * 80}>
                  <CtaCard {...card} />
                </FadeSection>
              ))}
            </div>
          </section>

          <div className={styles.divider} />

          {children}

          <div className={styles.divider} />

          <section className={styles.architectureSection}>
            <FadeSection>
              <h2 className={styles.sectionLabel}>architecture</h2>
            </FadeSection>
            <FadeSection delay={100}>
              <div className={styles.diagramTerminal}>
                <div className={styles.diagramChrome}>
                  <span className={styles.chromeDotRed} />
                  <span className={styles.chromeDotYellow} />
                  <span className={styles.chromeDotGreen} />
                </div>
                <img
                  src='/notefade-architecture.svg'
                  alt='Notefade security architecture diagram'
                  className={styles.architectureDiagram}
                  onClick={() => setOverlayOpen(true)}
                />
              </div>
              <p className={styles.diagramHint}>tap to expand</p>
            </FadeSection>
          </section>

          <div className={styles.divider} />

          <section className={styles.faqSection}>
            <FadeSection>
              <h2 className={styles.sectionLabel}>frequently asked</h2>
            </FadeSection>
            <div className={styles.faqList}>
              {FAQ_ITEMS.map((item, i) => (
                <FadeSection key={item.question} delay={i * 50}>
                  <FaqItem question={item.question} answer={item.answer} />
                </FadeSection>
              ))}
            </div>
          </section>

          <footer className={styles.footer}>
            <a href='/docs' className={styles.footerLink}>
              documentation
            </a>
            <p className={styles.footerCredit}>
              Made with ❤️ by Sascha Majewsky ·{' '}
              <a
                href='https://github.com/saschawebdev/notefade'
                className={styles.footerLink}
                target='_blank'
                rel='noopener noreferrer'
              >
                GitHub
              </a>
            </p>
          </footer>
        </>
      )}

      {overlayOpen && (
        <div className={styles.overlay} onClick={closeOverlay}>
          <button
            className={styles.overlayClose}
            onClick={closeOverlay}
            aria-label='Close'
          >
            <IconClose />
          </button>
          <div
            ref={contentRef}
            className={styles.overlayContent}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              ref={imgRef}
              src='/notefade-architecture.svg'
              alt='Notefade security architecture diagram'
              className={styles.overlayImage}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export { styles as shellStyles };

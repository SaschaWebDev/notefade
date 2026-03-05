import { LandingShell, FadeSection } from '../landing-shell';
import styles from './LandingFeatures.module.css';

interface BentoCard {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly iconClass: string | undefined;
}

const CARDS: readonly BentoCard[] = [
  {
    key: 'split-key-flow',
    title: 'Split-key encryption',
    body: 'Your note is encrypted with AES-256-GCM entirely in your browser. The encryption key splits in two \u2014 half lives in the link, half on our server. Neither half works alone. When the recipient opens the link, both halves reunite, the note decrypts, and every trace fades.',
    iconClass: styles.iconEncrypt,
  },
  {
    key: 'read-once',
    title: 'Read once, then gone',
    body: 'The server shard deletes the moment it\u2019s read. The link goes dark. No archive, no retrieval, no second chance. Share the link or scan a QR code \u2014 one read, then it fades.',
    iconClass: styles.iconReadOnce,
  },
  {
    key: '16-bytes',
    title: '16 bytes. That\u2019s all.',
    body: 'The entire server footprint per note. A meaningless shard \u2014 smaller than this sentence. Deleted on first read or when the timer expires. Nothing left to steal.',
    iconClass: styles.iconBytes,
  },
  {
    key: 'server-blind',
    title: 'We can\u2019t read your notes',
    body: 'Not \u201Cwe choose not to.\u201D We literally cannot. Your content never reaches our server. The encrypted payload lives in the URL fragment \u2014 browsers never send that part. Every link is padded to a uniform length, so even URL size reveals nothing about the message.',
    iconClass: styles.iconBlind,
  },
  {
    key: 'open-source',
    title: 'Don\u2019t trust us. Verify.',
    body: 'Fully open source. Zero third-party scripts. Zero crypto dependencies \u2014 just the Web Crypto API built into your browser. Read every line. Run your own instance. Verify our production builds match the source with reproducible builds and subresource integrity.',
    iconClass: styles.iconSource,
  },
  {
    key: 'nothing-to-hack',
    title: 'Nothing to hack. Nothing to leak.',
    body: 'No accounts. No cookies. No tracking. No encrypted blobs on our servers. If someone breaches our infrastructure, they find meaningless 16-byte shards that expire on their own. There is nothing to steal, subpoena, or hand over.',
    iconClass: styles.iconLock,
  },
];

function CardIcon({ cardKey }: { cardKey: string }) {
  switch (cardKey) {
    case 'split-key-flow':
      return (
        <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
          <path
            d='M10 2L3 6v4c0 4.42 2.98 8.56 7 9.6 4.02-1.04 7-5.18 7-9.6V6l-7-4z'
            stroke='currentColor'
            strokeWidth='1.4'
            strokeLinejoin='round'
          />
          <path
            d='M7.5 10l2 2 3.5-4'
            stroke='currentColor'
            strokeWidth='1.4'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      );
    case 'read-once':
      return (
        <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
          <path
            d='M2.5 10s3-6 7.5-6 7.5 6 7.5 6-3 6-7.5 6-7.5-6-7.5-6z'
            stroke='currentColor'
            strokeWidth='1.4'
            strokeLinejoin='round'
          />
          <circle
            cx='10'
            cy='10'
            r='2.5'
            stroke='currentColor'
            strokeWidth='1.4'
          />
        </svg>
      );
    case '16-bytes':
      return (
        <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
          <rect
            x='3'
            y='3'
            width='14'
            height='14'
            rx='3'
            stroke='currentColor'
            strokeWidth='1.4'
          />
          <path
            d='M7 7h6M7 10h4M7 13h5'
            stroke='currentColor'
            strokeWidth='1.4'
            strokeLinecap='round'
          />
        </svg>
      );
    case 'server-blind':
      return (
        <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
          <circle
            cx='10'
            cy='10'
            r='7.5'
            stroke='currentColor'
            strokeWidth='1.4'
          />
          <path
            d='M4 14l12-8'
            stroke='currentColor'
            strokeWidth='1.4'
            strokeLinecap='round'
          />
        </svg>
      );
    case 'open-source':
      return (
        <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
          <path
            d='M7 7l-4 3 4 3M13 7l4 3-4 3'
            stroke='currentColor'
            strokeWidth='1.4'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
          <path
            d='M11 5l-2 10'
            stroke='currentColor'
            strokeWidth='1.4'
            strokeLinecap='round'
          />
        </svg>
      );
    case 'nothing-to-hack':
      return (
        <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
          <rect
            x='3'
            y='8'
            width='14'
            height='9'
            rx='2'
            stroke='currentColor'
            strokeWidth='1.4'
          />
          <path
            d='M6 8V6a4 4 0 118 0v2'
            stroke='currentColor'
            strokeWidth='1.4'
            strokeLinecap='round'
          />
          <circle cx='10' cy='13' r='1.5' fill='currentColor' />
        </svg>
      );
    default:
      return null;
  }
}

export function LandingFeaturesContent() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <FadeSection>
          <h2 className={styles.sectionLabel}>why notefade</h2>
        </FadeSection>

        <div className={styles.grid}>
          {CARDS.map((card, i) => (
            <FadeSection key={card.key} delay={i * 80}>
              <div className={styles.card}>
                <div className={`${styles.cardIcon} ${card.iconClass ?? ''}`}>
                  <CardIcon cardKey={card.key} />
                </div>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardBody}>{card.body}</p>
              </div>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFeatures() {
  return (
    <LandingShell>
      <LandingFeaturesContent />
    </LandingShell>
  );
}

import { LandingShell, FadeSection } from './LandingShell';
import styles from './LandingV2.module.css';

interface BentoCard {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly wide?: boolean;
  readonly highlight?: boolean;
}

const FLOW_STEPS = [
  'write',
  'encrypt',
  'split key',
  'share link',
  'read once',
  'fade',
] as const;

const CARDS: readonly BentoCard[] = [
  {
    key: 'encryption-flow',
    title: 'End-to-end encryption flow',
    body: 'Your note is encrypted with AES-256-GCM entirely in your browser. The encryption key splits in two — half lives in the link, half on our server. Neither half works alone. When the recipient opens the link, both halves reunite, the note decrypts, and every trace fades.',
    wide: true,
  },
  {
    key: 'zero-knowledge',
    title: 'Zero knowledge',
    body: 'We never see your content. The server handles a meaningless key shard — it cannot decrypt anything on its own. Your note exists only in your browser and your recipient\'s browser.',
  },
  {
    key: 'read-once',
    title: 'Read once, then gone',
    body: 'The server shard deletes itself the moment it is read. The link goes dark. There is no second chance, no archive, no retrieval. One read, then it fades.',
  },
  {
    key: '16-bytes',
    title: 'Minimal server footprint',
    body: 'All the server ever holds — a random shard that means nothing without the rest of the key. Deleted on first read or when the timer expires.',
    highlight: true,
  },
  {
    key: 'no-accounts',
    title: 'No accounts, no identity',
    body: 'No sign-up. No email. No cookies. Nothing ties a note to you. You share a link — that is the entire interaction.',
  },
  {
    key: 'auto-expiring',
    title: 'Auto-expiring',
    body: 'Every note has a time-to-live. If nobody reads it, the server shard quietly expires and the note becomes permanently unrecoverable. No cron jobs — built into the infrastructure.',
  },
  {
    key: 'url-fragment',
    title: 'URL fragment privacy',
    body: 'Your encrypted payload lives after the # in the URL. Browsers never send fragments to servers. Our server literally cannot see what is in the link you share.',
  },
] as const;

function CardIcon({ cardKey }: { cardKey: string }) {
  switch (cardKey) {
    case 'encryption-flow':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2L3 6v4c0 4.42 2.98 8.56 7 9.6 4.02-1.04 7-5.18 7-9.6V6l-7-4z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 10l2 2 3.5-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'zero-knowledge':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M4 14l12-8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'read-once':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M2.5 10s3-6 7.5-6 7.5 6 7.5 6-3 6-7.5 6-7.5-6-7.5-6z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case '16-bytes':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect
            x="3"
            y="3"
            width="14"
            height="14"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M7 7h6M7 10h4M7 13h5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'no-accounts':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M4 16.5c0-2.5 2.5-4.5 6-4.5s6 2 6 4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M4 4l12 12"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'auto-expiring':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M10 6v4.5l3 2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'url-fragment':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M8 4l-2 12M14 4l-2 12M4 8h13M3 12h13"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function WideCardContent() {
  return (
    <div className={styles.cardWideLayout}>
      <div className={styles.cardIcon}>
        <CardIcon cardKey="encryption-flow" />
      </div>
      <div className={styles.cardWideContent}>
        <h3 className={styles.cardTitle}>End-to-end encryption flow</h3>
        <p className={styles.cardBody}>
          Your note is encrypted with AES-256-GCM entirely in your browser. The
          encryption key splits in two — half lives in the link, half on our
          server. Neither half works alone. When the recipient opens the link,
          both halves reunite, the note decrypts, and every trace fades.
        </p>
        <div className={styles.flowSteps}>
          {FLOW_STEPS.map((step, i) => (
            <span key={step}>
              <span className={styles.flowStep}>{step}</span>
              {i < FLOW_STEPS.length - 1 && (
                <span className={styles.flowArrow}>&nbsp;&rarr;&nbsp;</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function HighlightCardContent({ card }: { card: BentoCard }) {
  return (
    <>
      <div className={styles.cardIcon}>
        <CardIcon cardKey={card.key} />
      </div>
      <div className={styles.byteNumber}>16</div>
      <div className={styles.byteUnit}>bytes</div>
      <h3 className={styles.cardTitle}>{card.title}</h3>
      <p className={styles.cardBody}>{card.body}</p>
    </>
  );
}

function StandardCardContent({ card }: { card: BentoCard }) {
  return (
    <>
      <div className={styles.cardIcon}>
        <CardIcon cardKey={card.key} />
      </div>
      <h3 className={styles.cardTitle}>{card.title}</h3>
      <p className={styles.cardBody}>{card.body}</p>
    </>
  );
}

export function LandingV2Content() {
  return (
    <section className={styles.section}>
        <div className={styles.sectionInner}>
          <FadeSection>
            <h2 className={styles.sectionLabel}>why notefade</h2>
          </FadeSection>

          <div className={styles.grid}>
            {CARDS.map((card, i) => {
              const cardClasses = [
                styles.card,
                card.wide ? styles.cardWide : '',
                card.highlight ? styles.cardHighlight : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <FadeSection key={card.key} delay={i * 80}>
                  <div className={cardClasses}>
                    {card.wide ? (
                      <WideCardContent />
                    ) : card.highlight ? (
                      <HighlightCardContent card={card} />
                    ) : (
                      <StandardCardContent card={card} />
                    )}
                  </div>
                </FadeSection>
              );
            })}
          </div>
        </div>
      </section>
  );
}

export function LandingV2() {
  return (
    <LandingShell>
      <LandingV2Content />
    </LandingShell>
  );
}

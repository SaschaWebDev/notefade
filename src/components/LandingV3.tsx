import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LandingShell } from './LandingShell';
import styles from './LandingV3.module.css';

/* ---- Scene: bidirectional IntersectionObserver ---- */

function Scene({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const classes = [styles.scene, visible ? styles.visible : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={classes}>
      {children}
    </div>
  );
}

/* ---- Hex data for Scene 2 ---- */

const HEX_CHARS = [
  'a7',
  '3f',
  'b2',
  '91',
  'e4',
  '0c',
  '58',
  'dd',
  'f6',
  '1a',
  '7e',
  'c3',
  '45',
  '89',
  '2b',
  'a0',
  'd1',
  '6f',
  '8c',
  '37',
] as const;

function HexDisplay() {
  return (
    <div className={styles.hexBlock}>
      {HEX_CHARS.map((hex, i) => (
        <span key={i} className={styles.hexChar}>
          {hex}
          {i < HEX_CHARS.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
}

/* ---- Component ---- */

export function LandingV3Content() {
  return (
    <>
      {/* Scene 1 — you write */}
      <Scene>
        <h2 className={styles.sceneHeading}>you write</h2>
        <div className={styles.typewriterWrap}>
          <div className={styles.typewriterBlock}>
            meet me at the usual place. the code is 4821.
          </div>
        </div>
      </Scene>

      {/* Scene 2 — we encrypt */}
      <Scene>
        <h2 className={styles.sceneHeading}>we encrypt</h2>
        <div className={styles.encryptContent}>
          <HexDisplay />
          <div className={styles.splitVisual}>
            <div className={`${styles.splitBlock} ${styles.splitBlockUrl}`}>
              <p className={`${styles.splitLabel} ${styles.splitLabelUrl}`}>
                URL fragment
              </p>
              <p className={`${styles.splitSize} ${styles.splitSizeUrl}`}>
                32 bytes
              </p>
            </div>
            <div className={`${styles.splitBlock} ${styles.splitBlockShard}`}>
              <p className={`${styles.splitLabel} ${styles.splitLabelShard}`}>
                server shard
              </p>
              <p className={`${styles.splitSize} ${styles.splitSizeShard}`}>
                16 bytes
              </p>
            </div>
          </div>
        </div>
      </Scene>

      {/* Scene 3 — they read */}
      <Scene>
        <h2 className={styles.sceneHeading}>they read</h2>
        <div className={styles.readContent}>
          <div className={styles.reassembleBlock}>
            meet me at the usual place. the code is 4821.
          </div>
        </div>
      </Scene>

      {/* Scene 4 — nothing remains */}
      <Scene>
        <h2 className={styles.sceneHeading}>nothing remains</h2>
        <div className={styles.remainsContent}>
          <div className={styles.counterWrap}>
            <span className={styles.counterFrom}>16</span>
            <span className={styles.counterArrow}>&rarr;</span>
            <span className={styles.counterTo}>0</span>
          </div>
          <p className={styles.counterUnit}>bytes on server</p>
          <p className={styles.remainsText}>nothing remains</p>
          <p className={styles.remainsSub}>
            the shard is deleted. the key is gone. only your memory stays.
          </p>
        </div>
      </Scene>
    </>
  );
}

export function LandingV3() {
  return (
    <LandingShell>
      <LandingV3Content />
    </LandingShell>
  );
}

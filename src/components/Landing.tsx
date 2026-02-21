import { LandingShell, FadeSection, shellStyles } from './LandingShell';
import { LandingV1Content } from './LandingV1';
import { LandingV2Content } from './LandingV2';
import { LandingV3Content } from './LandingV3';
import { LandingV4Content } from './LandingV4';
import { LandingV5Content } from './LandingV5';
import styles from './Landing.module.css';

const VARIANTS = [
  { label: 'v1 — terminal manuscript', Content: LandingV1Content },
  { label: 'v2 — bento dashboard', Content: LandingV2Content },
  { label: 'v3 — cinematic narrative', Content: LandingV3Content },
  { label: 'v4 — architecture diagram', Content: LandingV4Content },
  { label: 'v5 — split-screen duality', Content: LandingV5Content },
] as const;

export function Landing() {
  return (
    <LandingShell>
      {VARIANTS.map(({ label, Content }) => (
        <div key={label}>
          <div className={shellStyles.divider} />

          <FadeSection>
            <h2 className={styles.variantLabel}>{label}</h2>
          </FadeSection>

          <Content />

          <div className={styles.variantSpacer} />
        </div>
      ))}
    </LandingShell>
  );
}

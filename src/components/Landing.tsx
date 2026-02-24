import { LandingShell, FadeSection, shellStyles } from './LandingShell';
import { LandingV2Content } from './LandingV2';
import { LandingV4Content } from './LandingV4';
import styles from './Landing.module.css';

const VARIANTS = [
  { label: 'v2 — bento dashboard', Content: LandingV2Content },
  { label: 'v4 — architecture diagram', Content: LandingV4Content },
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

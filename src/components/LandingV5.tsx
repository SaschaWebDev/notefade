import { LandingShell, FadeSection } from './LandingShell';
import styles from './LandingV5.module.css';

interface StepSide {
  text: string;
  hint?: string;
  active: boolean;
}

interface Step {
  sender: StepSide;
  receiver: StepSide;
}

const STEPS: readonly Step[] = [
  {
    sender: {
      text: 'writes a secret',
      hint: 'composed in the browser',
      active: true,
    },
    receiver: { text: 'waiting...', active: false },
  },
  {
    sender: {
      text: 'encrypts locally',
      hint: 'AES-256-GCM, key splits in two',
      active: true,
    },
    receiver: { text: 'unaware', active: false },
  },
  {
    sender: {
      text: 'shares the link',
      hint: 'one half in the URL, one half on the server',
      active: true,
    },
    receiver: { text: 'link received', hint: 'the only way in', active: true },
  },
  {
    sender: { text: 'note was read', active: false },
    receiver: {
      text: 'reads, decrypts & deletes',
      hint: 'shard deleted, key reconstructed, then gone',
      active: true,
    },
  },
];

/** Step index where the "transfer" happens (link crosses from sender to receiver). */
const TRANSFER_STEP_INDEX = 2;

function formatStepNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

function StepContent({
  text,
  hint,
  stepIndex,
}: {
  text: string;
  hint?: string;
  stepIndex: number;
}) {
  return (
    <>
      <span className={styles.stepNumber}>{formatStepNumber(stepIndex)}</span>
      <p className={styles.stepText}>{text}</p>
      {hint !== undefined && <p className={styles.stepHint}>{hint}</p>}
    </>
  );
}

function getSenderStateClass(active: boolean): string {
  return (active ? styles.stepActive : styles.stepDimmed) ?? '';
}

function getReceiverStateClass(active: boolean): string {
  return (active ? styles.stepActiveReceiver : styles.stepDimmed) ?? '';
}

function DesktopTrack() {
  return (
    <div className={styles.dualTrack}>
      {/* Vertical spine line (absolute behind everything) */}
      <div className={styles.spineTrack}>
        <div className={styles.spineLine} />
      </div>

      {/* Role header row */}
      <div className={styles.roleHeaders}>
        <div className={styles.roleLabelSender}>sender</div>
        <div className={styles.roleLabelDividerGap} />
        <div className={styles.roleLabelReceiver}>receiver</div>
      </div>

      {/* Step rows — each is its own 3-column grid inside a FadeSection */}
      {STEPS.map((step, i) => (
        <FadeSection key={i} className={styles.stepRow} delay={i * 120}>
          <div
            className={`${styles.stepCellSender} ${getSenderStateClass(step.sender.active)}`}
          >
            <StepContent
              text={step.sender.text}
              hint={step.sender.hint}
              stepIndex={i}
            />
          </div>

          <div className={styles.stepSpineDot}>
            <div
              className={
                i === TRANSFER_STEP_INDEX
                  ? styles.spineDotTransfer
                  : styles.spineDot
              }
            />
          </div>

          <div
            className={`${styles.stepCellReceiver} ${getReceiverStateClass(step.receiver.active)}`}
          >
            <StepContent
              text={step.receiver.text}
              hint={step.receiver.hint}
              stepIndex={i}
            />
          </div>
        </FadeSection>
      ))}
    </div>
  );
}

function MobileTrack() {
  return (
    <div className={styles.dualTrack}>
      {STEPS.map((step, i) => {
        const isFirst = i === 0;

        return (
          <FadeSection key={i} className={styles.stepRow} delay={i * 100}>
            <div
              className={`${styles.mobileRoleLabelSender} ${isFirst ? styles.mobileRoleLabelFirst : ''}`}
            >
              sender
            </div>
            <div
              className={`${styles.stepCellSender} ${getSenderStateClass(step.sender.active)}`}
            >
              <StepContent
                text={step.sender.text}
                hint={step.sender.hint}
                stepIndex={i}
              />
            </div>

            <div className={styles.mobileRoleLabelReceiver}>receiver</div>
            <div
              className={`${styles.stepCellReceiver} ${getReceiverStateClass(step.receiver.active)}`}
            >
              <StepContent
                text={step.receiver.text}
                hint={step.receiver.hint}
                stepIndex={i}
              />
            </div>
          </FadeSection>
        );
      })}
    </div>
  );
}

export function LandingV5Content() {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <FadeSection>
            <h2 className={styles.sectionLabel}>two sides, one secret</h2>
          </FadeSection>

          {/* Desktop: side-by-side dual tracks */}
          <div className={styles.desktopOnly}>
            <DesktopTrack />
          </div>

          {/* Mobile: stacked vertical layout */}
          <div className={styles.mobileOnly}>
            <MobileTrack />
          </div>
        </div>
      </section>

      {/* Convergence: the two tracks funnel to a single vanishing point */}
      <FadeSection className={styles.convergence} delay={500}>
        <div className={styles.convergenceInner}>
          <div className={styles.funnelGraphic}>
            <div className={styles.funnelLineLeft} />
            <div className={styles.funnelLineRight} />
            <div className={styles.funnelPoint} />
          </div>
          <p className={styles.nothingRemains}>nothing remains</p>
        </div>
      </FadeSection>
    </>
  );
}

export function LandingV5() {
  return (
    <LandingShell>
      <LandingV5Content />
    </LandingShell>
  );
}

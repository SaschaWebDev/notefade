import { LandingShell, FadeSection, shellStyles } from './LandingShell';
import { LandingFeaturesContent } from './LandingFeatures';
import { LandingComparisonContent } from './LandingComparison';

function AboutSection() {
  return (
    <section className={shellStyles.aboutSection}>
      <FadeSection delay={80}>
        <div className={shellStyles.aboutBody}>
          <h2 className={shellStyles.aboutTitle}>
            <span className={shellStyles.aboutTitleLine} />
            <span className={shellStyles.aboutTitleText}>
              about <span className={shellStyles.aboutTitleBrand}>notefade</span>
            </span>
            <span className={shellStyles.aboutTitleLine} />
          </h2>
          <p className={shellStyles.aboutParagraph}>
            Ever needed to share a password, API key, or private message
            &mdash; but didn&rsquo;t want it sitting in an inbox or chat
            history forever?
          </p>
          <p className={shellStyles.aboutParagraph}>
            notefade is a free, open-source web service for sending
            private, self-destructing notes. There are no accounts to
            create, no apps to install, and no personal data collected
            &mdash; ever.
          </p>
          <p className={shellStyles.aboutParagraph}>
            <strong>Here&rsquo;s how it works:</strong> write your note,
            and it gets encrypted right in your browser. You receive a
            unique link. Copy that link and send it however you prefer
            &mdash; email, text, chat. When the recipient opens the link,
            the note appears once and then disappears permanently. The link
            goes dead. No one can read the note again, not even you.
          </p>
          <p className={shellStyles.aboutParagraph}>
            What makes notefade different is what happens behind the
            scenes. Your content is never sent to or stored on our servers.
            The entire encrypted note lives inside the link itself &mdash;
            in the URL fragment, which browsers never transmit to any
            server. The only thing we store is a tiny 16-byte key fragment,
            meaningless on its own, that&rsquo;s automatically deleted
            after a single read or when your chosen expiry window closes.
            There&rsquo;s nothing to hack, nothing to subpoena, and
            nothing to leak.
          </p>
        </div>
      </FadeSection>
    </section>
  );
}

export function Landing() {
  return (
    <LandingShell>
      <div className={shellStyles.divider} />
      <LandingFeaturesContent />
      <div className={shellStyles.divider} />
      <AboutSection />
      <div className={shellStyles.divider} />
      <LandingComparisonContent />
    </LandingShell>
  );
}

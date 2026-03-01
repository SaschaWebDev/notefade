import { useEffect } from 'react'
import { DocsToc } from './docs/DocsToc'
import { DocsSection } from './docs/DocsSection'
import { DocsCodeBlock } from './docs/DocsCodeBlock'
import { DocsCallout } from './docs/DocsCallout'
import { ApiReference } from './docs/ApiReference'
import { SelfHosting } from './docs/SelfHosting'
import styles from './Docs.module.css'

export function Docs() {
  useEffect(() => {
    document.title = 'notefade docs — Encryption, API Reference & Self-Hosting'
    const meta = document.querySelector('meta[name="description"]')
    const prev = meta?.getAttribute('content') ?? ''
    if (meta) {
      meta.setAttribute('content', 'Technical documentation for notefade: AES-256-GCM encryption details, zero-knowledge architecture, shard API reference, and self-hosting guide.')
    }
    return () => {
      document.title = 'notefade — Self-Destructing Encrypted Notes'
      if (meta) meta.setAttribute('content', prev)
    }
  }, [])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const timeout = setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [])

  return (
    <div className={styles.container}>
      <a href="/" className={styles.backLink}>
        &larr; back to notefade
      </a>

      <h1 className={styles.title}>documentation</h1>
      <p className={styles.intro}>
        Technical reference for notefade's encryption, architecture, API, and
        self-hosting. For a general overview, see the{' '}
        <a href="/" className={styles.introLink}>
          landing page
        </a>
        .
      </p>

      <DocsToc />

      {/* ---- Concepts ---- */}

      <DocsSection id="encryption" title="AES-256 encrypted">
        <p className={styles.p}>
          Every note is encrypted with AES-256-GCM using the Web Crypto API
          built into every modern browser. No external crypto libraries are
          loaded — the entire encryption pipeline is native browser code.
        </p>
        <h3 className={styles.h3}>Key generation</h3>
        <p className={styles.p}>
          A fresh 32-byte (256-bit) key is generated via{' '}
          <code className={styles.code}>crypto.getRandomValues()</code> for each
          note. The key is never reused across notes.
        </p>
        <h3 className={styles.h3}>XOR key splitting</h3>
        <p className={styles.p}>
          The 32-byte key is split into two shares using XOR. A 48-byte random
          mask is generated. The first 32 bytes of the mask are XORed with the
          key to produce the URL share. The remaining 16 bytes of the mask
          become the server shard. Reconstruction XORs the URL share with the
          server shard's first 16 bytes to recover the original key.
        </p>
        <DocsCodeBlock
          language="text"
          code={`key           = 32 bytes (AES-256 key)
xorMask       = 48 bytes (random)
urlShare      = key XOR xorMask[0:31]   → 32 bytes
serverShard   = xorMask[32:47]          → 16 bytes

reconstruct:
key = urlShare XOR shard (first 16 bytes padded)`}
        />
        <h3 className={styles.h3}>Password protection (optional)</h3>
        <p className={styles.p}>
          If a password is set, PBKDF2 derives a secondary key from the password
          with 600,000 iterations, SHA-256, and a random 16-byte salt. The note
          is double-encrypted: first with the random key, then the random key
          itself is wrapped with the password-derived key. The salt and iteration
          count are embedded in the URL fragment.
        </p>
        <DocsCallout variant="note">
          AES-256-GCM provides authenticated encryption — if even one bit of the
          ciphertext is altered, decryption fails entirely rather than producing
          corrupted output.
        </DocsCallout>
        <h3 className={styles.h3}>Byte layout in URL fragment</h3>
        <DocsCodeBlock
          language="text"
          code={`#<shardId>:<base64url payload>

payload = urlShare (32B) + IV (12B) + ciphertext (variable)
total overhead ≈ 44 bytes + ciphertext + base64 expansion`}
        />
        <h3 className={styles.h3}>URL-level padding</h3>
        <p className={styles.p}>
          All shared links are padded to a fixed length (7,307 characters) using
          random fill, regardless of message size. This prevents length-based
          traffic analysis — an observer seeing a notefade link cannot infer
          whether the message is one word or 1,800 characters. The compact
          (unpadded) URL is used only for QR codes, where size constraints
          apply.
        </p>
      </DocsSection>

      <DocsSection id="zero-knowledge" title="zero knowledge">
        <p className={styles.p}>
          The server stores exactly 16 bytes per note — a random-looking key
          shard with no metadata, no IP address, and no content. The encryption
          key, ciphertext, and IV all live in the URL fragment.
        </p>
        <h3 className={styles.h3}>URL fragment guarantee</h3>
        <p className={styles.p}>
          Everything after the <code className={styles.code}>#</code> in a URL
          is never sent to the server. This is defined by{' '}
          <a
            href="https://www.rfc-editor.org/rfc/rfc3986#section-3.5"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            RFC 3986 §3.5
          </a>{' '}
          and enforced by every browser. The server literally cannot see the
          note's ciphertext, IV, or URL share — only the shard ID. URL padding
          further ensures that even the length of the link reveals nothing about
          the message size.
        </p>
        <h3 className={styles.h3}>What the server stores</h3>
        <DocsCodeBlock
          language="text"
          code={`Cloudflare KV entry:
  key   = shard ID (16 hex chars)
  value = 16 bytes (base64url-encoded)
  TTL   = 1h | 24h | 7d

No metadata. No timestamps. No IP logs. No content.`}
        />
        <h3 className={styles.h3}>Breach implications</h3>
        <p className={styles.p}>
          If someone gains full read access to the server storage, they get a
          flat list of 16-byte values. Each value is one half of an XOR split —
          without the other half (which lives in a URL someone shared privately),
          every possible 256-bit key is equally likely. There is nothing to
          decrypt, correlate, or reconstruct.
        </p>
      </DocsSection>

      <DocsSection id="one-time-read" title="one-time read">
        <p className={styles.p}>
          When someone opens a notefade link, the client fetches the server
          shard via <code className={styles.code}>GET /shard/:id</code>. The
          server returns the shard and immediately deletes it. The client
          reconstructs the full key, decrypts the note, and clears the URL
          fragment from the browser's address bar.
        </p>
        <h3 className={styles.h3}>GET-and-delete mechanism</h3>
        <p className={styles.p}>
          The <code className={styles.code}>GET /shard/:id</code> endpoint is
          destructive by design. It reads the shard from KV, starts a deletion,
          and returns the value — all in one request. Subsequent requests for the
          same ID return 404.
        </p>
        <h3 className={styles.h3}>History clearing</h3>
        <p className={styles.p}>
          After decryption, the client calls{' '}
          <code className={styles.code}>history.replaceState()</code> to remove
          the fragment from the address bar. Even if someone inspects browser
          history, the payload is gone.
        </p>
        <DocsCallout variant="caveat">
          Once decrypted, the reader can copy the text, screenshot it, or
          memorize it. No technology can prevent that. One-time read means the
          link works once — it doesn't restrict what the reader does with the
          content.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="auto-expiring" title="auto-expiring">
        <p className={styles.p}>
          Every note has a time-to-live selected at creation: 1 hour, 24 hours,
          or 7 days. If nobody opens the link in that window, the server shard
          expires automatically.
        </p>
        <h3 className={styles.h3}>TTL options</h3>
        <DocsCodeBlock
          language="text"
          code={`3600    →  1 hour
86400   →  24 hours
604800  →  7 days`}
        />
        <h3 className={styles.h3}>KV native expiry</h3>
        <p className={styles.p}>
          Cloudflare KV supports native{' '}
          <code className={styles.code}>expirationTtl</code> on writes. When the
          TTL elapses, KV silently removes the entry. No cron jobs, no cleanup
          scripts, no background workers.
        </p>
        <DocsCallout variant="note">
          Notes fade on whichever comes first: first read or TTL expiry. There
          is no way to extend, renew, or recover an expired note.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="no-tracking" title="no tracking">
        <p className={styles.p}>
          notefade loads zero third-party scripts. No analytics, no tracking
          pixels, no cookie banners — because there are no cookies.
        </p>
        <h3 className={styles.h3}>What is not loaded</h3>
        <ul className={styles.list}>
          <li>No Google Analytics, Plausible, Fathom, or any analytics service</li>
          <li>No Meta Pixel, LinkedIn Insight, or ad-tech scripts</li>
          <li>No Sentry, LogRocket, FullStory, or session recorders</li>
          <li>No cookie consent banners — nothing sets cookies</li>
          <li>No CDN-hosted fonts or scripts (everything is self-hosted)</li>
        </ul>
        <h3 className={styles.h3}>GDPR by architecture</h3>
        <p className={styles.p}>
          The server processes no personal data. It stores 16 anonymous bytes
          per note with no IP logging, no user IDs, and no session state. GDPR
          compliance is structural, not policy-based — there is nothing to
          consent to because no personal data is collected.
        </p>
        <DocsCallout variant="note">
          The only network requests the frontend makes are to the shard API
          (store/fetch/delete a 16-byte shard). No other outbound requests are
          made for any reason.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="open-source" title="open source">
        <p className={styles.p}>
          The complete source code for notefade — frontend, worker, and
          infrastructure — is public on GitHub. Every cryptographic operation
          uses the Web Crypto API with zero external dependencies.
        </p>
        <h3 className={styles.h3}>Zero crypto dependencies</h3>
        <p className={styles.p}>
          The encryption module imports nothing.{' '}
          <code className={styles.code}>crypto.subtle</code> provides
          AES-256-GCM, PBKDF2, and{' '}
          <code className={styles.code}>getRandomValues()</code> natively. No
          npm packages touch your secrets.
        </p>
        <h3 className={styles.h3}>Domain indicator</h3>
        <p className={styles.p}>
          The app includes a domain indicator that checks whether you're on{' '}
          <code className={styles.code}>notefade.com</code> or a self-hosted
          instance. This helps detect phishing forks — if the dot is not green,
          you're not on the official site.
        </p>
        <h3 className={styles.h3}>Self-host option</h3>
        <p className={styles.p}>
          Don't trust the hosted version? Build from source with{' '}
          <code className={styles.code}>yarn build</code>, deploy the static
          output anywhere, and connect your own shard backend. See the{' '}
          <a href="#self-hosting" className={styles.link}>
            self-hosting
          </a>{' '}
          section below.
        </p>
        <h3 className={styles.h3}>Verifiable builds</h3>
        <p className={styles.p}>
          Every production build includes Subresource Integrity attributes on all
          scripts and stylesheets — your browser verifies each asset's hash
          before executing it. A build manifest with SHA-256 checksums is
          published with each release. You can reproduce the exact build locally
          or in Docker and compare. See the{' '}
          <a href="#verifying-builds" className={styles.link}>
            verifying builds
          </a>{' '}
          section for step-by-step instructions.
        </p>
      </DocsSection>

      <DocsSection id="no-accounts" title="no accounts">
        <p className={styles.p}>
          notefade has no user accounts, no sign-up flow, no email collection,
          and no authentication of any kind. You open the page, write a note,
          and get a link.
        </p>
        <h3 className={styles.h3}>Link as token</h3>
        <p className={styles.p}>
          The note link itself is the access credential. Possessing the link (and
          optional password) is the only requirement to read the note. There is
          no session, no login, and no "forgot password" flow because there is no
          account to forget.
        </p>
        <h3 className={styles.h3}>Why identity is unnecessary</h3>
        <p className={styles.p}>
          Authentication exists to associate data with a user. notefade stores no
          user data — the server doesn't know who created a note or who read it.
          Adding accounts would create a metadata trail that undermines the
          privacy model.
        </p>
        <DocsCallout variant="caveat">
          No accounts means no "sent notes" history, no delivery receipts, and
          no way to recover a link you've lost. If the link is gone, the note is
          gone.
        </DocsCallout>
      </DocsSection>

      {/* ---- API Reference ---- */}
      <ApiReference />

      {/* ---- Self-Hosting ---- */}
      <SelfHosting />

      <footer className={styles.footer}>
        <p className={styles.footerCredit}>
          Made with ❤️ by Sascha Majewsky ·{' '}
          <a
            href="https://github.com/saschawebdev/notefade"
            className={styles.footerLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}

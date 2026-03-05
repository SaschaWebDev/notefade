import { useEffect } from 'react'
import { DocsToc } from '@/components/docs/DocsToc'
import { DocsSection } from '@/components/docs/DocsSection'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsCallout } from '@/components/docs/DocsCallout'
import { ApiReference } from '@/components/docs/ApiReference'
import { SelfHosting } from '@/components/docs/SelfHosting'
import styles from './Docs.module.css'

const SCROLL_DELAY_MS = 100

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
      }, SCROLL_DELAY_MS)
      return () => clearTimeout(timeout)
    }
  }, [])

  return (
    <div className={styles.container}>
      <a href="/" className={styles.backLink}>
        &larr; back to notefade
      </a>

      <div className={styles.heroRow}>
        <div className={styles.hero}>
          <img
            src="/notefade-logo-transparent.png"
            alt="notefade logo"
            className={styles.heroLogo}
          />
          <span className={styles.heroText}>
            notefade.com — <em>Private notes that fade</em>
          </span>
        </div>
      </div>

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
        <h3 className={styles.h3}>Multi-read</h3>
        <p className={styles.p}>
          The creator can allow between 1 and 10 reads. For each allowed read,
          an independent copy of the server shard is stored under a unique ID.
          All IDs are embedded in the URL (
          <code className={styles.code}>id1~id2~id3</code>). Each read consumes
          one copy via the same GET-and-delete mechanism. Once every copy is
          consumed, the note is gone.
        </p>
        <p className={styles.p}>
          The server never knows the copies are related — each is an independent
          16-byte value with its own TTL. Every copy holds the same shard value
          but under a different ID. No single copy reveals more information than
          any other. The cryptographic security is identical to one-time read —
          the only difference is the number of times the shard can be retrieved
          before all copies are deleted.
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

      <DocsSection id="fade-after-reading" title="fade after reading">
        <p className={styles.p}>
          After a note is decrypted, the plaintext is held in memory for a
          limited time and then permanently cleared. This is the fade timer — a
          client-side countdown that removes the decrypted content from the
          browser when it expires.
        </p>
        <h3 className={styles.h3}>Default behavior</h3>
        <p className={styles.p}>
          Every note fades. If no duration is configured by the sender, the
          default fade timer is <strong>5 minutes</strong>. After 5 minutes of
          the note being visible, the decrypted text is replaced with a "note
          has faded" message and cannot be recovered.
        </p>
        <h3 className={styles.h3}>Configurable intervals</h3>
        <p className={styles.p}>
          The sender can choose a specific fade duration when creating a note.
          Available intervals are:
        </p>
        <DocsCodeBlock
          language="text"
          code={`30s    →  30 seconds
60s    →  1 minute
300s   →  5 minutes (default)
900s   →  15 minutes`}
        />
        <p className={styles.p}>
          The chosen duration is embedded in the encrypted note metadata. The
          recipient sees a live countdown badge showing how much time remains
          before the content fades.
        </p>
        <h3 className={styles.h3}>What happens when it fades</h3>
        <ul className={styles.list}>
          <li>The decrypted plaintext is dropped from React state — it no longer exists in the component tree</li>
          <li>The server shard was already deleted on read, so the note cannot be decrypted again</li>
          <li>The URL fragment was cleared from the address bar on decryption, so the link is also gone</li>
          <li>The reader sees a "note has faded" screen with no way to recover the content</li>
        </ul>
        <DocsCallout variant="caveat">
          The fade timer is a client-side control. It clears the plaintext from
          the browser's memory, but it cannot prevent a reader from copying the
          text, taking a screenshot, or saving the content before the timer
          expires. It is a usability safeguard — not a security guarantee.
        </DocsCallout>
        <DocsCallout variant="note">
          The fade duration is stored inside the encrypted payload, not as
          server-side metadata. The server has no knowledge of whether a note
          has a 30-second or 15-minute fade timer — only the recipient's
          browser knows, after decryption.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="time-lock" title="time-lock">
        <p className={styles.p}>
          Time-lock lets you create a note that cannot be read until a specific
          date and time. The recipient can open the link immediately, but they
          see a live countdown instead of the note content. Once the unlock time
          arrives, the note becomes readable.
        </p>
        <h3 className={styles.h3}>How it works</h3>
        <p className={styles.p}>
          The sender picks a future date and time when creating the note. The
          unlock timestamp is embedded directly into the URL — either as an
          explicit prefix in compact (QR) links, or steganographically hidden in
          the random padding of full-length links. When the recipient opens the
          link, the client extracts the timestamp and compares it to the current
          time. If the unlock time hasn't arrived yet, the client shows a
          countdown and blocks all decryption attempts — the shard is never
          fetched from the server until the lock expires.
        </p>
        <h3 className={styles.h3}>Server knows nothing</h3>
        <p className={styles.p}>
          The time-lock is purely client-side. The server never receives the
          unlock timestamp — it lives entirely in the URL fragment. The server
          stores the same 16-byte shard as any other note and has no idea
          whether a time-lock is attached.
        </p>
        <h3 className={styles.h3}>Constraints</h3>
        <ul className={styles.list}>
          <li>The unlock time must be at least 1 minute in the future</li>
          <li>The unlock time must be before the note's TTL expiry — a note that expires in 1 hour cannot be time-locked for 2 hours</li>
          <li>When combined with deferred activation, the note is doubly gated: the shard must be activated first, then the time-lock must expire</li>
        </ul>
        <DocsCallout variant="caveat">
          Time-lock is a client-side control. It prevents the normal reading
          flow, but a technically sophisticated user could extract the unlock
          timestamp from the URL and manipulate their system clock. This is an
          accepted trade-off — the feature provides a usability gate, not a
          cryptographic guarantee.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="deferred-activation" title="deferred activation">
        <p className={styles.p}>
          Dead drop mode lets you encrypt a note now and activate it later.
          The server shard is not stored until you explicitly trigger activation
          with a launch code — until then, the note link exists but is inert.
        </p>
        <h3 className={styles.h3}>How it works</h3>
        <ol className={styles.list}>
          <li>Create a note with dead drop mode enabled</li>
          <li>The server returns an opaque launch code (a JSON file containing an encrypted token and the URL fragment)</li>
          <li>Share the note link — it won't work yet because the shard isn't stored</li>
          <li>When ready, upload the launch code at <code className={styles.code}>/activate</code> — the server decrypts the token, stores the shard, and the link goes live</li>
        </ol>
        <h3 className={styles.h3}>TTL starts on activation</h3>
        <p className={styles.p}>
          The note's time-to-live countdown begins when the launch code is
          activated, not when the note is created. Create a note on Monday with
          a 24-hour TTL. Activate it on Wednesday. The note expires Thursday —
          24 hours after activation, not after creation.
        </p>
        <h3 className={styles.h3}>30-day activation window</h3>
        <p className={styles.p}>
          Tokens must be activated within 30 days of creation. After that, the
          server rejects the token with HTTP 410 Gone. This prevents
          indefinitely-old tokens from accumulating.
        </p>
        <h3 className={styles.h3}>Token is opaque</h3>
        <p className={styles.p}>
          The launch code token is encrypted by the server using a secret key
          (<code className={styles.code}>DEFER_SECRET</code>). The client
          cannot read or modify the token's contents. If the token is tampered
          with, activation fails.
        </p>
        <DocsCallout variant="note">
          The URL fragment data (ciphertext, IV, XOR share) is still included
          in the launch code because the client needs it to build the final note
          URL. This data is meaningless without the server shard — possessing the
          fragment alone reveals nothing about the note's content.
        </DocsCallout>
        <DocsCallout variant="caveat">
          Deferred activation requires a server-side worker with{' '}
          <code className={styles.code}>DEFER_SECRET</code> configured.
          When using a BYOS provider that connects directly to a storage
          backend (e.g. the Cloudflare KV API, D1, Upstash, or Supabase
          adapters), deferred activation is not available — these adapters
          talk to storage from the browser with no server-side worker to
          hold the signing secret. The default notefade API and self-hosted
          workers that use KV behind a worker support it natively.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="steganography" title="steganographic sharing">
        <p className={styles.p}>
          Two methods to disguise a note link so it doesn't look like a link at
          all: hide it in text or hide it in an image. Both are zero-dependency
          — built with vanilla JS and the Canvas API.
        </p>

        <h3 className={styles.h3}>Hide in text (zero-width Unicode)</h3>
        <p className={styles.p}>
          The URL is converted to binary and encoded as invisible zero-width
          Unicode characters, interleaved between the letters of innocent cover
          text. The result looks like a normal sentence — the hidden link is
          completely invisible.
        </p>
        <DocsCodeBlock
          language="text"
          code={`U+200B (zero-width space)      = 0
U+200C (zero-width non-joiner) = 1
U+200D (zero-width joiner)     = byte separator`}
        />
        <DocsCallout variant="caveat">
          Some apps strip zero-width characters on paste. Not all text channels
          preserve them. If the recipient can't decode, send the link directly.
        </DocsCallout>

        <h3 className={styles.h3}>Hide in image (LSB steganography)</h3>
        <p className={styles.p}>
          The URL bits are written into the least-significant bit of each R, G,
          and B channel in the image pixels. Alpha is left untouched. A 4-byte
          big-endian length header precedes the UTF-8 payload.
        </p>
        <DocsCodeBlock
          language="text"
          code={`pixel data (RGBA):
  R → LSB carries 1 payload bit
  G → LSB carries 1 payload bit
  B → LSB carries 1 payload bit
  A → untouched

payload = [length: 4 bytes big-endian] [URL: UTF-8 bytes]
capacity = width × height × 3 bits`}
        />
        <p className={styles.p}>
          Two modes: generate random abstract art, or upload your own image.
          The change is visually imperceptible — a 1-bit change per channel is
          invisible to the human eye.
        </p>

        <h3 className={styles.h3}>PNG vs ZIP downloads</h3>
        <p className={styles.p}>
          Messengers recompress images by default, which destroys the LSB data.
          Choose the right format for how you're sending:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>PNG</strong> — use when sending as a file or document
            (WhatsApp "send as document", email attachments, cloud storage,
            AirDrop)
          </li>
          <li>
            <strong>ZIP</strong> — wraps the PNG so messengers won't
            recompress it; safest option for messenger sharing
          </li>
        </ul>
        <DocsCallout variant="warning">
          Never send a steganographic image as a regular photo in a messenger.
          Use "send as document", "original quality", or wrap it in a ZIP.
        </DocsCallout>

        <h3 className={styles.h3}>Anti-fingerprint filenames</h3>
        <p className={styles.p}>
          Every download gets a randomized filename from 16 patterns using{' '}
          <code className={styles.code}>crypto.getRandomValues()</code>. No
          recognizable app signature — an interceptor cannot determine the file
          came from notefade.
        </p>
        <DocsCodeBlock
          language="text"
          code={`IMG_20260303_142517.png     (camera roll)
Screenshot_2026-03-03-...   (screenshot)
sunset_v2.png               (art/creative)
from_alex_painting.png      (shared by person)
download (7).png            (generic download)`}
        />

        <h3 className={styles.h3}>Decoding</h3>
        <p className={styles.p}>
          The{' '}
          <a href="/decode" className={styles.link}>
            notefade.com/decode
          </a>{' '}
          page extracts hidden links from both images and text. Drag-and-drop
          or upload an image, or paste text into the text area to reveal the
          embedded link.
        </p>
      </DocsSection>

      <DocsSection id="proof-of-read" title="proof of read">
        <p className={styles.p}>
          An optional receipt mechanism that lets the note creator verify
          someone decrypted their note — without knowing who.
        </p>
        <h3 className={styles.h3}>How it works</h3>
        <ol className={styles.list}>
          <li>The creator enables "proof of read" when writing the note. A 32-byte random seed is generated and embedded in the encrypted metadata.</li>
          <li>When the recipient decrypts the note, the client computes HMAC-SHA256 of the plaintext hash using the seed as the key. This is the proof.</li>
          <li>The creator pastes the proof into the <a href="/verify" className={styles.link}>verification page</a> along with their seed and the original plaintext. If the HMAC matches, the note was read.</li>
        </ol>
        <h3 className={styles.h3}>What it proves</h3>
        <p className={styles.p}>
          The proof demonstrates that someone had access to the decrypted
          content. It does not prove <em>who</em> accessed it — notefade has
          no accounts, so there is no identity to bind the proof to. The
          receipt is a cryptographic fact ("this plaintext was seen"), not an
          identity claim.
        </p>
        <DocsCallout variant="caveat">
          A receipt proves access to decrypted content, not who accessed it.
          The reader could also forward the proof to someone else. Treat it
          as a signal, not a legal instrument.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="decoy-links" title="decoy links">
        <p className={styles.p}>
          Generate extra encrypted notes with plausible alternate content
          and share multiple links. An observer cannot tell which link
          carries the real message.
        </p>
        <h3 className={styles.h3}>How it works</h3>
        <p className={styles.p}>
          When creating a note, enable decoy links and choose how many to
          generate (1–3). Each decoy is a fully valid encrypted note — not
          a fake or empty placeholder. It goes through the same encryption
          flow, gets its own server shard, and produces its own unique link.
        </p>
        <p className={styles.p}>
          Decoy content is auto-generated from 80 everyday text messages
          across four categories — past events, plans, reactions, and daily
          life. Each
          decoy has its own regenerate button to shuffle to a different message,
          and you can edit the text directly if you want something specific.
        </p>
        <DocsCallout variant="note">
          Decoy notes are created without optional features — no password
          protection, time-lock, fade timer, proof of read, or multi-read.
          They are simple one-time-read notes with a single shard. This keeps
          decoys lightweight and indistinguishable from a basic note.
        </DocsCallout>
        <h3 className={styles.h3}>Use case</h3>
        <p className={styles.p}>
          When sharing under surveillance or in an environment where link
          access is monitored, sending multiple plausible links provides
          deniability. An observer sees several notefade links but cannot
          determine which one contains the intended message — all links
          look identical from the outside, and all are padded to the same
          length.
        </p>
        <DocsCallout variant="note">
          Decoy notes are real notes. They consume server shards, respect
          TTL, and self-destruct on read just like any other note. The
          server has no way to distinguish a decoy from a real note.
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
          No accounts means no "sent notes" history and no way to recover a
          link you've lost. If the link is gone, the note is gone. Opt-in{' '}
          <a href="#proof-of-read" className={styles.link}>
            proof-of-read receipts
          </a>{' '}
          are available without accounts — they prove someone decrypted the
          note, not who.
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

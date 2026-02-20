import { useEffect } from 'react'
import styles from './Docs.module.css'

export function Docs() {
  useEffect(() => {
    document.title = 'notefade — how it works'
    return () => {
      document.title = 'notefade'
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
        ← back to notefade
      </a>

      <h1 className={styles.title}>how it works</h1>
      <p className={styles.intro}>
        notefade encrypts your note entirely in the browser before anything
        touches a server. Here's what happens at each step.
      </p>

      <section id="encryption" className={styles.section}>
        <h2 className={styles.sectionTitle}>AES-256 encrypted</h2>
        <p className={styles.paragraph}>
          Every note is encrypted with AES-256-GCM — the same cipher used across
          modern secure systems. Encryption and decryption happen entirely in
          your browser using the Web Crypto API, a native browser standard. No
          external crypto libraries are loaded.
        </p>
        <p className={styles.paragraph}>
          The encryption key is generated fresh for each note and never leaves
          your device in its complete form. It's split before anything is sent
          anywhere.
        </p>
        <div className={styles.detail}>
          AES-256-GCM provides both confidentiality and integrity — if even one
          bit of the ciphertext is altered, decryption fails entirely rather than
          producing corrupted output.
        </div>
      </section>

      <section id="zero-knowledge" className={styles.section}>
        <h2 className={styles.sectionTitle}>zero knowledge</h2>
        <p className={styles.paragraph}>
          Most services promise not to read your data. notefade is built so the
          server literally cannot. The encryption key is split into two pieces
          using XOR — the server stores 16 bytes, and the rest lives in the URL
          fragment. Neither piece is useful alone.
        </p>
        <p className={styles.paragraph}>
          The URL fragment (everything after the #) is never sent to the server
          by browsers. This isn't a policy — it's how HTTP works. The server
          sees a shard ID and nothing else.
        </p>
        <div className={styles.detail}>
          The server stores exactly 16 bytes per note — a random-looking key
          shard with no metadata, no IP addresses, and no content. Even under a
          subpoena, there is nothing meaningful to hand over.
        </div>
      </section>

      <section id="one-time-read" className={styles.section}>
        <h2 className={styles.sectionTitle}>one-time read</h2>
        <p className={styles.paragraph}>
          When someone opens a notefade link, the server returns the stored key
          shard and immediately deletes it. The browser reconstructs the full
          key, decrypts the note, and clears the URL fragment. The link stops
          working.
        </p>
        <p className={styles.paragraph}>
          If you try the same link again, the shard is already gone — decryption
          is impossible.
        </p>
        <div className={styles.detail}>
          Honest caveat: once a note is decrypted in the browser, the reader can
          copy the text or take a screenshot. No technology can prevent that.
          One-time read means the link works once — it doesn't restrict what the
          reader does with what they see.
        </div>
      </section>

      <section id="auto-expiring" className={styles.section}>
        <h2 className={styles.sectionTitle}>auto-expiring</h2>
        <p className={styles.paragraph}>
          Every note has a time-to-live: 1 hour, 24 hours, or 7 days. If nobody
          opens the link in that window, the server shard fades away
          automatically. No cron jobs, no cleanup scripts — the storage layer
          handles expiry natively.
        </p>
        <p className={styles.paragraph}>
          Once the shard is gone — whether read or expired — the note can never
          be recovered. The ciphertext in the URL is meaningless without it.
        </p>
        <div className={styles.detail}>
          Notes fade on whichever comes first: first read or TTL expiry. There
          is no way to extend, renew, or recover an expired note.
        </div>
      </section>
    </div>
  )
}

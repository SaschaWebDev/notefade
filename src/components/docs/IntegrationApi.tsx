import { DocsSection } from './DocsSection';
import { DocsCallout } from './DocsCallout';
import { ApiEndpoint } from './ApiEndpoint';
import { INTEGRATION_ENDPOINTS } from './docs-data';
import styles from './IntegrationApi.module.css';

export function IntegrationApi() {
  return (
    <DocsSection id='integration-api' title='integration API (third-party)'>
      <DocsCallout variant='danger'>
        These endpoints do <strong>not</strong> follow notefade's zero-knowledge
        security model. The create endpoint receives plaintext and encrypts it
        on the server. The read endpoint fetches the shard, reconstructs the
        key, and decrypts on the server. In both cases, plaintext is held in
        volatile Worker memory for ~1-2ms — never stored, never logged, no
        filesystem — but the server <em>processes</em> content, which the main
        application never does. Do not send highly sensitive plaintext through
        the create endpoint — ONLY EVER SEND ALREADY ENCRYPTED TEXT. The read
        endpoint will return whatever the note contains, so if the content was
        pre-encrypted before creation, the server only ever sees the opaque
        ciphertext. These are convenience APIs for trusted third-party
        applications, not a replacement for the main application's client-side
        encryption.
      </DocsCallout>

      <p className={styles.text}>
        The integration API lets third-party applications create and read
        encrypted notes with a single HTTP request. It uses the same
        AES-256-GCM encryption and XOR key splitting as the main app, but
        encryption and decryption happen on the server instead of in the
        browser.
      </p>

      <h3 className={styles.subheading}>How it differs from the main app</h3>
      <table className={styles.comparisonTable}>
        <thead>
          <tr>
            <th>Property</th>
            <th>Main app</th>
            <th>Integration API</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Encryption location</td>
            <td>Client (browser)</td>
            <td>Server (Worker isolate)</td>
          </tr>
          <tr>
            <td>Decryption location</td>
            <td>Client (browser)</td>
            <td>Server (Worker isolate)</td>
          </tr>
          <tr>
            <td>Server sees plaintext</td>
            <td>Never</td>
            <td>Briefly (~1-2ms in volatile memory)</td>
          </tr>
          <tr>
            <td>Trust model</td>
            <td>Server never sees content</td>
            <td>Server processes but never stores content</td>
          </tr>
          <tr>
            <td>Encrypted output</td>
            <td>AES-256-GCM + XOR split</td>
            <td>Identical — same algorithm, same format</td>
          </tr>
          <tr>
            <td>One-time read</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
        </tbody>
      </table>

      <h3 className={styles.subheading}>When to use this</h3>
      <ul className={styles.list}>
        <li>Third-party apps that need to create or read notes programmatically</li>
        <li>
          Server-side services where importing the crypto module isn't practical
        </li>
        <li>
          Trusted integrations owned by the same operator running the Worker
        </li>
        <li>
          Consuming notes that were created with pre-encrypted content — the
          server only sees the opaque ciphertext, not the underlying secret
        </li>
      </ul>

      <h3 className={styles.subheading}>When NOT to use this</h3>
      <DocsCallout variant='warning'>
        If you need true zero-knowledge, use the main application or implement
        client-side encryption yourself. If the data is highly sensitive, use
        the main app directly. If you don't control the Worker, you're trusting
        someone else's server with your plaintext.
      </DocsCallout>

      <h3 className={styles.subheading}>Endpoint</h3>
      <div className={styles.endpoints}>
        {INTEGRATION_ENDPOINTS.map((ep) => (
          <ApiEndpoint key={`${ep.method}-${ep.path}`} endpoint={ep} />
        ))}
      </div>

      <h3 className={styles.subheading}>Authentication</h3>
      <p className={styles.text}>
        Every request must include an{' '}
        <code className={styles.inlineCode}>X-Api-Key</code> header. Keys follow
        the format{' '}
        <code className={styles.inlineCode}>nfk_&lt;32 hex chars&gt;</code>. The
        server stores only the SHA-256 hash of each key — the raw key is never
        persisted. Missing or invalid keys return{' '}
        <code className={styles.inlineCode}>401</code>.
      </p>

      <h3 className={styles.subheading}>Rate limiting</h3>
      <p className={styles.text}>
        Rate limits are enforced per key using KV-backed minute buckets. The
        default limit is 60 requests per minute, configurable per key. Every
        response includes rate limit headers:
      </p>
      <ul className={styles.headerList}>
        <li className={styles.headerItem}>X-RateLimit-Limit</li>
        <li className={styles.headerItem}>X-RateLimit-Remaining</li>
        <li className={styles.headerItem}>X-RateLimit-Reset</li>
      </ul>
      <p className={styles.text}>
        When the limit is exceeded, the server returns{' '}
        <code className={styles.inlineCode}>429</code> with a{' '}
        <code className={styles.inlineCode}>Retry-After</code> header. The rate
        limiter is fail-open — if KV is temporarily unavailable, requests are
        allowed through.
      </p>

      <h3 className={styles.subheading}>Security properties</h3>
      <p className={styles.text}>
        What <strong>is</strong> protected:
      </p>
      <ul className={styles.list}>
        <li>
          TLS encrypts the request in transit — plaintext is never sent over the
          wire unencrypted
        </li>
        <li>Plaintext is never written to storage, logs, or any filesystem</li>
        <li>
          The encrypted output is identical to the main app — recipients cannot
          distinguish how the note was created
        </li>
        <li>
          The shard is deleted after a single read, same as any other note
        </li>
      </ul>
      <p className={styles.text}>
        What is <strong>not</strong> protected:
      </p>
      <ul className={styles.list}>
        <li>
          Plaintext is visible to the Worker isolate for ~1-2ms during
          encryption or decryption
        </li>
        <li>
          The read endpoint requires sending the full note URL (including
          fragment) to the server — in normal browser usage, the fragment never
          leaves the client
        </li>
        <li>
          Cloudflare (as the infrastructure provider) could theoretically
          inspect Worker memory
        </li>
        <li>
          A compromised Worker deployment could exfiltrate plaintext before
          encrypting
        </li>
      </ul>
    </DocsSection>
  );
}

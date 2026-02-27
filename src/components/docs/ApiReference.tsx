import { DocsSection } from './DocsSection'
import { DocsCallout } from './DocsCallout'
import { ApiEndpoint } from './ApiEndpoint'
import { ENDPOINTS, CORS_ORIGINS, RATE_LIMITS } from './docs-data'
import styles from './ApiReference.module.css'

export function ApiReference() {
  return (
    <DocsSection id="api" title="API reference">
      <p className={styles.text}>
        The notefade shard API is a minimal REST service. It stores, serves, and
        deletes 16-byte key shards. It does not see, store, or process note
        content in any form.
      </p>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Base URL</span>
          <code className={styles.metaValue}>https://notefade-worker.saschawebdev.workers.dev</code>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Content-Type</span>
          <code className={styles.metaValue}>application/json</code>
        </div>
      </div>

      <h3 className={styles.subheading}>CORS policy</h3>
      <p className={styles.text}>
        The API allows cross-origin requests from the following origins:
      </p>
      <ul className={styles.originList}>
        {CORS_ORIGINS.map((origin) => (
          <li key={origin}>
            <code className={styles.origin}>{origin}</code>
          </li>
        ))}
      </ul>

      <DocsCallout variant="note">
        All responses include <code className={styles.inlineCode}>Cache-Control: no-store</code> and{' '}
        <code className={styles.inlineCode}>Pragma: no-cache</code> to prevent shard data
        from being cached by browsers or proxies.
      </DocsCallout>

      <h3 className={styles.subheading}>Rate limits</h3>
      <p className={styles.text}>
        Per-IP, per-method limits enforced in-memory at the Cloudflare Worker
        isolate level. Exceeding returns <code className={styles.inlineCode}>429</code> with
        a <code className={styles.inlineCode}>Retry-After</code> header.
      </p>
      <table className={styles.rateTable}>
        <thead>
          <tr>
            <th>Method</th>
            <th>Limit</th>
            <th>Window</th>
          </tr>
        </thead>
        <tbody>
          {RATE_LIMITS.map((rl) => (
            <tr key={rl.method}>
              <td><code className={styles.methodCode}>{rl.method}</code></td>
              <td>{rl.limit} requests</td>
              <td>{rl.window}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.subheading}>Endpoints</h3>
      <div className={styles.endpoints}>
        {ENDPOINTS.map((ep) => (
          <ApiEndpoint key={`${ep.method}-${ep.path}`} endpoint={ep} />
        ))}
      </div>
    </DocsSection>
  )
}

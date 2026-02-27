import { DocsSection } from './DocsSection'
import { DocsCodeBlock } from './DocsCodeBlock'
import { DocsCallout } from './DocsCallout'
import { SHARD_STORE_INTERFACE } from './docs-data'
import { PROVIDERS } from '../../api/provider-registry'
import styles from './SelfHosting.module.css'

export function SelfHosting() {
  return (
    <DocsSection id="self-hosting" title="self-hosting">
      <p className={styles.text}>
        notefade is designed to be self-hostable. The frontend is a static SPA
        you can serve from anywhere. The backend is a thin shard API that
        implements a single interface.
      </p>

      <h3 className={styles.subheading}>ShardStore interface</h3>
      <p className={styles.text}>
        Any backend that implements these four methods is a valid notefade shard
        store. The official Cloudflare Worker uses Cloudflare KV, but you can
        swap in any storage layer.
      </p>
      <DocsCodeBlock code={SHARD_STORE_INTERFACE} language="typescript" />

      <DocsCallout variant="note">
        The <code className={styles.inlineCode}>get()</code> method must delete
        the shard after reading — this is the one-time read guarantee. If your
        storage layer doesn't support atomic get-and-delete, read then delete in
        sequence and accept the small race window.
      </DocsCallout>

      <h3 className={styles.subheading}>Supported providers</h3>
      <p className={styles.text}>
        The notefade frontend includes built-in adapters for {PROVIDERS.length}{' '}
        backend providers. Users can connect their own storage via the
        configuration panel.
      </p>

      <table className={styles.providerTable}>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Type</th>
            <th>Fields</th>
            <th>Credentials</th>
          </tr>
        </thead>
        <tbody>
          {PROVIDERS.map((p) => (
            <tr key={p.type}>
              <td className={styles.providerName}>{p.label}</td>
              <td>
                <code className={styles.providerType}>{p.type}</code>
              </td>
              <td className={styles.fieldList}>
                {p.fields.map((f) => (
                  <code key={f.key} className={styles.fieldCode}>
                    {f.label}
                  </code>
                ))}
              </td>
              <td>
                {p.showCredentialWarning ? (
                  <span className={styles.credYes}>required</span>
                ) : (
                  <span className={styles.credNo}>none</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <DocsCallout variant="warning">
        When using a third-party provider, your API credentials are stored in
        your browser's localStorage. They are never sent to notefade's servers.
        Use providers you trust, and prefer the Self-Hosted API option if you
        want full control.
      </DocsCallout>

      <h3 className={styles.subheading}>How to connect</h3>
      <ol className={styles.steps}>
        <li>Open the configuration panel (gear icon on the create note page)</li>
        <li>Select your provider from the dropdown</li>
        <li>Enter the required fields (URL, credentials)</li>
        <li>Save — all subsequent notes will use your backend</li>
      </ol>
      <p className={styles.text}>
        To deploy the frontend, build the static SPA with{' '}
        <code className={styles.inlineCode}>yarn build</code> and serve the{' '}
        <code className={styles.inlineCode}>dist/</code> directory from any
        static host (Cloudflare Pages, Vercel, Netlify, or your own Nginx).
      </p>
    </DocsSection>
  )
}

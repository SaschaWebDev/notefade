import { DocsSection } from './DocsSection'
import { DocsCodeBlock } from './DocsCodeBlock'
import { DocsCallout } from './DocsCallout'
import { SHARD_STORE_INTERFACE } from './docs-data'
import { PROVIDERS } from '../../api/provider-registry'
import styles from './SelfHosting.module.css'

const VERIFY_DOCKER = `git clone https://github.com/user/notefade.git
cd notefade
git checkout v0.1.0
yarn build:docker
# Compare dist-verify/build-manifest.json against the live site`

const VERIFY_CLI = `git checkout v0.1.0
yarn install --frozen-lockfile
yarn build:prod
node scripts/verify-build.cjs`

export function SelfHosting() {
  return (
    <>
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

        <h3 className={styles.subheading}>Deploying the Cloudflare Worker</h3>
        <p className={styles.text}>
          If you're using the default Cloudflare Worker as your shard backend,
          deploy it in two steps. First, generate the wrangler config from the
          template (this substitutes your KV namespace IDs from environment
          variables):
        </p>
        <DocsCodeBlock code="node scripts/gen-wrangler-config.cjs" language="bash" />
        <p className={styles.text}>
          Then deploy the worker:
        </p>
        <DocsCodeBlock code="npx wrangler deploy worker/index.ts" language="bash" />
        <DocsCallout variant="note">
          Run both commands in sequence whenever you update the worker code.
          The first command generates{' '}
          <code className={styles.inlineCode}>wrangler.toml</code> from{' '}
          <code className={styles.inlineCode}>wrangler.template.toml</code> — make
          sure your <code className={styles.inlineCode}>CF_KV_SHARDS_ID</code> and{' '}
          <code className={styles.inlineCode}>CF_KV_SHARDS_PREVIEW_ID</code>{' '}
          environment variables are set.
        </DocsCallout>

        <h3 className={styles.subheading}>Enabling deferred activation</h3>
        <p className={styles.text}>
          Deferred activation (dead drop mode) is optional. If you want to
          support it, set a{' '}
          <code className={styles.inlineCode}>DEFER_SECRET</code> on your
          worker. Without it, the{' '}
          <code className={styles.inlineCode}>/shard/defer</code> and{' '}
          <code className={styles.inlineCode}>/shard/activate</code> endpoints
          return 501.
        </p>
        <DocsCodeBlock
          code={`# Generate a 32-byte hex secret\nopenssl rand -hex 32\n\n# Store it as a Workers secret (never committed to code)\nwrangler secret put DEFER_SECRET`}
          language="bash"
        />
        <p className={styles.text}>
          <code className={styles.inlineCode}>DEFER_SECRET</code> is a
          server-side secret consumed by the Cloudflare Worker, not the Pages
          frontend.{' '}
          <code className={styles.inlineCode}>wrangler secret put</code> stores
          it encrypted and injects it at runtime via the worker's{' '}
          <code className={styles.inlineCode}>env</code> parameter. The SPA
          never sees this variable.
        </p>
        <DocsCallout variant="warning">
          BYOS providers that connect directly to a storage backend from the
          browser (the Cloudflare KV API, D1, Upstash, Supabase, DynamoDB, and
          Vercel KV adapters) do not support deferred activation — there is no
          server-side process to hold a secret or encrypt tokens. This does not
          affect the default notefade deployment, which uses Cloudflare KV
          behind a worker. Use the default Cloudflare Worker or a self-hosted
          API that implements the{' '}
          <code className={styles.inlineCode}>/shard/defer</code> and{' '}
          <code className={styles.inlineCode}>/shard/activate</code> endpoints.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="verifying-builds" title="verifying builds">
        <p className={styles.text}>
          notefade supports reproducible builds. You can verify that the code
          running on notefade.com matches the open-source repository — don't
          trust, verify.
        </p>

        <h3 className={styles.subheading}>What's included</h3>
        <p className={styles.text}>
          Every production build generates a{' '}
          <code className={styles.inlineCode}>build-manifest.json</code> containing
          SHA-256 hashes of every file in the build output. Tagged releases on
          GitHub include this manifest as an artifact.
        </p>
        <p className={styles.text}>
          Additionally, all <code className={styles.inlineCode}>{'<script>'}</code>{' '}
          and <code className={styles.inlineCode}>{'<link>'}</code> tags in{' '}
          <code className={styles.inlineCode}>index.html</code> include{' '}
          <code className={styles.inlineCode}>integrity</code> attributes
          (Subresource Integrity). Your browser will refuse to load any asset
          whose content doesn't match its declared hash.
        </p>

        <h3 className={styles.subheading}>Verify with Docker</h3>
        <p className={styles.text}>
          The most reliable way to reproduce the build. Docker pins the exact
          Node.js version and installs dependencies from the lockfile:
        </p>
        <DocsCodeBlock code={VERIFY_DOCKER} language="bash" />
        <p className={styles.text}>
          The <code className={styles.inlineCode}>dist-verify/</code> directory
          will contain the full build output including{' '}
          <code className={styles.inlineCode}>build-manifest.json</code>. Compare
          it against the manifest from the GitHub release or the live site.
        </p>

        <h3 className={styles.subheading}>Verify with the CLI script</h3>
        <p className={styles.text}>
          If you have Node.js 22.14.0 installed locally, you can build and verify
          directly:
        </p>
        <DocsCodeBlock code={VERIFY_CLI} language="bash" />
        <p className={styles.text}>
          The script fetches the build manifest from notefade.com, downloads
          every listed file, and verifies SHA-256 hashes for self-consistency.
          It also checks SRI integrity attributes on scripts and stylesheets.
        </p>

        <h3 className={styles.subheading}>GitHub release manifests</h3>
        <p className={styles.text}>
          Each tagged release (<code className={styles.inlineCode}>v*</code>)
          automatically attaches{' '}
          <code className={styles.inlineCode}>build-manifest.json</code> via
          GitHub Actions. You can download it from the Releases page and diff
          against your local build.
        </p>

        <DocsCallout variant="caveat">
          Reproducibility depends on using the same Node.js version and lockfile.
          The <code className={styles.inlineCode}>.nvmrc</code> file pins Node to
          22.14.0, and{' '}
          <code className={styles.inlineCode}>yarn.lock</code> pins all
          dependencies. Docker is the most reliable method since it controls the
          full environment. If deploying via Cloudflare Pages, set{' '}
          <code className={styles.inlineCode}>NODE_VERSION</code> to{' '}
          <code className={styles.inlineCode}>22.14.0</code> in your Pages
          environment variables — Cloudflare does not read{' '}
          <code className={styles.inlineCode}>.nvmrc</code> by default.
        </DocsCallout>
      </DocsSection>
    </>
  )
}

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const manifestPath = path.join(distDir, 'build-manifest.json')
const pkgPath = path.join(root, 'package.json')

if (!fs.existsSync(distDir)) {
  console.error('dist/ directory not found. Run `yarn build` first.')
  process.exit(1)
}

function walkDir(dir) {
  const entries = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      entries.push(...walkDir(full))
    } else {
      entries.push(full)
    }
  }
  return entries
}

function sha256(filePath) {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(content).digest('hex')
}

const commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf-8' }).trim()
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
const nodeVersion = process.version.replace(/^v/, '')

// Files consumed by Cloudflare Pages platform — not fetchable as static assets.
// _headers / _redirects: CF intercepts these, requests return SPA fallback HTML.
// robots.txt: CF prepends managed bot rules, so hash will never match.
const PLATFORM_FILES = ['_headers', '_redirects', 'robots.txt']

const allFiles = walkDir(distDir)
  .map((f) => path.relative(distDir, f).replace(/\\/g, '/'))
  .filter((f) => f !== 'build-manifest.json')
  .filter((f) => !PLATFORM_FILES.includes(f))
  .sort()

const files = {}
for (const rel of allFiles) {
  const full = path.join(distDir, rel)
  const stat = fs.statSync(full)
  files[rel] = {
    size: stat.size,
    sha256: sha256(full),
  }
}

const manifest = {
  version: pkg.version,
  commit,
  node: nodeVersion,
  files,
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Build manifest written: ${Object.keys(files).length} files`)

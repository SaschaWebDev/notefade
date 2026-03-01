const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const SITE_URL = 'https://notefade.com'
const distDir = path.resolve(__dirname, '..', 'dist')
const localManifestPath = path.join(distDir, 'build-manifest.json')

function fetch(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https:') ? https.get : require('http').get
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function sha384Base64(buffer) {
  return crypto.createHash('sha384').update(buffer).digest('base64')
}

async function main() {
  // --- Step 1: Fetch remote manifest ---
  console.log(`Fetching build manifest from ${SITE_URL}...\n`)
  let remoteManifest
  try {
    const buf = await fetch(`${SITE_URL}/build-manifest.json`)
    remoteManifest = JSON.parse(buf.toString('utf-8'))
  } catch (err) {
    console.error(`Could not fetch remote manifest: ${err.message}`)
    process.exit(1)
  }

  console.log(`Remote build: v${remoteManifest.version}, commit ${remoteManifest.commit.slice(0, 7)}, node ${remoteManifest.node}`)

  // --- Step 2: Compare with local manifest if available ---
  if (fs.existsSync(localManifestPath)) {
    const localManifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf-8'))
    console.log(`Local build:  v${localManifest.version}, commit ${localManifest.commit.slice(0, 7)}, node ${localManifest.node}`)
    if (localManifest.commit !== remoteManifest.commit) {
      console.log(`\n  WARNING: Commits differ (local ${localManifest.commit.slice(0, 7)} != remote ${remoteManifest.commit.slice(0, 7)})`)
    }
    if (localManifest.node !== remoteManifest.node) {
      console.log(`  WARNING: Node versions differ (local ${localManifest.node} != remote ${remoteManifest.node})`)
      console.log(`           Different Node versions produce different Vite content hashes.`)
      console.log(`           Use Docker (yarn build:docker) for reproducible cross-environment builds.`)
    }
  }

  // --- Step 3: Fetch index.html ---
  console.log(`\nVerifying deployed files against remote manifest...\n`)
  const indexBuf = await fetch(`${SITE_URL}/`)
  const indexStr = indexBuf.toString('utf-8')

  // Build URL map: manifest filename -> fetch URL
  // index.html must be fetched from "/" (not "/index.html" which may redirect)
  function urlForFile(name) {
    if (name === 'index.html') return `${SITE_URL}/`
    return `${SITE_URL}/${name}`
  }

  // --- Step 4: Verify each file in remote manifest ---
  const files = Object.entries(remoteManifest.files)
  const maxLen = Math.max(...files.map(([k]) => k.length))
  let allMatch = true

  for (const [name, info] of files) {
    try {
      const buffer = name === 'index.html' ? indexBuf : await fetch(urlForFile(name))
      const hash = sha256(buffer)
      const hashMatch = hash === info.sha256
      const sizeMatch = buffer.length === info.size

      if (hashMatch && sizeMatch) {
        console.log(`  ${name.padEnd(maxLen)}  MATCH  sha256:${hash.slice(0, 12)}...  (${buffer.length} bytes)`)
      } else {
        allMatch = false
        console.log(`  ${name.padEnd(maxLen)}  MISMATCH`)
        if (!hashMatch) {
          console.log(`    expected: sha256:${info.sha256}`)
          console.log(`    got:      sha256:${hash}`)
        }
        if (!sizeMatch) {
          console.log(`    expected size: ${info.size}, got: ${buffer.length}`)
        }
      }
    } catch (err) {
      allMatch = false
      console.log(`  ${name.padEnd(maxLen)}  ERROR  ${err.message}`)
    }
  }

  // --- Step 5: Verify SRI integrity attributes ---
  console.log(`\nVerifying SRI integrity attributes...\n`)
  let sriOk = true

  // Extract script integrity
  const scriptRe = /<script\b[^>]*\bsrc="([^"]+)"[^>]*\bintegrity="([^"]+)"[^>]*>/g
  for (const m of indexStr.matchAll(scriptRe)) {
    const src = m[1]
    const declared = m[2]
    const rel = src.replace(/^\//, '')
    try {
      const buffer = await fetch(`${SITE_URL}${src}`)
      const computed = `sha384-${sha384Base64(buffer)}`
      if (computed === declared) {
        console.log(`  ${rel.padEnd(maxLen)}  SRI OK`)
      } else {
        sriOk = false
        console.log(`  ${rel.padEnd(maxLen)}  SRI MISMATCH`)
        console.log(`    declared: ${declared}`)
        console.log(`    computed: ${computed}`)
      }
    } catch (err) {
      sriOk = false
      console.log(`  ${rel.padEnd(maxLen)}  SRI ERROR  ${err.message}`)
    }
  }

  // Extract stylesheet integrity
  const linkRe = /<link\b[^>]*\bhref="([^"]+)"[^>]*\bintegrity="([^"]+)"[^>]*>/g
  for (const m of indexStr.matchAll(linkRe)) {
    const href = m[1]
    const declared = m[2]
    const rel = href.replace(/^\//, '')
    try {
      const buffer = await fetch(`${SITE_URL}${href}`)
      const computed = `sha384-${sha384Base64(buffer)}`
      if (computed === declared) {
        console.log(`  ${rel.padEnd(maxLen)}  SRI OK`)
      } else {
        sriOk = false
        console.log(`  ${rel.padEnd(maxLen)}  SRI MISMATCH`)
        console.log(`    declared: ${declared}`)
        console.log(`    computed: ${computed}`)
      }
    } catch (err) {
      sriOk = false
      console.log(`  ${rel.padEnd(maxLen)}  SRI ERROR  ${err.message}`)
    }
  }

  // --- Summary ---
  console.log()
  if (allMatch && sriOk) {
    console.log(`All ${files.length} files match. SRI integrity verified. Deployment is consistent.`)
  } else {
    if (!allMatch) console.log('Some files do not match their manifest hashes.')
    if (!sriOk) console.log('Some SRI integrity attributes do not match.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})

const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const SITE_URL = 'https://notefade.com'
const distDir = path.resolve(__dirname, '..', 'dist')
const manifestPath = path.join(distDir, 'build-manifest.json')

if (!fs.existsSync(manifestPath)) {
  console.error('dist/build-manifest.json not found. Run `yarn build:prod` first.')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

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

async function main() {
  console.log(`Verifying ${SITE_URL} against local build (v${manifest.version}, ${manifest.commit.slice(0, 7)})...\n`)

  // Fetch index.html to discover asset URLs
  const indexHtml = await fetch(`${SITE_URL}/`)
  const indexHtmlStr = indexHtml.toString('utf-8')

  // Extract script src and link href from HTML
  const assetUrls = new Set()
  const scriptMatches = indexHtmlStr.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)
  for (const m of scriptMatches) assetUrls.add(m[1])
  const linkMatches = indexHtmlStr.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*rel="stylesheet"[^>]*>/g)
  for (const m of linkMatches) assetUrls.add(m[1])
  // Also match rel before href
  const linkMatches2 = indexHtmlStr.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)
  for (const m of linkMatches2) assetUrls.add(m[1])

  // Build file list: index.html + discovered assets
  const filesToCheck = [
    { rel: 'index.html', url: `${SITE_URL}/`, buffer: indexHtml },
  ]
  for (const assetUrl of assetUrls) {
    const rel = assetUrl.replace(/^\//, '')
    filesToCheck.push({ rel, url: `${SITE_URL}${assetUrl}` })
  }

  let allMatch = true
  const maxNameLen = Math.max(...filesToCheck.map((f) => f.rel.length))

  for (const file of filesToCheck) {
    const expected = manifest.files[file.rel]
    if (!expected) {
      console.log(`  ${file.rel.padEnd(maxNameLen)}  SKIP   (not in manifest)`)
      continue
    }

    const buffer = file.buffer || (await fetch(file.url))
    const hash = sha256(buffer)
    const match = hash === expected.sha256

    if (match) {
      console.log(`  ${file.rel.padEnd(maxNameLen)}  MATCH  sha256:${hash.slice(0, 12)}...`)
    } else {
      console.log(`  ${file.rel.padEnd(maxNameLen)}  MISMATCH`)
      console.log(`    local:  sha256:${expected.sha256}`)
      console.log(`    remote: sha256:${hash}`)
      allMatch = false
    }
  }

  console.log()
  if (allMatch) {
    console.log('All files match.')
  } else {
    console.log('Some files do not match. Build may differ from deployed version.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})

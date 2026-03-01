const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const distDir = path.resolve(__dirname, '..', 'dist')
const htmlPath = path.join(distDir, 'index.html')

if (!fs.existsSync(htmlPath)) {
  console.error('dist/index.html not found. Run `vite build` first.')
  process.exit(1)
}

function sha384(filePath) {
  const content = fs.readFileSync(filePath)
  const hash = crypto.createHash('sha384').update(content).digest('base64')
  return `sha384-${hash}`
}

let html = fs.readFileSync(htmlPath, 'utf-8')
let count = 0

// Inject integrity into <script> tags with src
html = html.replace(
  /<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/g,
  (match, before, src, after) => {
    if (match.includes('integrity=')) return match
    const filePath = path.join(distDir, src.replace(/^\//, ''))
    if (!fs.existsSync(filePath)) {
      console.warn(`  Skipping ${src} (file not found)`)
      return match
    }
    const integrity = sha384(filePath)
    count++
    return `<script${before}src="${src}"${after} integrity="${integrity}"></script>`
  }
)

// Inject integrity into <link rel="stylesheet"> tags with href
html = html.replace(
  /<link\b([^>]*)\bhref="([^"]+)"([^>]*)\/?>/g,
  (match, before, href, after) => {
    if (!match.includes('rel="stylesheet"')) return match
    if (match.includes('integrity=')) return match
    const filePath = path.join(distDir, href.replace(/^\//, ''))
    if (!fs.existsSync(filePath)) {
      console.warn(`  Skipping ${href} (file not found)`)
      return match
    }
    const integrity = sha384(filePath)
    count++
    // Preserve self-closing if present
    const closing = match.endsWith('/>') ? '/>' : '>'
    return `<link${before}href="${href}"${after} integrity="${integrity}"${closing}`
  }
)

fs.writeFileSync(htmlPath, html)
console.log(`SRI injected: ${count} tags updated`)

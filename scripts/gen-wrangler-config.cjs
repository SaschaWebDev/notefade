const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const templatePath = path.join(root, 'wrangler.template.toml')
const outPath = path.join(root, 'wrangler.toml')
const envPath = path.join(root, '.env')

// Load .env file into process.env (no dependencies)
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const template = fs.readFileSync(templatePath, 'utf-8')

const result = template.replace(/\$\{(\w+)\}/g, (match, name) => {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing env var: ${name}`)
    process.exit(1)
  }
  return value
})

fs.writeFileSync(outPath, result)
console.log('Generated wrangler.toml from template')

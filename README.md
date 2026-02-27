# notefade

**Private notes that fade.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/) [![Zero Crypto Dependencies](https://img.shields.io/badge/crypto_deps-zero-green.svg)](#security-model) [![Cloudflare Workers](https://img.shields.io/badge/backend-Cloudflare_Workers-orange.svg)](https://workers.cloudflare.com/)

<!-- Add a screenshot or animated gif here -->

---

Self-destructing secret notes with zero-knowledge encryption. Create an encrypted note, get a one-time link, share it — the note is gone after a single read. The server never sees your content. Not even once.

Notefade splits your encryption key so the server stores only 16 meaningless bytes. Everything else lives in the URL fragment, which browsers never send to the server. No accounts. No cookies. No tracking. Just end-to-end encrypted, one-time-read secret sharing that you can self-host anywhere.

## Features

- **AES-256-GCM encryption** — Web Crypto API only, zero external crypto dependencies
- **XOR key splitting** — server stores just 16 bytes; meaningless without the URL half
- **URL fragment architecture** — `#fragment` is never sent to the server, by design
- **One-time read** — shard is deleted the moment it's served
- **Auto-expiring links** — 1 hour, 24 hours, or 7 days
- **Password protection** — optional PBKDF2 layer (600k iterations, SHA-256)
- **QR code sharing** — generate and export as PNG
- **7 backend adapters** — Cloudflare KV, Cloudflare D1, Upstash Redis, Vercel KV, Supabase, AWS DynamoDB, or your own API
- **Self-hostable** — frontend and backend, no vendor lock-in
- **No accounts, no cookies, no tracking** — anonymous by default
- **Open source** — MIT licensed

## How It Works

1. You write a note
2. The client encrypts it with AES-256-GCM (Web Crypto API)
3. The 32-byte encryption key is split via XOR into two shares
4. A 16-byte shard goes to the server (stored in KV with a TTL)
5. Everything else goes into the URL fragment: `notefade.com/#<id>:<payload>`
6. The recipient opens the link → client fetches the shard → server deletes it → client reconstructs the key → decrypts → done

```
URL fragment (#) — never sent to server:
  ├─ shard ID           → tells server which shard to fetch
  ├─ integrity check    → FNV-1a hash for tamper detection
  ├─ XOR share (48 B)   → meaningless without the server shard
  ├─ IV (12 B)          → safe to be public
  └─ ciphertext         → the encrypted note

Server KV:
  └─ 16 bytes           → deleted after first read or TTL expiry
```

The server never has enough information to decrypt anything. Even if it's compromised, seized, or subpoenaed — there's nothing useful to hand over.

## Security Model

Notefade is designed so the server is never trusted with secrets.

**What the architecture protects against:**

- Server compromise — the shard alone can't decrypt anything
- Data breaches — no content is ever stored server-side
- Subpoenas / legal requests — there's nothing meaningful to produce
- Network surveillance — the URL fragment never leaves the browser
- Link reuse — the shard is deleted after a single read

**What it does not protect against:**

- Screenshots or copy-paste by the recipient
- Compromised devices (keyloggers, screen capture malware)
- A recipient intentionally saving the content

We're honest about this. Once someone reads a note, they have the plaintext. Notefade ensures only _one_ person reads it, and that the server is never in a position to.

**Security headers:** `no-referrer` policy, `no-store` cache headers, HTTPS-only in production, origin-locked CORS.

For a full technical breakdown, see [notefade.com/docs](https://notefade.com/docs).

## Self-Hosting

### Frontend

```bash
yarn build
```

Serve the `dist/` directory from any static host — Cloudflare Pages, Vercel, Netlify, Nginx, or a simple file server.

### Backend

The default backend is a Cloudflare Worker with KV storage. Deploy your own:

```bash
yarn worker:deploy
```

Or use any of the 7 supported shard storage providers:

| Provider            | Type       | Notes                                             |
| ------------------- | ---------- | ------------------------------------------------- |
| **Cloudflare KV**   | `cf-kv`    | Default. Native TTL support.                      |
| **Cloudflare D1**   | `cf-d1`    | SQL-based alternative.                            |
| **Upstash Redis**   | `upstash`  | REST API, serverless Redis.                       |
| **Vercel KV**       | `vercel`   | Backed by Upstash.                                |
| **Supabase**        | `supabase` | Postgres-backed.                                  |
| **AWS DynamoDB**    | `dynamodb` | Via API Gateway.                                  |
| **Self-hosted API** | `self`     | Any server implementing the ShardStore interface. |

### ShardStore Interface

Implement this interface and you can use any storage backend:

```typescript
interface ShardStore {
  put(id: string, shard: string, ttl: number): Promise<void>;
  get(id: string): Promise<string | null>; // fetch and delete
  exists(id: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}
```

The `get` method must delete the shard after returning it (one-time read semantics).

When someone opens a note stored on a non-default server, notefade displays which provider holds the shard so users know what they're trusting.

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn

### Development

```bash
# Clone the repo
git clone https://github.com/notefade/notefade.git
cd notefade

# Install dependencies
yarn install

# Start the dev server (frontend)
yarn dev

# Start the worker (backend, separate terminal)
yarn worker:dev
```

The dev server proxies `/shard` requests to the local worker on port 8787.

### Build & Test

```bash
# Type-check and build
yarn build

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch
```

### Deploy

```bash
# Deploy frontend to Cloudflare Pages
yarn deploy

# Deploy worker
yarn worker:deploy
```

## Tech Stack

| Layer      | Technology                                 |
| ---------- | ------------------------------------------ |
| Frontend   | React 19, TypeScript (strict), CSS Modules |
| Build      | Vite 6                                     |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2, XOR)  |
| Backend    | Cloudflare Workers + KV                    |
| Validation | Zod                                        |
| Testing    | Vitest                                     |
| QR Codes   | qrcode-generator                           |

## Project Structure

```
src/
├── api/              # Shard API client & 7 backend adapters
│   └── adapters/     # cloudflare-kv, d1, upstash, supabase, dynamodb, self-hosted
├── components/       # React UI (CreateNote, ReadNote, NoteLink, QrCode, ...)
│   └── docs/         # Documentation pages
├── crypto/           # AES-256-GCM encryption, XOR key splitting, PBKDF2
├── hooks/            # useCreateNote, useReadNote, useHashRoute, ...
└── styles/           # CSS variables & animations

worker/
└── index.ts          # Cloudflare Worker (shard CRUD + rate limiting)
```

## API

Four endpoints. That's the entire backend.

| Method   | Endpoint     | Description                     |
| -------- | ------------ | ------------------------------- |
| `POST`   | `/shard`     | Store a shard (returns ID)      |
| `HEAD`   | `/shard/:id` | Check if a shard exists         |
| `GET`    | `/shard/:id` | Fetch and delete a shard        |
| `DELETE` | `/shard/:id` | Destroy a shard without reading |

Rate limited per IP. Max request body: 1 KB. Full API docs at [notefade.com/docs](https://notefade.com/docs).

## License

MIT — Sascha Majewsky

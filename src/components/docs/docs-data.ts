export interface EndpointParam {
  name: string
  location: 'path' | 'body'
  type: string
  required: boolean
  description: string
  pattern?: string
}

export interface EndpointResponse {
  status: number
  description: string
  body?: string
}

export interface EndpointDef {
  method: 'GET' | 'POST' | 'HEAD' | 'DELETE'
  path: string
  summary: string
  description: string
  params: EndpointParam[]
  responses: EndpointResponse[]
  exampleRequest?: string
  exampleResponse?: string
}

export interface RateLimit {
  method: string
  limit: number
  window: string
}

export interface TocGroup {
  label: string
  items: TocItem[]
}

export interface TocItem {
  id: string
  label: string
}

export const TOC_GROUPS: TocGroup[] = [
  {
    label: 'Concepts',
    items: [
      { id: 'encryption', label: 'AES-256 Encrypted' },
      { id: 'zero-knowledge', label: 'Zero Knowledge' },
      { id: 'one-time-read', label: 'One-Time Read' },
      { id: 'auto-expiring', label: 'Auto-Expiring' },
      { id: 'fade-after-reading', label: 'Fade After Reading' },
      { id: 'time-lock', label: 'Time-Lock' },
      { id: 'deferred-activation', label: 'Deferred Activation' },
      { id: 'steganography', label: 'Steganography' },
      { id: 'proof-of-read', label: 'Proof of Read' },
      { id: 'decoy-links', label: 'Decoy Links' },
      { id: 'no-tracking', label: 'No Tracking' },
      { id: 'open-source', label: 'Open Source' },
      { id: 'no-accounts', label: 'No Accounts' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { id: 'api', label: 'API Reference' },
      { id: 'self-hosting', label: 'Self-Hosting' },
      { id: 'verifying-builds', label: 'Verifying Builds' },
    ],
  },
]

export const CORS_ORIGINS = [
  'https://notefade.com',
  'https://www.notefade.com',
  'http://localhost:*',
  'http://127.0.0.1:*',
]

export const RATE_LIMITS: RateLimit[] = [
  { method: 'POST', limit: 20, window: '60s' },
  { method: 'HEAD', limit: 30, window: '60s' },
  { method: 'GET', limit: 15, window: '60s' },
  { method: 'DELETE', limit: 10, window: '60s' },
]

export const ENDPOINTS: EndpointDef[] = [
  {
    method: 'POST',
    path: '/shard',
    summary: 'Store a shard',
    description:
      'Stores a 16-byte key shard with a TTL. Returns a unique shard ID (16 hex characters). The shard is automatically deleted after the TTL expires or after it is read once via GET.',
    params: [
      {
        name: 'shard',
        location: 'body',
        type: 'string',
        required: true,
        description: 'Base64url-encoded 16-byte key shard',
        pattern: '^[A-Za-z0-9_-]{20,24}$',
      },
      {
        name: 'ttl',
        location: 'body',
        type: 'number',
        required: true,
        description: 'Time-to-live in seconds',
        pattern: '3600 | 86400 | 604800',
      },
    ],
    responses: [
      { status: 201, description: 'Shard stored', body: '{ "id": "a1b2c3d4e5f67890" }' },
      { status: 400, description: 'Invalid JSON or failed schema validation' },
      { status: 413, description: 'Request body exceeds 1 KB' },
      { status: 429, description: 'Rate limit exceeded' },
    ],
    exampleRequest: `POST /shard HTTP/1.1
Content-Type: application/json

{
  "shard": "dGhpcyBpcyBhIDE2Ynl0ZQ",
  "ttl": 86400
}`,
    exampleResponse: `HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "a1b2c3d4e5f67890"
}`,
  },
  {
    method: 'HEAD',
    path: '/shard/:id',
    summary: 'Check if a shard exists',
    description:
      'Non-destructive existence check. Returns 200 if the shard exists, 404 if not. Does not consume or delete the shard. Useful for verifying a note link is still valid before the recipient opens it.',
    params: [
      {
        name: 'id',
        location: 'path',
        type: 'string',
        required: true,
        description: 'Shard ID (8-16 lowercase hex characters)',
        pattern: '^[a-f0-9]{8,16}$',
      },
    ],
    responses: [
      { status: 200, description: 'Shard exists' },
      { status: 400, description: 'Invalid shard ID format' },
      { status: 404, description: 'Shard not found or expired' },
      { status: 429, description: 'Rate limit exceeded' },
    ],
    exampleRequest: `HEAD /shard/a1b2c3d4e5f67890 HTTP/1.1`,
    exampleResponse: `HTTP/1.1 200 OK`,
  },
  {
    method: 'GET',
    path: '/shard/:id',
    summary: 'Fetch and delete a shard',
    description:
      'Retrieves the shard value and immediately deletes it from storage. This is the one-time read mechanism \u2014 subsequent requests for the same ID will return 404. The delete is eventually consistent across Cloudflare edge nodes (typically < 60s).',
    params: [
      {
        name: 'id',
        location: 'path',
        type: 'string',
        required: true,
        description: 'Shard ID (8-16 lowercase hex characters)',
        pattern: '^[a-f0-9]{8,16}$',
      },
    ],
    responses: [
      {
        status: 200,
        description: 'Shard returned and deleted',
        body: '{ "shard": "dGhpcyBpcyBhIDE2Ynl0ZQ" }',
      },
      { status: 400, description: 'Invalid shard ID format' },
      { status: 404, description: 'Shard not found, already read, or expired' },
      { status: 429, description: 'Rate limit exceeded' },
    ],
    exampleRequest: `GET /shard/a1b2c3d4e5f67890 HTTP/1.1`,
    exampleResponse: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "shard": "dGhpcyBpcyBhIDE2Ynl0ZQ"
}`,
  },
  {
    method: 'DELETE',
    path: '/shard/:id',
    summary: 'Destroy a shard without reading',
    description:
      'Deletes a shard without returning its value. Used by note creators to destroy an unread note (the "Destroy now" feature). Returns 404 if the shard was already consumed or expired. Note: this endpoint is unauthenticated \u2014 anyone with the shard ID (visible in the note URL) can delete the shard. This is an accepted tradeoff: the URL is the access credential by design, and anyone who can DELETE can also GET (consuming the shard). DELETE only changes the type of interference (denial-of-service vs. reading), not the access boundary.',
    params: [
      {
        name: 'id',
        location: 'path',
        type: 'string',
        required: true,
        description: 'Shard ID (8-16 lowercase hex characters)',
        pattern: '^[a-f0-9]{8,16}$',
      },
    ],
    responses: [
      { status: 200, description: 'Shard destroyed', body: '{ "deleted": true }' },
      { status: 400, description: 'Invalid shard ID format' },
      { status: 404, description: 'Shard not found, already read, or expired' },
      { status: 429, description: 'Rate limit exceeded' },
    ],
    exampleRequest: `DELETE /shard/a1b2c3d4e5f67890 HTTP/1.1`,
    exampleResponse: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "deleted": true
}`,
  },
  {
    method: 'POST',
    path: '/shard/defer',
    summary: 'Create a defer token (dead drop)',
    description:
      'Encrypts the shard data into a server-signed token without storing anything. The shard is only written to storage when the token is later activated via POST /shard/activate. Requires DEFER_SECRET to be configured on the server.',
    params: [
      {
        name: 'shard',
        location: 'body',
        type: 'string',
        required: true,
        description: 'Base64url-encoded 16-byte key shard',
        pattern: '^[A-Za-z0-9_-]{20,24}$',
      },
      {
        name: 'ttl',
        location: 'body',
        type: 'number',
        required: true,
        description: 'Time-to-live in seconds (applied when activated)',
        pattern: '3600 | 86400 | 604800',
      },
    ],
    responses: [
      { status: 201, description: 'Defer token created', body: '{ "token": "...", "id": "a1b2c3d4e5f67890" }' },
      { status: 400, description: 'Invalid JSON or failed schema validation' },
      { status: 413, description: 'Request body exceeds 1 KB' },
      { status: 429, description: 'Rate limit exceeded' },
      { status: 501, description: 'DEFER_SECRET not configured on server' },
    ],
    exampleRequest: `POST /shard/defer HTTP/1.1
Content-Type: application/json

{
  "shard": "dGhpcyBpcyBhIDE2Ynl0ZQ",
  "ttl": 86400
}`,
    exampleResponse: `HTTP/1.1 201 Created
Content-Type: application/json

{
  "token": "eyJpZCI6ImExYjJjM2Q0ZTVm...",
  "id": "a1b2c3d4e5f67890"
}`,
  },
  {
    method: 'POST',
    path: '/shard/activate',
    summary: 'Activate a deferred note',
    description:
      'Decrypts a defer token and stores the shard. The TTL countdown begins at activation, not at token creation. Tokens must be activated within 30 days of creation or they expire (HTTP 410). Requires DEFER_SECRET to be configured on the server.',
    params: [
      {
        name: 'token',
        location: 'body',
        type: 'string',
        required: true,
        description: 'Opaque defer token from POST /shard/defer',
      },
    ],
    responses: [
      { status: 201, description: 'Shard activated and stored', body: '{ "id": "a1b2c3d4e5f67890" }' },
      { status: 400, description: 'Invalid, tampered, or malformed token' },
      { status: 410, description: 'Token invalid or expired (older than 30 days, or already activated)' },
      { status: 413, description: 'Request body exceeds 1 KB' },
      { status: 429, description: 'Rate limit exceeded' },
      { status: 501, description: 'DEFER_SECRET not configured on server' },
    ],
    exampleRequest: `POST /shard/activate HTTP/1.1
Content-Type: application/json

{
  "token": "eyJpZCI6ImExYjJjM2Q0ZTVm..."
}`,
    exampleResponse: `HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "a1b2c3d4e5f67890"
}`,
  },
]

export const SHARD_STORE_INTERFACE = `export interface ShardStore {
  /** Store a shard with the given ID and TTL (seconds) */
  put(id: string, shard: string, ttl: number): Promise<void>
  /** Fetch a shard by ID and delete it (one-time read). Returns null if not found. */
  get(id: string): Promise<string | null>
  /** Check whether a shard exists without consuming it */
  exists(id: string): Promise<boolean>
  /** Delete a shard by ID without reading it. Returns true if it existed. */
  delete(id: string): Promise<boolean>
}`

export const METHOD_COLORS: Record<string, string> = {
  GET: '#34d399',
  POST: '#60a5fa',
  DELETE: '#f87171',
  HEAD: '#a78bfa',
}

/** Generate a client-side shard ID: 8 random bytes → 16 hex chars */
export function generateShardId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let hex = ''
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

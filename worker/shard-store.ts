/** Abstract shard storage interface — enables BYOS (Bring Your Own Server) in v2 */
export interface ShardStore {
  /** Store a shard with the given ID and TTL (seconds) */
  put(id: string, shard: string, ttl: number): Promise<void>
  /** Fetch a shard by ID and delete it (one-time read). Returns null if not found. */
  get(id: string): Promise<string | null>
  /** Check whether a shard exists without consuming it */
  exists(id: string): Promise<boolean>
  /** Delete a shard by ID without reading it. Returns true if it existed. */
  delete(id: string): Promise<boolean>
}

/** Cloudflare KV implementation of ShardStore */
export class CloudflareKVShardStore implements ShardStore {
  constructor(private readonly kv: KVNamespace) {}

  async put(id: string, shard: string, ttl: number): Promise<void> {
    await this.kv.put(id, shard, { expirationTtl: ttl })
  }

  async get(id: string): Promise<string | null> {
    const shard = await this.kv.get(id)
    if (shard === null) {
      return null
    }
    // Delete immediately after serving (one-time read)
    await this.kv.delete(id)
    return shard
  }

  async exists(id: string): Promise<boolean> {
    const shard = await this.kv.get(id)
    return shard !== null
  }

  async delete(id: string): Promise<boolean> {
    const exists = await this.kv.get(id)
    if (exists === null) return false
    await this.kv.delete(id)
    return true
  }
}

/** In-memory implementation for testing */
export class InMemoryShardStore implements ShardStore {
  private readonly store = new Map<string, string>()

  async put(id: string, shard: string, _ttl: number): Promise<void> {
    this.store.set(id, shard)
  }

  async get(id: string): Promise<string | null> {
    const shard = this.store.get(id) ?? null
    if (shard !== null) {
      this.store.delete(id)
    }
    return shard
  }

  async exists(id: string): Promise<boolean> {
    return this.store.has(id)
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}

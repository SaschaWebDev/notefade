import type { ProviderAdapter, SelfHostedConfig } from '../provider-types'
import { storeShard, checkShard, fetchShard, deleteShard } from '../shard-api'

export function createSelfHostedAdapter(config: SelfHostedConfig): ProviderAdapter {
  return {
    store(shard, ttl) {
      return storeShard(shard, ttl, config.u)
    },
    check(id) {
      return checkShard(id, config.u)
    },
    fetch(id) {
      return fetchShard(id, config.u)
    },
    delete(id) {
      return deleteShard(id, config.u)
    },
  }
}

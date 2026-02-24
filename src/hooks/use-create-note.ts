import { useState } from 'react'
import { createNote, computeCheck, protectFragment } from '@/crypto'
import { storeShard, createAdapter, encodeProviderConfig } from '@/api'
import type { ProviderConfig, ProviderType } from '@/api/provider-types'

const MAX_CHARS = 1800
const PROVIDER_STORAGE_KEY = 'notefade-provider'
const LEGACY_API_URL_KEY = 'notefade-api-url'

const TTL_OPTIONS = [
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
  { label: '7d', value: 604800 },
] as const

export type TTLOption = (typeof TTL_OPTIONS)[number]

function loadProviderConfig(): ProviderConfig | null {
  // Try new storage key first
  const stored = localStorage.getItem(PROVIDER_STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as ProviderConfig
    } catch {
      localStorage.removeItem(PROVIDER_STORAGE_KEY)
    }
  }

  // Migrate from legacy api-url key
  const legacyUrl = localStorage.getItem(LEGACY_API_URL_KEY)
  if (legacyUrl) {
    localStorage.removeItem(LEGACY_API_URL_KEY)
    const config: ProviderConfig = { t: 'self', u: legacyUrl }
    localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(config))
    return config
  }

  return null
}

interface UseCreateNoteReturn {
  message: string
  setMessage: (msg: string) => void
  ttl: number
  setTtl: (ttl: number) => void
  noteUrl: string | null
  shardId: string | null
  expiresAt: number
  loading: boolean
  error: string | null
  isOverLimit: boolean
  isEmpty: boolean
  maxChars: number
  ttlOptions: readonly TTLOption[]
  providerConfig: ProviderConfig | null
  setProviderConfig: (config: ProviderConfig | null) => void
  resetProvider: () => void
  isCustomServer: boolean
  providerType: ProviderType | null
  setProviderType: (type: ProviderType) => void
  password: string
  setPassword: (pw: string) => void
  passwordEnabled: boolean
  setPasswordEnabled: (enabled: boolean) => void
  handleCreate: () => Promise<void>
  resetNote: () => void
}

export function useCreateNote(): UseCreateNoteReturn {
  const [message, setMessage] = useState('')
  const [ttl, setTtl] = useState(86400)
  const [noteUrl, setNoteUrl] = useState<string | null>(null)
  const [shardId, setShardId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerConfig, setProviderConfigState] = useState<ProviderConfig | null>(
    loadProviderConfig,
  )
  const [password, setPasswordState] = useState('')
  const [passwordEnabled, setPasswordEnabledState] = useState(false)

  const isOverLimit = message.length > MAX_CHARS
  const isEmpty = message.trim().length === 0
  const isCustomServer = providerConfig !== null
  const providerType = providerConfig?.t ?? null

  const setProviderConfig = (config: ProviderConfig | null) => {
    setProviderConfigState(config)
    if (config) {
      localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(config))
    } else {
      localStorage.removeItem(PROVIDER_STORAGE_KEY)
    }
  }

  const resetProvider = () => {
    setProviderConfigState(null)
    localStorage.removeItem(PROVIDER_STORAGE_KEY)
  }

  const setPassword = (pw: string) => {
    setPasswordState(pw)
  }

  const setPasswordEnabled = (enabled: boolean) => {
    setPasswordEnabledState(enabled)
    if (!enabled) {
      setPasswordState('')
    }
  }

  const setProviderType = (type: ProviderType) => {
    // When switching provider type, preserve any fields that share the same keys
    // but create a fresh config for the new type
    const current = providerConfig
    let newConfig: ProviderConfig

    switch (type) {
      case 'self':
        newConfig = { t: 'self', u: (current && 'u' in current ? current.u : '') }
        break
      case 'cf-kv':
        newConfig = {
          t: 'cf-kv',
          a: current && 'a' in current ? current.a : '',
          n: current && 'n' in current ? current.n : '',
          k: current && 'k' in current ? current.k : '',
        }
        break
      case 'cf-d1':
        newConfig = {
          t: 'cf-d1',
          a: current && 'a' in current ? current.a : '',
          d: current && 'd' in current ? current.d : '',
          k: current && 'k' in current ? current.k : '',
        }
        break
      case 'upstash':
        newConfig = {
          t: 'upstash',
          u: current && 'u' in current ? current.u : '',
          k: current && 'k' in current ? current.k : '',
        }
        break
      case 'vercel':
        newConfig = {
          t: 'vercel',
          u: current && 'u' in current ? current.u : '',
          k: current && 'k' in current ? current.k : '',
        }
        break
      case 'supabase':
        newConfig = {
          t: 'supabase',
          u: current && 'u' in current ? current.u : '',
          k: current && 'k' in current ? current.k : '',
        }
        break
      case 'dynamodb':
        newConfig = {
          t: 'dynamodb',
          u: current && 'u' in current ? current.u : '',
          k: current && 'k' in current ? current.k : '',
        }
        break
    }

    setProviderConfig(newConfig)
  }

  const handleCreate = async () => {
    if (isEmpty || isOverLimit || loading) return

    setLoading(true)
    setError(null)

    try {
      const { urlPayload, serverShard } = await createNote(message)

      let id: string
      if (providerConfig) {
        const adapter = createAdapter(providerConfig)
        id = await adapter.store(serverShard, ttl)
      } else {
        id = await storeShard(serverShard, ttl)
      }
      setShardId(id)

      const pathname = window.location.pathname
      const check = computeCheck(urlPayload)
      const configSuffix = providerConfig ? `@${encodeProviderConfig(providerConfig)}` : ''
      const innerFragment = `${id}:${check}:${urlPayload}${configSuffix}`

      let finalFragment: string
      if (passwordEnabled && password.length > 0) {
        const protectedData = await protectFragment(innerFragment, password)
        finalFragment = `protected:${protectedData}`
      } else {
        finalFragment = innerFragment
      }

      const url = `${window.location.origin}${pathname}#${finalFragment}`
      setExpiresAt(Date.now() + ttl * 1000)
      setNoteUrl(url)
      setMessage('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const resetNote = () => {
    setNoteUrl(null)
    setShardId(null)
    setError(null)
    setPasswordState('')
    setPasswordEnabledState(false)
  }

  return {
    message,
    setMessage,
    ttl,
    setTtl,
    noteUrl,
    shardId,
    expiresAt,
    loading,
    error,
    isOverLimit,
    isEmpty,
    maxChars: MAX_CHARS,
    ttlOptions: TTL_OPTIONS,
    providerConfig,
    setProviderConfig,
    resetProvider,
    isCustomServer,
    providerType,
    setProviderType,
    password,
    setPassword,
    passwordEnabled,
    setPasswordEnabled,
    handleCreate,
    resetNote,
  }
}

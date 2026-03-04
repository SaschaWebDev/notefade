import { useState } from 'react'
import { createNote, computeCheck, protectFragment, padPayload, embedTimeLock, generateReceiptSeed } from '@/crypto'
import type { NoteMetadata } from '@/crypto'
import { storeShard, deferShard, createAdapter, encodeProviderConfig } from '@/api'
import type { ProviderConfig, ProviderType } from '@/api/provider-types'

const MAX_CHARS = 1800
const PROVIDER_STORAGE_KEY = 'notefade-provider'
const LEGACY_API_URL_KEY = 'notefade-api-url'
const MAX_READ_COUNT = 10

const TTL_OPTIONS = [
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
  { label: '7d', value: 604800 },
] as const

const BAR_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '15m', value: 900 },
] as const

export type TTLOption = (typeof TTL_OPTIONS)[number]
export type BAROption = (typeof BAR_OPTIONS)[number]

/** Launch code for deferred (dead drop) activation */
export interface LaunchCode {
  token: string    // opaque server-encrypted token
  fragment: string // client-side URL fragment
}

/** Verification file for proof of read */
export interface ReceiptVerification {
  plaintext: string
  receiptSeed: string
}

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
  compactUrl: string | null
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
  // Feature 1: Multi-read
  readCount: number
  setReadCount: (n: number) => void
  maxReadCount: number
  // Feature 3: Burn-after-reading
  barDuration: number
  setBarDuration: (seconds: number) => void
  barOptions: readonly BAROption[]
  // Feature 4: Time-lock
  timeLockEnabled: boolean
  setTimeLockEnabled: (enabled: boolean) => void
  timeLockAt: string
  setTimeLockAt: (isoString: string) => void
  // Feature 5: Dead drop / deferred activation
  deferredMode: boolean
  setDeferredMode: (enabled: boolean) => void
  launchCode: LaunchCode | null
  // Feature 6: Proof of read
  receiptEnabled: boolean
  setReceiptEnabled: (enabled: boolean) => void
  receiptVerification: ReceiptVerification | null
  // Feature 8: Decoy links
  decoyMessages: string[]
  setDecoyMessages: (msgs: string[] | ((prev: string[]) => string[])) => void
  decoyUrls: string[]
  handleCreate: () => Promise<void>
  resetNote: () => void
  resetExpertSettings: () => void
}

export function useCreateNote(): UseCreateNoteReturn {
  const [message, setMessage] = useState('')
  const [ttl, setTtl] = useState(86400)
  const [noteUrl, setNoteUrl] = useState<string | null>(null)
  const [compactUrl, setCompactUrl] = useState<string | null>(null)
  const [shardId, setShardId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerConfig, setProviderConfigState] = useState<ProviderConfig | null>(
    loadProviderConfig,
  )
  const [password, setPasswordState] = useState('')
  const [passwordEnabled, setPasswordEnabledState] = useState(false)

  // Feature 1: Multi-read
  const [readCount, setReadCount] = useState(1)
  // Feature 3: Burn-after-reading
  const [barDuration, setBarDuration] = useState(300)
  // Feature 4: Time-lock
  const [timeLockEnabled, setTimeLockEnabled] = useState(false)
  const [timeLockAt, setTimeLockAt] = useState('')
  // Feature 5: Deferred activation
  const [deferredMode, setDeferredMode] = useState(false)
  const [launchCode, setLaunchCode] = useState<LaunchCode | null>(null)
  // Feature 6: Proof of read
  const [receiptEnabled, setReceiptEnabled] = useState(false)
  const [receiptVerification, setReceiptVerification] = useState<ReceiptVerification | null>(null)
  // Feature 8: Decoy links
  const [decoyMessages, setDecoyMessages] = useState<string[]>([])
  const [decoyUrls, setDecoyUrls] = useState<string[]>([])

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

  /** Build a full note URL from components */
  const buildNoteUrl = async (
    msg: string,
    metadata: NoteMetadata,
    shardCount: number,
  ): Promise<{
    noteUrl: string
    compactUrl: string | null
    primaryShardId: string
    launchCode: LaunchCode | null
  }> => {
    const { urlPayload, serverShard } = await createNote(msg, metadata)
    const pathname = window.location.pathname
    const configSuffix = providerConfig ? `@${encodeProviderConfig(providerConfig)}` : ''

    // Store shards (N copies for multi-read)
    const ids: string[] = []

    if (deferredMode) {
      // Deferred activation: server generates ID + encrypted token, doesn't store yet
      // For `self` provider, use custom API URL; default API otherwise
      const deferBase = providerConfig?.t === 'self' ? providerConfig.u : undefined
      const { token, id: serverId } = await deferShard(serverShard, ttl, deferBase)
      ids.push(serverId)

      // Build the full fragment so the note URL can be shared immediately
      // (it just won't work until the launch code is activated)
      const check = computeCheck(urlPayload)
      let paddedUrlPayload = padPayload(urlPayload)
      if (timeLockEnabled && timeLockAt) {
        const tsEpoch = Math.floor(new Date(timeLockAt).getTime() / 1000)
        paddedUrlPayload = embedTimeLock(paddedUrlPayload, check, tsEpoch)
      }
      const paddedFragment = `${serverId}:${check}:${paddedUrlPayload}${configSuffix}`

      let finalFragment: string
      if (passwordEnabled && password.length > 0) {
        const protectedData = await protectFragment(paddedFragment, password)
        finalFragment = `protected:${protectedData}`
      } else {
        finalFragment = paddedFragment
      }

      const lc: LaunchCode = { token, fragment: finalFragment }
      setLaunchCode(lc)

      const url = `${window.location.origin}${pathname}#${finalFragment}`
      return {
        noteUrl: url,
        compactUrl: null,
        primaryShardId: serverId,
        launchCode: lc,
      }
    }

    for (let i = 0; i < shardCount; i++) {
      let id: string
      if (providerConfig) {
        const adapter = createAdapter(providerConfig)
        id = await adapter.store(serverShard, ttl)
      } else {
        id = await storeShard(serverShard, ttl)
      }
      ids.push(id)
    }

    const shardIdStr = ids.join('~')
    const check = computeCheck(urlPayload)

    // Time-lock prefix (compact/QR only — padded URLs use steganographic embedding)
    const tlPrefix = timeLockEnabled && timeLockAt
      ? `tl:${Math.floor(new Date(timeLockAt).getTime() / 1000)}:`
      : ''

    // Build compact fragment (variable-length, for QR codes) — keeps tl: prefix
    const compactFragment = `${tlPrefix}${shardIdStr}:${check}:${urlPayload}${configSuffix}`

    // Build padded fragment (fixed-length, for copy/share) — stego embedding, no tl: prefix
    let paddedUrlPayload = padPayload(urlPayload)
    if (timeLockEnabled && timeLockAt) {
      const tsEpoch = Math.floor(new Date(timeLockAt).getTime() / 1000)
      paddedUrlPayload = embedTimeLock(paddedUrlPayload, check, tsEpoch)
    }
    const paddedFragment = `${shardIdStr}:${check}:${paddedUrlPayload}${configSuffix}`

    let finalFragment: string
    let compact: string | null = null
    if (passwordEnabled && password.length > 0) {
      const protectedData = await protectFragment(paddedFragment, password)
      finalFragment = `protected:${protectedData}`
    } else {
      finalFragment = paddedFragment
      compact = `${window.location.origin}${pathname}#${compactFragment}`
    }

    const url = `${window.location.origin}${pathname}#${finalFragment}`
    return { noteUrl: url, compactUrl: compact, primaryShardId: ids[0]!, launchCode: null }
  }

  const handleCreate = async () => {
    if (isEmpty || isOverLimit || loading) return

    setLoading(true)
    setError(null)

    try {
      // Build metadata
      const metadata: NoteMetadata = {}
      if (barDuration > 0) {
        metadata.barSeconds = barDuration
      }
      let receiptSeed: string | undefined
      if (receiptEnabled) {
        receiptSeed = generateReceiptSeed()
        metadata.receiptSeed = receiptSeed
      }

      const result = await buildNoteUrl(message, metadata, readCount)

      if (deferredMode) {
        // For deferred mode, show the URL (inert until activated) + launch code
        setShardId(result.primaryShardId)
        setExpiresAt(0) // TTL starts on activation
        setNoteUrl(result.noteUrl)
        setCompactUrl(null)
      } else {
        setShardId(result.primaryShardId)
        setExpiresAt(Date.now() + ttl * 1000)
        setNoteUrl(result.noteUrl)
        setCompactUrl(result.compactUrl)
      }

      // Generate receipt verification file
      if (receiptEnabled && receiptSeed) {
        setReceiptVerification({ plaintext: message, receiptSeed })
      }

      // Generate decoy links (Feature 8)
      if (decoyMessages.length > 0) {
        const dUrls: string[] = []
        for (const decoyMsg of decoyMessages) {
          if (!decoyMsg.trim()) continue
          const decoyResult = await buildNoteUrl(decoyMsg, {}, 1)
          if (decoyResult.noteUrl) {
            dUrls.push(decoyResult.noteUrl)
          }
        }
        setDecoyUrls(dUrls)
      }

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

  const resetExpertSettings = () => {
    setReadCount(1)
    setBarDuration(300)
    setTimeLockEnabled(false)
    setTimeLockAt('')
    setDeferredMode(false)
    setReceiptEnabled(false)
    setDecoyMessages([])
    setPasswordEnabledState(false)
    setPasswordState('')
  }

  const resetNote = () => {
    setMessage('')
    setTtl(86400)
    setNoteUrl(null)
    setCompactUrl(null)
    setShardId(null)
    setError(null)
    setPasswordState('')
    setPasswordEnabledState(false)
    setReadCount(1)
    setBarDuration(300)
    setTimeLockEnabled(false)
    setTimeLockAt('')
    setDeferredMode(false)
    setLaunchCode(null)
    setReceiptEnabled(false)
    setReceiptVerification(null)
    setDecoyMessages([])
    setDecoyUrls([])
  }

  return {
    message,
    setMessage,
    ttl,
    setTtl,
    noteUrl,
    compactUrl,
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
    readCount,
    setReadCount,
    maxReadCount: MAX_READ_COUNT,
    barDuration,
    setBarDuration,
    barOptions: BAR_OPTIONS,
    timeLockEnabled,
    setTimeLockEnabled,
    timeLockAt,
    setTimeLockAt,
    deferredMode,
    setDeferredMode,
    launchCode,
    receiptEnabled,
    setReceiptEnabled,
    receiptVerification,
    decoyMessages,
    setDecoyMessages,
    decoyUrls,
    handleCreate,
    resetNote,
    resetExpertSettings,
  }
}

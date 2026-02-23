import { useState } from 'react'
import { createNote, computeCheck, stringToBase64Url } from '@/crypto'
import { storeShard } from '@/api'

const MAX_CHARS = 1800
const API_URL_STORAGE_KEY = 'notefade-api-url'

const TTL_OPTIONS = [
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
  { label: '7d', value: 604800 },
] as const

export type TTLOption = (typeof TTL_OPTIONS)[number]

interface UseCreateNoteReturn {
  message: string
  setMessage: (msg: string) => void
  ttl: number
  setTtl: (ttl: number) => void
  noteUrl: string | null
  loading: boolean
  error: string | null
  isOverLimit: boolean
  isEmpty: boolean
  maxChars: number
  ttlOptions: readonly TTLOption[]
  apiUrl: string
  setApiUrl: (url: string) => void
  resetApiUrl: () => void
  isCustomServer: boolean
  handleCreate: () => Promise<void>
  resetNote: () => void
}

export function useCreateNote(): UseCreateNoteReturn {
  const [message, setMessage] = useState('')
  const [ttl, setTtl] = useState(86400)
  const [noteUrl, setNoteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiUrl, setApiUrlState] = useState(
    () => localStorage.getItem(API_URL_STORAGE_KEY) ?? '',
  )

  const isOverLimit = message.length > MAX_CHARS
  const isEmpty = message.trim().length === 0
  const isCustomServer = apiUrl.length > 0

  const setApiUrl = (url: string) => {
    setApiUrlState(url)
    if (url) {
      localStorage.setItem(API_URL_STORAGE_KEY, url)
    } else {
      localStorage.removeItem(API_URL_STORAGE_KEY)
    }
  }

  const resetApiUrl = () => {
    setApiUrlState('')
    localStorage.removeItem(API_URL_STORAGE_KEY)
  }

  const handleCreate = async () => {
    if (isEmpty || isOverLimit || loading) return

    setLoading(true)
    setError(null)

    try {
      const { urlPayload, serverShard } = await createNote(message)
      const id = await storeShard(serverShard, ttl, isCustomServer ? apiUrl : undefined)
      const pathname = window.location.pathname
      const check = computeCheck(urlPayload)
      const apiSuffix = isCustomServer ? `@${stringToBase64Url(apiUrl)}` : ''
      const url = `${window.location.origin}${pathname}#${id}:${check}:${urlPayload}${apiSuffix}`
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
    setError(null)
  }

  return {
    message,
    setMessage,
    ttl,
    setTtl,
    noteUrl,
    loading,
    error,
    isOverLimit,
    isEmpty,
    maxChars: MAX_CHARS,
    ttlOptions: TTL_OPTIONS,
    apiUrl,
    setApiUrl,
    resetApiUrl,
    isCustomServer,
    handleCreate,
    resetNote,
  }
}

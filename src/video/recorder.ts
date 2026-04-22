import { useCallback, useEffect, useRef, useState } from 'react'
import {
  VIDEO_MAX_DURATION_MS,
  VIDEO_TARGET_BITRATE,
  VIDEO_MIME_CODES,
  type VideoMimeCode,
} from '@/constants'

export type VideoRecorderState = 'idle' | 'recording' | 'stopped' | 'error'

export type VideoRecorderErrorCode =
  | 'permission'
  | 'no-device'
  | 'busy'
  | 'unsupported'
  | 'unknown'

export interface VideoRecorderError {
  code: VideoRecorderErrorCode
  message: string
}

export interface RecordedVideoClip {
  blob: Blob
  mimeCode: VideoMimeCode
  durationMs: number
  streamUrl: string
}

export function getSupportedVideoMime(): VideoMimeCode | null {
  if (typeof MediaRecorder === 'undefined') return null
  const codes = Object.keys(VIDEO_MIME_CODES) as VideoMimeCode[]
  for (const code of codes) {
    if (MediaRecorder.isTypeSupported(VIDEO_MIME_CODES[code])) return code
  }
  return null
}

export function isVideoRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    getSupportedVideoMime() !== null
  )
}

export interface UseVideoRecorderReturn {
  state: VideoRecorderState
  error: VideoRecorderError | null
  durationMs: number
  clip: RecordedVideoClip | null
  livePreviewStream: MediaStream | null
  start: () => Promise<void>
  stop: () => Promise<void>
  discard: () => void
}

export function useVideoRecorder(): UseVideoRecorderReturn {
  const [state, setState] = useState<VideoRecorderState>('idle')
  const [error, setError] = useState<VideoRecorderError | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [clip, setClip] = useState<RecordedVideoClip | null>(null)
  const [livePreviewStream, setLivePreviewStream] = useState<MediaStream | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const stopTimerRef = useRef<number | null>(null)
  const tickIntervalRef = useRef<number | null>(null)
  const stopResolveRef = useRef<(() => void) | null>(null)

  const tearDown = useCallback(() => {
    if (stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (tickIntervalRef.current !== null) {
      clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    setLivePreviewStream(null)
  }, [])

  useEffect(() => tearDown, [tearDown])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    await new Promise<void>((resolve) => {
      stopResolveRef.current = resolve
      try {
        recorder.stop()
      } catch {
        resolve()
      }
    })
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setClip(null)
    setDurationMs(0)

    const mimeCode = getSupportedVideoMime()
    if (!mimeCode) {
      setError({ code: 'unsupported', message: 'video recording is not supported in this browser' })
      setState('error')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 12, max: 15 },
          facingMode: 'user',
        },
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (e) {
      const err = e as DOMException
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        setError({ code: 'permission', message: 'camera access was denied. check your browser site permissions.' })
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        setError({ code: 'no-device', message: 'no camera detected.' })
      } else if (err.name === 'NotReadableError') {
        setError({ code: 'busy', message: 'the camera is in use by another app.' })
      } else {
        setError({ code: 'unknown', message: err.message || 'unable to access camera' })
      }
      setState('error')
      return
    }

    streamRef.current = stream
    setLivePreviewStream(stream)
    const mime = VIDEO_MIME_CODES[mimeCode]
    chunksRef.current = []

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: VIDEO_TARGET_BITRATE,
        audioBitsPerSecond: 12_000,
      })
    } catch {
      tearDown()
      setError({ code: 'unsupported', message: 'video encoding failed to initialize' })
      setState('error')
      return
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime })
      const durMs = Date.now() - startTimeRef.current
      setClip({
        blob,
        mimeCode,
        durationMs: durMs,
        streamUrl: URL.createObjectURL(blob),
      })
      setDurationMs(durMs)
      setState('stopped')
      tearDown()
      if (stopResolveRef.current) {
        stopResolveRef.current()
        stopResolveRef.current = null
      }
    }
    recorderRef.current = recorder

    startTimeRef.current = Date.now()
    recorder.start(500)
    setState('recording')

    tickIntervalRef.current = window.setInterval(() => {
      setDurationMs(Date.now() - startTimeRef.current)
    }, 100)

    stopTimerRef.current = window.setTimeout(() => {
      void stop()
    }, VIDEO_MAX_DURATION_MS)
  }, [stop, tearDown])

  const discard = useCallback(() => {
    tearDown()
    chunksRef.current = []
    recorderRef.current = null
    if (clip?.streamUrl) URL.revokeObjectURL(clip.streamUrl)
    setClip(null)
    setState('idle')
    setDurationMs(0)
    setError(null)
  }, [clip, tearDown])

  return { state, error, durationMs, clip, livePreviewStream, start, stop, discard }
}

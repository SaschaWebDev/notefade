import { useCallback, useEffect, useRef, useState } from 'react'
import {
  VOICE_MAX_DURATION_MS,
  VOICE_TARGET_BITRATE,
  VOICE_MIME_CODES,
  type VoiceMimeCode,
} from '@/constants'

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'error'

export type RecorderErrorCode =
  | 'permission'
  | 'no-device'
  | 'busy'
  | 'unsupported'
  | 'unknown'

export interface RecorderError {
  code: RecorderErrorCode
  message: string
}

export interface RecordedClip {
  blob: Blob
  mimeCode: VoiceMimeCode
  durationMs: number
}

export function getSupportedVoiceMime(): VoiceMimeCode | null {
  if (typeof MediaRecorder === 'undefined') return null
  const codes = Object.keys(VOICE_MIME_CODES) as VoiceMimeCode[]
  for (const code of codes) {
    if (MediaRecorder.isTypeSupported(VOICE_MIME_CODES[code])) return code
  }
  return null
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    getSupportedVoiceMime() !== null
  )
}

/** Number of spectrum bars exposed to consumers (A/B meter comparison). */
export const SPECTRUM_BAR_COUNT = 32

export interface UseAudioRecorderReturn {
  state: RecorderState
  error: RecorderError | null
  durationMs: number
  amplitude: number
  /** Normalized (0..1) voice-band spectrum, `SPECTRUM_BAR_COUNT` entries. */
  spectrum: number[]
  clip: RecordedClip | null
  start: () => Promise<void>
  stop: () => Promise<void>
  discard: () => void
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<RecorderError | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [amplitude, setAmplitude] = useState(0)
  const [spectrum, setSpectrum] = useState<number[]>(() =>
    new Array(SPECTRUM_BAR_COUNT).fill(0),
  )
  const [clip, setClip] = useState<RecordedClip | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const stopResolveRef = useRef<(() => void) | null>(null)

  const tearDown = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    analyserRef.current = null
  }, [])

  useEffect(() => tearDown, [tearDown])

  const pumpAmplitude = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    // Time-domain RMS for overall amplitude.
    const timeBuf = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(timeBuf)
    let sumSq = 0
    for (let i = 0; i < timeBuf.length; i++) {
      const v = (timeBuf[i]! - 128) / 128
      sumSq += v * v
    }
    const rms = Math.sqrt(sumSq / timeBuf.length)
    setAmplitude(Math.min(1, rms * 2.2))

    // Frequency-domain data downsampled to SPECTRUM_BAR_COUNT bars
    // focused on voice band (~80 Hz – 3 kHz).
    const freqBuf = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(freqBuf)
    const startBin = 3
    const endBin = Math.min(analyser.frequencyBinCount - 1, 192)
    const binsPerBar = (endBin - startBin) / SPECTRUM_BAR_COUNT
    const next = new Array<number>(SPECTRUM_BAR_COUNT)
    for (let i = 0; i < SPECTRUM_BAR_COUNT; i++) {
      const from = Math.floor(startBin + i * binsPerBar)
      const to = Math.max(from + 1, Math.floor(startBin + (i + 1) * binsPerBar))
      let sum = 0
      for (let j = from; j < to; j++) sum += freqBuf[j] ?? 0
      next[i] = sum / (to - from) / 255
    }
    setSpectrum(next)

    setDurationMs(Date.now() - startTimeRef.current)
    rafRef.current = requestAnimationFrame(pumpAmplitude)
  }, [])

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
    setAmplitude(0)

    const mimeCode = getSupportedVoiceMime()
    if (!mimeCode) {
      setError({ code: 'unsupported', message: 'voice recording not supported in this browser' })
      setState('error')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
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
        setError({ code: 'permission', message: 'microphone access was denied. check your browser site permissions.' })
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        setError({ code: 'no-device', message: 'no microphone detected.' })
      } else if (err.name === 'NotReadableError') {
        setError({ code: 'busy', message: 'the microphone is in use by another app.' })
      } else {
        setError({ code: 'unknown', message: err.message || 'unable to access microphone' })
      }
      setState('error')
      return
    }

    streamRef.current = stream
    const mime = VOICE_MIME_CODES[mimeCode]
    chunksRef.current = []

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: VOICE_TARGET_BITRATE,
      })
    } catch {
      tearDown()
      setError({ code: 'unsupported', message: 'audio recording failed to initialize' })
      setState('error')
      return
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime })
      const durMs = Date.now() - startTimeRef.current
      setClip({ blob, mimeCode, durationMs: durMs })
      setDurationMs(durMs)
      setState('stopped')
      tearDown()
      if (stopResolveRef.current) {
        stopResolveRef.current()
        stopResolveRef.current = null
      }
    }
    recorderRef.current = recorder

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
      }
    } catch {
      // analyser is cosmetic; recording continues without it
    }

    startTimeRef.current = Date.now()
    recorder.start(250)
    setState('recording')
    rafRef.current = requestAnimationFrame(pumpAmplitude)

    stopTimerRef.current = window.setTimeout(() => {
      void stop()
    }, VOICE_MAX_DURATION_MS)
  }, [pumpAmplitude, stop, tearDown])

  const discard = useCallback(() => {
    tearDown()
    chunksRef.current = []
    recorderRef.current = null
    setClip(null)
    setState('idle')
    setDurationMs(0)
    setAmplitude(0)
    setError(null)
  }, [tearDown])

  return { state, error, durationMs, amplitude, spectrum, clip, start, stop, discard }
}

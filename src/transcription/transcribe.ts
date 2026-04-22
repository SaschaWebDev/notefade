/**
 * On-device audio transcription using Whisper via @xenova/transformers.
 *
 * Runs entirely in-browser — the multilingual model is downloaded once
 * from HuggingFace CDN (~150 MB for whisper-tiny, cached by the browser's
 * HTTP cache), then inference happens locally. No audio bytes leave the
 * device. Supports English and German (the multilingual tiny model covers
 * 99 languages total; we surface only these two in the UI for now).
 *
 * Usage is recipient-only: sender records audio, recipient optionally
 * triggers transcription on playback. Keeps the sender's ciphertext budget
 * untouched and avoids shipping the model to every visitor.
 */

import type { Pipeline } from '@xenova/transformers'

const MODEL = 'Xenova/whisper-tiny'
const TARGET_SAMPLE_RATE = 16_000

export type TranscribeLanguage = 'english' | 'german'

export interface TranscribeProgress {
  phase: 'download' | 'decode' | 'transcribe' | 'done'
  /** 0..1 for download phase; undefined otherwise */
  progress?: number
}

export type TranscribeProgressCallback = (p: TranscribeProgress) => void

let pipelinePromise: Promise<Pipeline> | null = null

/**
 * Lazy-load the ASR pipeline. First call downloads the model (~150 MB),
 * subsequent calls reuse the cached pipeline regardless of target language —
 * the multilingual model handles language switching per call via options.
 */
async function getPipeline(onProgress?: TranscribeProgressCallback): Promise<Pipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      // Dynamic import so the library is only loaded when transcription is used.
      const { pipeline, env } = await import('@xenova/transformers')
      // Allow remote model downloads; cache in browser storage.
      env.allowLocalModels = false
      env.allowRemoteModels = true
      return pipeline('automatic-speech-recognition', MODEL, {
        progress_callback: (data: { status: string; progress?: number }) => {
          if (onProgress && (data.status === 'downloading' || data.status === 'progress')) {
            onProgress({ phase: 'download', progress: (data.progress ?? 0) / 100 })
          }
        },
      })
    })()
  }
  return pipelinePromise
}

/** Decode an audio Blob to a mono Float32Array at 16 kHz (Whisper's expected format). */
async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) throw new Error('AudioContext is not supported in this browser')

  // Decode at the clip's native sample rate, then resample.
  const decodeCtx = new AudioCtx()
  const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer)
  await decodeCtx.close()

  if (audioBuffer.sampleRate === TARGET_SAMPLE_RATE && audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0).slice()
  }

  // Resample via OfflineAudioContext.
  const durationSec = audioBuffer.duration
  const targetLen = Math.max(1, Math.ceil(durationSec * TARGET_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, targetLen, TARGET_SAMPLE_RATE)
  const src = offline.createBufferSource()
  src.buffer = audioBuffer
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0).slice()
}

export interface TranscribeResult {
  text: string
}

export interface TranscribeOptions {
  /** Spoken language in the clip. Default: 'english'. */
  language?: TranscribeLanguage
}

export async function transcribeBlob(
  blob: Blob,
  onProgress?: TranscribeProgressCallback,
  options: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const language = options.language ?? 'english'

  onProgress?.({ phase: 'download' })
  const asr = await getPipeline(onProgress)

  onProgress?.({ phase: 'decode' })
  const samples = await decodeToMono16k(blob)

  onProgress?.({ phase: 'transcribe' })
  const output = (await asr(samples, {
    language,
    task: 'transcribe',
    // Chunk long audio. For <=30s clips this is irrelevant but harmless.
    chunk_length_s: 30,
    stride_length_s: 5,
  })) as { text: string } | { text: string }[]

  const text = Array.isArray(output) ? output.map((o) => o.text).join(' ') : output.text
  onProgress?.({ phase: 'done' })
  return { text: text.trim() }
}

/** Whether the browser environment can run transcription at all. */
export function isTranscriptionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.AudioContext !== 'undefined' &&
    typeof window.OfflineAudioContext !== 'undefined'
  )
}

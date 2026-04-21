/**
 * Extract a normalized peak-per-bar waveform from an audio Blob.
 * Uses AudioContext.decodeAudioData, so supported formats match what the
 * browser can natively decode (Opus-in-webm on Chrome/Firefox; AAC/mp4 on Safari).
 *
 * Ported from the yapgone sister project — same 40-bar resolution, same
 * normalization to max peak, same silent-fallback shape.
 */
export const WAVEFORM_BAR_COUNT = 40

export async function computeWaveform(blob: Blob): Promise<number[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return fallbackWaveform()

    const audioCtx = new AudioCtx()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const data = audioBuffer.getChannelData(0)
    const step = Math.max(1, Math.floor(data.length / WAVEFORM_BAR_COUNT))
    const peaks: number[] = []
    for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
      let max = 0
      for (let j = 0; j < step; j++) {
        const v = Math.abs(data[i * step + j] ?? 0)
        if (v > max) max = v
      }
      peaks.push(max)
    }
    const maxPeak = Math.max(...peaks, 0.01)
    await audioCtx.close()
    return peaks.map((p) => p / maxPeak)
  } catch {
    return fallbackWaveform()
  }
}

function fallbackWaveform(): number[] {
  // Mid-height bars so the UI still shows something if decoding fails.
  return Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.5)
}

/**
 * Web Audio sound synthesizers for Dojo Store and Chest Opening.
 * Zero asset downloads, instant playback, zero network footprint.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      audioCtx = new AudioCtx()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

export function playChestOpen(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  // Wooden creak + golden burst chime
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25] // C major / pentatonic
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now + idx * 0.06)

    gain.gain.setValueAtTime(0.001, now + idx * 0.06)
    gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.06 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.8)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now + idx * 0.06)
    osc.stop(now + idx * 0.06 + 0.85)
  })
}

export function playCardFlip(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  // Short tactile snap
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, now)
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.05)

  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.07)
}

export function playPowerReveal(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  // Resonant mystical chime with bell overtone
  const freqs = [392.00, 587.33, 783.99, 1174.66]
  freqs.forEach((f) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(f, now)

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 1.9)
  })
}

export function playCandySpend(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(659.25, now) // E5
  osc.frequency.setValueAtTime(880.00, now + 0.08) // A5

  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.26)
}

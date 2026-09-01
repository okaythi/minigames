import { SFX, type SfxName, type Voice } from './sfx'

/**
 * Web Audio scheduler. Nothing is created until the first gesture (autoplay
 * policies), and a single short noise buffer is reused for every transient.
 */

const MASTER_GAIN = 0.85
const NOISE_SECONDS = 0.4

export interface AudioDeps {
  readonly onMutedChange?: (muted: boolean) => void
}

export class AudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private muted = false
  private started = false

  public constructor(private readonly deps: AudioDeps = {}) {}

  public get isMuted(): boolean {
    return this.muted
  }

  /** Call from a user gesture; safe to call repeatedly. */
  public unlock(): void {
    const context = this.ensureContext()
    if (context !== null && context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }
    this.started = true
  }

  public setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master !== null && this.context !== null) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, this.context.currentTime, 0.02)
    }
    this.deps.onMutedChange?.(muted)
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  public play(name: SfxName): void {
    if (this.muted || !this.started) {
      return
    }
    const context = this.ensureContext()
    const master = this.master
    if (context === null || master === null) {
      return
    }
    const design = SFX[name]
    const now = context.currentTime
    for (const voice of design.voices) {
      this.voice(context, master, voice, now + voice.delay)
    }
    if (design.sub !== undefined) {
      this.voice(context, master, design.sub, now + design.sub.delay)
    }
    if (design.noise !== undefined) {
      this.noise(context, master, design.noise, now + design.noise.delay)
    }
  }

  public dispose(): void {
    if (this.context !== null && this.context.state !== 'closed') {
      void this.context.close().catch(() => undefined)
    }
    this.context = null
    this.master = null
    this.noiseBuffer = null
  }

  private ensureContext(): AudioContext | null {
    if (this.context !== null) {
      return this.context
    }
    const Ctor: typeof AudioContext | undefined = window.AudioContext
    if (Ctor === undefined) {
      return null
    }
    try {
      const context = new Ctor()
      const compressor = context.createDynamicsCompressor()
      compressor.threshold.value = -14
      compressor.knee.value = 12
      compressor.ratio.value = 8
      compressor.attack.value = 0.003
      compressor.release.value = 0.14
      const master = context.createGain()
      master.gain.value = this.muted ? 0 : MASTER_GAIN
      master.connect(compressor)
      compressor.connect(context.destination)
      this.context = context
      this.master = master
      return context
    } catch {
      return null
    }
  }

  private voice(context: AudioContext, destination: AudioNode, voice: Voice, at: number): void {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = voice.kind
    oscillator.frequency.setValueAtTime(voice.from, at)
    if (voice.curve === 'lin') {
      oscillator.frequency.linearRampToValueAtTime(voice.to, at + voice.duration)
    } else {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, voice.to), at + voice.duration)
    }
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(voice.gain, at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + voice.duration)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(at)
    oscillator.stop(at + voice.duration + 0.02)
  }

  private noise(
    context: AudioContext,
    destination: AudioNode,
    hit: { duration: number; gain: number; filterFrom: number; filterTo: number; delay: number },
    at: number,
  ): void {
    const buffer = this.ensureNoiseBuffer(context)
    if (buffer === null) {
      return
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.9
    filter.frequency.setValueAtTime(hit.filterFrom, at)
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, hit.filterTo), at + hit.duration)
    const gain = context.createGain()
    gain.gain.setValueAtTime(hit.gain, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + hit.duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(destination)
    source.start(at)
    source.stop(at + hit.duration + 0.02)
  }

  private ensureNoiseBuffer(context: AudioContext): AudioBuffer | null {
    if (this.noiseBuffer !== null) {
      return this.noiseBuffer
    }
    const length = Math.floor(context.sampleRate * NOISE_SECONDS)
    try {
      const buffer = context.createBuffer(1, length, context.sampleRate)
      const channel = buffer.getChannelData(0)
      for (let index = 0; index < length; index += 1) {
        // White noise with a linear fade so the buffer never clicks at the end.
        const fade = 1 - index / length
        channel[index] = (Math.random() * 2 - 1) * fade
      }
      this.noiseBuffer = buffer
      return buffer
    } catch {
      return null
    }
  }

  public get running(): boolean {
    return this.context !== null && this.context.state === 'running'
  }
}

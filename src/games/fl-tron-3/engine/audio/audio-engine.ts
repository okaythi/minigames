import { TRON_SFX, type TronSfxName } from './sfx'
import {
  AudioEngine as BaseAudioEngine,
  type AudioDeps,
  type IAudioEngine,
} from '../../../../lib/audio-engine'

export type { AudioDeps, IAudioEngine }

export class TronAudioEngine extends BaseAudioEngine<TronSfxName> {
  private humContext: AudioContext | null = null
  private humGain: GainNode | null = null
  private humOsc1: OscillatorNode | null = null
  private humOsc2: OscillatorNode | null = null
  private humFilter: BiquadFilterNode | null = null
  private isHumming = false

  public constructor(deps: AudioDeps = {}) {
    super(TRON_SFX, deps)
  }

  public startBikeHum(): void {
    if (this.isHumming) return
    this.unlock()
    this.ensureHumNodes()
    if (!this.humGain || !this.humContext) return

    const now = this.humContext.currentTime
    const targetGain = this.isMuted ? 0 : 0.045
    this.humGain.gain.cancelScheduledValues(now)
    this.humGain.gain.setValueAtTime(this.humGain.gain.value, now)
    this.humGain.gain.linearRampToValueAtTime(targetGain, now + 0.15)
    this.isHumming = true
  }

  public stopBikeHum(): void {
    if (!this.isHumming || !this.humGain || !this.humContext) return
    const now = this.humContext.currentTime
    this.humGain.gain.cancelScheduledValues(now)
    this.humGain.gain.setValueAtTime(this.humGain.gain.value, now)
    this.humGain.gain.linearRampToValueAtTime(0, now + 0.1)
    this.isHumming = false
  }

  public updateBikeHumSpeed(hasActiveTurbo: boolean): void {
    if (!this.isHumming || !this.humContext || !this.humOsc1 || !this.humOsc2 || !this.humFilter || !this.humGain) {
      return
    }
    const now = this.humContext.currentTime
    const baseFreq = hasActiveTurbo ? 118 : 74
    const harmonicFreq = hasActiveTurbo ? 236 : 148
    const filterFreq = hasActiveTurbo ? 850 : 380
    const targetGain = this.isMuted ? 0 : hasActiveTurbo ? 0.075 : 0.045

    this.humOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06)
    this.humOsc2.frequency.setTargetAtTime(harmonicFreq, now, 0.06)
    this.humFilter.frequency.setTargetAtTime(filterFreq, now, 0.08)
    this.humGain.gain.setTargetAtTime(targetGain, now, 0.05)
  }

  public override setMuted(muted: boolean): void {
    super.setMuted(muted)
    if (this.humGain && this.humContext) {
      const now = this.humContext.currentTime
      this.humGain.gain.setTargetAtTime(muted || !this.isHumming ? 0 : 0.045, now, 0.03)
    }
  }

  public override dispose(): void {
    super.dispose()
    this.stopBikeHum()
    if (this.humOsc1) {
      try {
        this.humOsc1.stop()
        this.humOsc1.disconnect()
      } catch {
        // ignore
      }
      this.humOsc1 = null
    }
    if (this.humOsc2) {
      try {
        this.humOsc2.stop()
        this.humOsc2.disconnect()
      } catch {
        // ignore
      }
      this.humOsc2 = null
    }
    if (this.humFilter) {
      this.humFilter.disconnect()
      this.humFilter = null
    }
    if (this.humGain) {
      this.humGain.disconnect()
      this.humGain = null
    }
    if (this.humContext && this.humContext.state !== 'closed') {
      void this.humContext.close().catch(() => undefined)
      this.humContext = null
    }
  }

  private ensureHumNodes(): void {
    if (this.humContext !== null) return
    const Ctor: typeof AudioContext | undefined = window.AudioContext
    if (!Ctor) return

    try {
      const ctx = new Ctor()
      const masterGain = ctx.createGain()
      masterGain.gain.value = 0

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      filter.Q.value = 2.5

      const osc1 = ctx.createOscillator()
      osc1.type = 'sawtooth'
      osc1.frequency.value = 74

      const osc2 = ctx.createOscillator()
      osc2.type = 'triangle'
      osc2.frequency.value = 148

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(masterGain)
      masterGain.connect(ctx.destination)

      osc1.start()
      osc2.start()

      this.humContext = ctx
      this.humGain = masterGain
      this.humFilter = filter
      this.humOsc1 = osc1
      this.humOsc2 = osc2
    } catch {
      // Audio context creation failed
    }
  }
}

/**
 * Sound design as data. Every effect is a handful of oscillator "voices" plus
 * an optional filtered noise burst, which means the game ships with zero audio
 * assets and no decode step.
 */

export type SfxName = 'flap' | 'bounce' | 'candy' | 'death' | 'start' | 'ui' | 'dissolve'

export interface Voice {
  readonly kind: OscillatorType
  /** Frequency at note start, Hz. */
  readonly from: number
  /** Frequency the voice slides to. */
  readonly to: number
  readonly delay: number
  readonly duration: number
  readonly gain: number
  readonly curve?: 'exp' | 'lin'
}

export interface NoiseHit {
  readonly delay: number
  readonly duration: number
  readonly gain: number
  readonly filterFrom: number
  readonly filterTo: number
}

export interface SoundDesign {
  readonly voices: readonly Voice[]
  readonly noise?: NoiseHit
  /** Sub-audible thump that you feel through a laptop. */
  readonly sub?: Voice
}

export const SFX: Readonly<Record<SfxName, SoundDesign>> = {
  flap: {
    voices: [{ kind: 'triangle', from: 380, to: 720, delay: 0, duration: 0.09, gain: 0.07 }],
  },
  /** The "pop": a fast pitch drop on a sine plus a click of noise. */
  bounce: {
    voices: [
      { kind: 'sine', from: 460, to: 120, delay: 0, duration: 0.13, gain: 0.26 },
      { kind: 'square', from: 900, to: 420, delay: 0, duration: 0.045, gain: 0.05 },
    ],
    noise: { delay: 0, duration: 0.05, gain: 0.12, filterFrom: 2600, filterTo: 900 },
    sub: { kind: 'sine', from: 120, to: 52, delay: 0, duration: 0.16, gain: 0.14 },
  },
  candy: {
    voices: [
      { kind: 'triangle', from: 880, to: 990, delay: 0, duration: 0.08, gain: 0.1 },
      { kind: 'triangle', from: 1320, to: 1480, delay: 0.06, duration: 0.1, gain: 0.08 },
    ],
    noise: { delay: 0, duration: 0.05, gain: 0.05, filterFrom: 6000, filterTo: 3200 },
  },
  death: {
    voices: [
      { kind: 'sawtooth', from: 320, to: 60, delay: 0, duration: 0.42, gain: 0.2, curve: 'exp' },
      { kind: 'square', from: 180, to: 48, delay: 0.02, duration: 0.3, gain: 0.07 },
    ],
    noise: { delay: 0, duration: 0.3, gain: 0.16, filterFrom: 1800, filterTo: 180 },
    sub: { kind: 'sine', from: 90, to: 38, delay: 0, duration: 0.5, gain: 0.16 },
  },
  start: {
    voices: [
      { kind: 'triangle', from: 520, to: 660, delay: 0, duration: 0.08, gain: 0.08 },
      { kind: 'triangle', from: 780, to: 990, delay: 0.07, duration: 0.11, gain: 0.08 },
    ],
  },
  ui: {
    voices: [{ kind: 'sine', from: 620, to: 520, delay: 0, duration: 0.05, gain: 0.05 }],
  },
  dissolve: {
    voices: [
      { kind: 'sine', from: 320, to: 160, delay: 0, duration: 0.12, gain: 0.04, curve: 'exp' },
    ],
    noise: { delay: 0, duration: 0.08, gain: 0.03, filterFrom: 1800, filterTo: 400 },
  },
}

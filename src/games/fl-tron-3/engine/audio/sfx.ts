import type { SfxCatalog } from '../../../../lib/audio-engine'

export type TronSfxName =
  | 'crash'
  | 'turbo'
  | 'turn'
  | 'countdown'
  | 'round_win'
  | 'round_loss'
  | 'level_clear'
  | 'ui'

export const TRON_SFX: SfxCatalog<TronSfxName> = {
  crash: {
    voices: [
      { kind: 'sawtooth', from: 240, to: 40, delay: 0, duration: 0.55, gain: 0.28, curve: 'exp' },
      { kind: 'square', from: 160, to: 30, delay: 0.02, duration: 0.4, gain: 0.15, curve: 'exp' },
    ],
    noise: { delay: 0, duration: 0.45, gain: 0.24, filterFrom: 3200, filterTo: 140 },
    sub: { kind: 'sine', from: 110, to: 32, delay: 0, duration: 0.65, gain: 0.22 },
  },
  turbo: {
    voices: [
      { kind: 'sawtooth', from: 320, to: 1450, delay: 0, duration: 0.28, gain: 0.12, curve: 'exp' },
      { kind: 'triangle', from: 640, to: 2200, delay: 0.04, duration: 0.24, gain: 0.09, curve: 'exp' },
    ],
    noise: { delay: 0, duration: 0.2, gain: 0.08, filterFrom: 4500, filterTo: 1800 },
  },
  turn: {
    voices: [{ kind: 'sine', from: 780, to: 520, delay: 0, duration: 0.035, gain: 0.04 }],
  },
  countdown: {
    voices: [{ kind: 'triangle', from: 880, to: 880, delay: 0, duration: 0.08, gain: 0.09 }],
  },
  round_win: {
    voices: [
      { kind: 'triangle', from: 523.25, to: 659.25, delay: 0, duration: 0.12, gain: 0.12 },
      { kind: 'triangle', from: 659.25, to: 783.99, delay: 0.09, duration: 0.14, gain: 0.13 },
      { kind: 'triangle', from: 783.99, to: 1046.5, delay: 0.18, duration: 0.25, gain: 0.14 },
    ],
  },
  round_loss: {
    voices: [
      { kind: 'sawtooth', from: 440, to: 330, delay: 0, duration: 0.16, gain: 0.12 },
      { kind: 'sawtooth', from: 330, to: 220, delay: 0.12, duration: 0.28, gain: 0.14 },
    ],
    sub: { kind: 'sine', from: 90, to: 45, delay: 0.1, duration: 0.35, gain: 0.16 },
  },
  level_clear: {
    voices: [
      { kind: 'triangle', from: 440, to: 554.37, delay: 0, duration: 0.12, gain: 0.12 },
      { kind: 'triangle', from: 554.37, to: 659.25, delay: 0.1, duration: 0.14, gain: 0.13 },
      { kind: 'triangle', from: 659.25, to: 880, delay: 0.2, duration: 0.35, gain: 0.15 },
    ],
  },
  ui: {
    voices: [{ kind: 'sine', from: 600, to: 480, delay: 0, duration: 0.04, gain: 0.05 }],
  },
}

export type Temperature = number // 0.0–1.0, one decimal; enforce via clampTemperature()

export interface PolicyParams {
  readonly precision: number      // softmax β over utilities; Infinity = argmax (ε tie-break)
  readonly horizon: 0 | 1 | 2 | 3 // expectimax plies beyond current clash
  readonly modelStrength: number  // 0–1 weight of rational-opponent overlay
  readonly powerAwareness: 0 | 1 | 2 // 0: ignore powers, 1: 1-step static, 2: full search advance
}

export interface BotTier {
  readonly normal: number | 'starter'
  readonly power: number | 'starter'
  readonly temperature: Temperature
  readonly policy: 'random' | PolicyParams
}

export const BOT_TIERS: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, BotTier>> = {
  1: { normal: 'starter', power: 'starter', temperature: 0.5, policy: 'random' },
  2: { normal: 30,  power: 2,   temperature: 0.5, policy: 'random' },
  3: { normal: 40,  power: 4,   temperature: 0.5, policy: { precision: 0.6, horizon: 0, modelStrength: 0,    powerAwareness: 0 } },
  4: { normal: 60,  power: 8,   temperature: 0.5, policy: { precision: 1.0, horizon: 0, modelStrength: 0.25, powerAwareness: 1 } },
  5: { normal: 90,  power: 15,  temperature: 0.5, policy: { precision: 1.5, horizon: 1, modelStrength: 0.5,  powerAwareness: 1 } },
  6: { normal: 180, power: 30,  temperature: 0.6, policy: { precision: 2.5, horizon: 1, modelStrength: 0.75, powerAwareness: 1 } },
  7: { normal: 180, power: 60,  temperature: 0.5, policy: { precision: 4.0, horizon: 2, modelStrength: 1,    powerAwareness: 2 } },
  8: { normal: 250, power: 80,  temperature: 0.5, policy: { precision: 8.0, horizon: 2, modelStrength: 1,    powerAwareness: 2 } },
  9: { normal: 320, power: 100, temperature: 0.5, policy: { precision: Infinity, horizon: 3, modelStrength: 1, powerAwareness: 2 } },
}

export const clampTemperature = (t: number): Temperature =>
  Math.round(Math.min(1, Math.max(0, t)) * 10) / 10

import { ARENA, PLAYER, SPEED } from './config'
import { clamp01, lerp } from '../../../lib/math'

/**
 * Horizontal speed growth.
 *
 * Logarithmic on purpose: the first ten bounces teach the reflex, the next
 * ninety are felt rather than noticed. `Math.log(1 + score)` grows so slowly
 * that each individual bounce adds about `base * logGain / (1 + score)` px/s.
 */
export function bounceSpeed(score: number): number {
  const target = SPEED.base * (1 + SPEED.logGain * Math.log(1 + Math.max(0, score)))
  return Math.min(target, SPEED.max)
}

/** 1.00 at the start; shown in the HUD as a "x1.18" style multiplier. */
export const speedFactor = (score: number): number => bounceSpeed(score) / SPEED.base

/** Rough crossing time used by the difficulty readout and by mover spacing. */
export const crossingSeconds = (score: number): number =>
  (ARENA.width - PLAYER.width) / bounceSpeed(score)

export type DifficultyTier = 'calm' | 'busy' | 'hairy' | 'nasty'

const TIERS: readonly { readonly tier: DifficultyTier; readonly from: number }[] = [
  { tier: 'calm', from: 0 },
  { tier: 'busy', from: 6 },
  { tier: 'hairy', from: 16 },
  { tier: 'nasty', from: 34 },
] as const

export function difficultyTier(score: number): DifficultyTier {
  let current: DifficultyTier = 'calm'
  for (const entry of TIERS) {
    if (score >= entry.from) {
      current = entry.tier
    }
  }
  return current
}

/** 0..1 ramp shared by gap sizing and spike density. */
export const pressureAt = (score: number): number => clamp01(score / 45)

export const spikeDensity = (score: number): number =>
  lerp(0.55, 0.86, Math.pow(pressureAt(score), 0.85))

export const gapCells = (score: number): number => Math.round(lerp(3, 2, pressureAt(score)))

export const maxRunCells = (score: number): number => Math.round(lerp(2, 5, pressureAt(score)))

/** Mover speed ramps the same way, so late game never feels like two systems. */
export const moverSpeed = (score: number, base: number, perScore: number, max: number): number =>
  Math.min(base + score * perScore, max)

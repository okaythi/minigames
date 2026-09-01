import type { DeathCause, RunStatus } from './engine/types'
import type { DifficultyTier } from './engine/speed-curve'

/**
 * Everything the React HUD is allowed to know. The engine pushes one of these
 * when something *changes*; it never re-renders the tree per frame.
 */
export interface AvoidSnapshot {
  readonly status: RunStatus
  readonly score: number
  readonly best: number | null
  readonly candyRun: number
  readonly candyBank: number
  readonly difficulty: DifficultyTier
  readonly speedFactor: number
  readonly moversLive: number
  readonly hazardsArmed: number
  readonly unlockedMovers: boolean
  readonly muted: boolean
  readonly lastRun: AvoidRunResult | null
}

export interface AvoidRunResult {
  readonly score: number
  readonly candy: number
  readonly seconds: number
  readonly cause: DeathCause
  readonly isRecord: boolean
  readonly beatBestBy: number | null
}

export const DEATH_COPY: Readonly<Record<DeathCause, string>> = {
  wall: 'You landed on a spike. Aim for the gap.',
  ceiling: 'The ceiling is teeth. Cap your climb.',
  floor: 'Gravity wins by default. Flap earlier.',
  mover: 'A floating spike crossed your line.',
}

export const createSnapshot = (overrides: Partial<AvoidSnapshot> = {}): AvoidSnapshot => ({
  status: 'ready',
  score: 0,
  best: null,
  candyRun: 0,
  candyBank: 0,
  difficulty: 'calm',
  speedFactor: 1,
  moversLive: 0,
  hazardsArmed: 0,
  unlockedMovers: false,
  muted: false,
  lastRun: null,
  ...overrides,
})

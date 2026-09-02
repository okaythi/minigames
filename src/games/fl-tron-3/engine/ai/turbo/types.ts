import type { Direction } from '../../types'

export interface TurboConfig {
  readonly enabled: boolean
  readonly maxTurbos: number
  readonly infiniteTurbos: boolean
  readonly activationThreshold: number
  readonly scarcityWeight: number
  readonly cutoffWeight: number
  readonly territoryWeight: number
  readonly alwaysCounterPlayerTurbo: boolean
  readonly minCooldownSeconds: number
  readonly lookaheadSteps: number
}

export interface PlayerObservation {
  readonly col: number
  readonly row: number
  readonly dir: Direction
  readonly isTurbo: boolean
  readonly timestamp: number
}

export interface PlayerTacticalMetrics {
  readonly turnCount: number
  readonly turboCount: number
  readonly straightRunRatio: number
  readonly playerAggressionScore: number
}

export interface TurboDecision {
  readonly shouldTrigger: boolean
  readonly score: number
  readonly reason: string
}

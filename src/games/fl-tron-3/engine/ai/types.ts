import type { Direction } from '../types'

export type AIIntent =
  | 'chase'
  | 'staircase'
  | 'thick_stairs'
  | 'lawnmower'
  | 'voronoi'
  | 'counter_turbo'
  | 'wander'
  | 'evade'

export interface MoveProposal {
  readonly desiredDir: Direction
  readonly wantsTurbo: boolean
  readonly intent: AIIntent
}

export interface VetoVerdict {
  readonly allowed: boolean
  readonly finalDir: Direction
  readonly finalTurbo: boolean
  readonly overrideReason?: string | undefined
}

export interface ChamberDiagnosis {
  readonly playerArea: number
  readonly aiArea: number
  readonly playerDoomed: boolean
  readonly sameChamber: boolean
}

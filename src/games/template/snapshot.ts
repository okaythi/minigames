/**
 * The only shape a game has to publish for the shared chrome to render it.
 *
 * A game is free to model whatever it likes internally; the moment it wants
 * something shown on the page it says so here, in strings and numbers. That is
 * what keeps every game page identical without the template needing to know
 * what a "mover" or a "candy" is.
 */

export type GameRunStatus = 'ready' | 'running' | 'paused' | 'over'

/** One entry in the readout panel: label, value, optional unit. */
export interface GameStatTile {
  readonly label: string
  readonly value: string
  readonly note: string
}

/** Everything the game-over card can say about the run that just ended. */
export interface GameRunSummary {
  readonly score: number
  /** Bonus pickups banked during the run (candy, coins, ...). */
  readonly bonus: number
  readonly seconds: number
  /** Headline of the game-over card: what happened and what to do next. */
  readonly note: string
  readonly isRecord: boolean
  readonly beatBestBy: number | null
}

export interface GameSnapshot {
  readonly status: GameRunStatus
  readonly score: number
  readonly best: number | null
  readonly bonus: number
  readonly tiles: readonly GameStatTile[]
  /** Small state tags under the readout: difficulty, hazards, grabs. */
  readonly badges: readonly string[]
  readonly run: GameRunSummary | null
  readonly customState?: any
  readonly muted: boolean
}

export const emptyGameSnapshot = (): GameSnapshot => ({
  status: 'ready',
  score: 0,
  best: null,
  bonus: 0,
  tiles: [],
  badges: [],
  run: null,
  muted: false,
})

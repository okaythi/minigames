import type { GameStatsView, StatsController } from '../services/stats/stats-provider'

/**
 * Rules of Hooks mean the game page has to call `useGameStats` even for an
 * unknown slug. This stands in for the real controller in that case, so nothing
 * downstream needs a null check.
 */
export const EMPTY_GAME_STATS: GameStatsView = {
  plays: 0,
  personalBest: null,
  globalRecord: null,
  candy: 0,
  completedDifficulties: [],
  distributed: false,
  synced: false,
}

const NOOP_CONTROLLER: Pick<
  StatsController,
  'view' | 'beginRun' | 'finishRun' | 'bankCandy' | 'uniquePlayers'
> = {
  view: () => EMPTY_GAME_STATS,
  beginRun: () => undefined,
  finishRun: () => undefined,
  bankCandy: () => undefined,
  uniquePlayers: 0,
}

export const emptyGameStats = (): StatsController & GameStatsView => ({
  ...NOOP_CONTROLLER,
  ...EMPTY_GAME_STATS,
})

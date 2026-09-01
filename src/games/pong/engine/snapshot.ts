import type { GameRunStatus, GameSnapshot, GameStatTile } from '../../template/snapshot'
import type { GameRuntimeDeps } from '../../template/types'
import type { PongState } from './types'

export function snapshotFor(state: PongState, deps: GameRuntimeDeps): GameSnapshot {
  let status: GameRunStatus = 'running'
  if (state.phase === 'menu') {
    status = 'ready'
  } else if (state.phase === 'loadout' || state.phase === 'config') {
    status = 'running'
  } else if (state.phase === 'over') {
    status = 'over'
  }

  const tiles: GameStatTile[] = [
    { label: 'Player', value: state.playerScore.toString(), note: '' },
    { label: 'AI', value: state.aiScore.toString(), note: '' },
  ]

  return {
    status,
    score: state.playerHits,
    best: deps.best,
    bonus: deps.bonus,
    tiles,
    badges: [`Mode: ${state.mode}`, state.difficulty],
    run:
      status === 'over'
        ? {
            score: state.playerHits,
            bonus: deps.bonus,
            seconds: 0,
            note: state.playerScore > state.aiScore ? 'You Won!' : 'You Lost!',
            isRecord: false,
            beatBestBy: null,
          }
        : null,
    muted: false,
  }
}

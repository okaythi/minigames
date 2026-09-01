import { AI_CONFIGS } from './engine/config'
import type { TronState } from './engine/types'
import type { GameRunStatus, GameRunSummary, GameSnapshot, GameStatTile } from '../template/snapshot'

export function formatRunTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds % 1) * 1000)

  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  const mss = String(ms).padStart(3, '0')

  return `${mm}:${ss}:${mss}`
}

export function formatRunTimeComponents(totalSeconds: number): { mmss: string; ms: string } {
  const mins = Math.floor(totalSeconds / 60)
  const secs = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds % 1) * 1000)

  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  const mss = String(ms).padStart(3, '0')

  return {
    mmss: `${mm}:${ss}`,
    ms: mss,
  }
}

export function toGameSnapshot(state: TronState, bestLevel: number | null, isMuted: boolean): GameSnapshot {
  let status: GameRunStatus = 'ready'
  if (state.phase === 'menu') {
    status = 'ready'
  } else if (state.phase === 'victory' || state.phase === 'game_over') {
    status = 'over'
  } else {
    status = 'running'
  }

  const aiConfig = AI_CONFIGS[state.level]
  const timeFormatted = formatRunTime(state.elapsedRunSeconds)

  const turboStatus = state.p1.isTurbo
    ? 'BOOSTING'
    : state.p1.turboCooldown > 0
      ? 'RECHARGING'
      : state.p1.turbosLeft > 0
        ? 'READY'
        : 'DEPLETED'

  const tiles: readonly GameStatTile[] = [
    {
      label: 'LEVEL',
      value: `${state.level} / 6`,
      note: aiConfig.name,
    },
    {
      label: 'MATCH SCORE',
      value: `${state.p1RoundWins} - ${state.aiRoundWins}`,
      note: 'First to 3 wins',
    },
    {
      label: 'ELAPSED TIME',
      value: timeFormatted,
      note: 'Speedrun timer',
    },
    {
      label: 'TURBOS',
      value: `${state.p1.turbosLeft} / 3`,
      note: turboStatus,
    },
  ]

  const badges: readonly string[] = [
    'Mode: Campaign',
    `Opponent: ${aiConfig.name}`,
    `Round ${state.roundNumber}`,
  ]

  let runSummary: GameRunSummary | null = null
  if (status === 'over') {
    const isWin = state.phase === 'victory'
    const note = isWin
      ? `Victory! All 6 levels cleared in ${timeFormatted}.`
      : `Eliminated on Level ${state.level} (${aiConfig.name}).`
    const isRecord = bestLevel === null || state.level > bestLevel
    const beatBestBy = isRecord && bestLevel !== null ? state.level - bestLevel : null

    runSummary = {
      score: state.level,
      bonus: state.p1.turbosLeft,
      seconds: state.elapsedRunSeconds,
      note,
      isRecord,
      beatBestBy,
    }
  }

  return {
    status,
    score: state.level,
    best: bestLevel,
    bonus: state.p1.turbosLeft,
    tiles,
    badges,
    run: runSummary,
    muted: isMuted,
  }
}

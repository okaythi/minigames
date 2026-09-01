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

  const isWin = state.phase === 'victory'
  
  // Score formula:
  // If won, score = 1000000 - (milliseconds elapsed). Faster time = higher score.
  // If not won, score = level (1-5).
  // Thus any win beats any loss, and faster wins beat slower wins.
  const rawScore = isWin
    ? Math.floor(1000000 - state.elapsedRunSeconds * 1000)
    : state.level

  const formatBest = (score: number | null) => {
    if (score === null) return '--'
    if (score > 1000) {
      return formatRunTime((1000000 - score) / 1000)
    }
    return `LVL ${score}`
  }

  const tiles: readonly GameStatTile[] = [
    {
      label: 'BEST RUN',
      value: formatBest(bestLevel),
      note: 'Global record',
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
    const note = isWin
      ? `Victory! All 6 levels cleared in ${timeFormatted}.`
      : `Eliminated on Level ${state.level} (${aiConfig.name}).`
    const isRecord = bestLevel === null || rawScore > bestLevel
    let beatBestBy: number | null = null
    
    if (isRecord && bestLevel !== null) {
      // If previous best was also a win, we show how many seconds faster they were.
      if (bestLevel > 1000 && isWin) {
        beatBestBy = (rawScore - bestLevel) / 1000 // difference in seconds
      } else {
        beatBestBy = rawScore - bestLevel // generic raw difference if mixing metrics
      }
    }

    runSummary = {
      score: rawScore,
      bonus: state.p1.turbosLeft,
      seconds: state.elapsedRunSeconds,
      note,
      isRecord,
      beatBestBy,
    }
  }

  return {
    status,
    score: rawScore,
    best: bestLevel,
    bonus: state.p1.turbosLeft,
    tiles,
    badges,
    run: runSummary,
    muted: isMuted,
  }
}

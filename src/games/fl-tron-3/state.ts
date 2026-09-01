import type { DifficultyLevel, GameMode, TronState } from './engine/types'
import { createCycle } from './engine/cycle'
import { AI_CONFIGS } from './engine/config'

export function createInitialTronState(level: DifficultyLevel = 1, mode: GameMode = 'campaign'): TronState {
  const p1 = createCycle('p1', 20, 75, 'up', 3)
  const ai = createCycle('ai', 60, 30, 'down', AI_CONFIGS[level].maxTurbos)

  return {
    phase: 'menu',
    mode,
    level,
    p1RoundWins: 0,
    aiRoundWins: 0,
    roundNumber: 1,
    countdownTimer: 0,
    phaseTimer: 0,
    elapsedRunSeconds: 0,
    p1,
    ai,
    roundWinner: null,
    particles: [],
    bannerText: null,
    bannerSubtext: null,
  }
}

import { createStore } from '../../lib/observable-store'
import { getCurrentUser } from '../../services/auth-api'
import type { GameHost, GameViewFactory } from '../runtime/types'
import type { GameRuntime, GameRuntimeFactory } from '../template/types'
import { emptyGameSnapshot, type GameSnapshot } from '../template/snapshot'
import { CardJitsuSession } from './engine/gateway/session'
import { DefaultCardStore } from './engine/deck/cards'
import type { CardJitsuPhase, MatchStats, NinjaBelt, SenseiDifficulty } from './types'

export interface CardJitsuRuntimeExtended extends GameRuntime {
  readonly session: CardJitsuSession
  readonly getBelt: () => NinjaBelt
  readonly setBelt: (belt: NinjaBelt) => void
  readonly getDifficulty: () => SenseiDifficulty
  readonly setDifficulty: (diff: SenseiDifficulty) => void
  readonly getStats: () => MatchStats
  readonly getPhase: () => CardJitsuPhase
  readonly startEarnBelts: () => void
  readonly startChallengeSensei: () => void
  readonly forceWin: () => void
  readonly forceLoss: () => void
}

export const createCardJitsuRuntime: GameRuntimeFactory = (deps) => {
  let playerBelt: NinjaBelt = 'white'
  let difficulty: SenseiDifficulty = 'medium'
  let totalWins = 0

  const store = createStore<GameSnapshot>({
    ...emptyGameSnapshot(),
    best: deps.current.best,
    bonus: deps.current.bonus,
  })

  let _currentStats: MatchStats = {
    round: 1,
    playerWonCards: [],
    senseiWonCards: [],
    playerHand: [],
    senseiHand: [],
    playerSelectedCard: null,
    senseiSelectedCard: null,
    lastClash: null,
    matchWinner: null,
  }

  let _currentPhase: CardJitsuPhase = 'dialogue'

  const currentUser = getCurrentUser()
  const playerNick = currentUser?.nickname ?? currentUser?.username ?? 'Ninja'

  const session = new CardJitsuSession({
    difficulty,
    playerBelt,
    mode: 'MODE_SEN',
    playerNick,
    playerColor: 6,
    cardStore: new DefaultCardStore(),
    onStateChange: (stats, phase) => {
      _currentStats = stats
      _currentPhase = phase
      if (phase === 'choosing' || phase === 'clashing') {
        store.update((prev) => ({ ...prev, status: 'running' }))
      } else if (phase === 'game-over') {
        store.update((prev) => ({ ...prev, status: 'over' }))
      }
    },
    onGameOver: (winner) => {
      if (winner === 'player') {
        totalWins++
        // Award candy bounty
        deps.current.bankBonus(50)
        store.update((prev) => ({
          ...prev,
          score: totalWins,
          bonus: prev.bonus + 50,
          best: Math.max(prev.best ?? 0, totalWins),
        }))
        deps.current.finishRun(totalWins, { won: true, difficulty })
      } else {
        deps.current.finishRun(totalWins, { won: false, difficulty })
      }
    },
  })

  // The custom RuffleStage directly embeds and manages the authentic Disney Flash client.
  // GameViewFactory provides minimal lifecycle compliance for the host.
  const attach: GameViewFactory = (_host: GameHost) => {
    return {
      dispose: () => {
        // Frame loop cleanup if any
      },
    }
  }

  const actions = {
    primary: () => {
      deps.current.beginRun()
      session.startMatch('MODE_EXP')
    },
    pause: () => {
      store.update((prev) => ({ ...prev, status: 'paused' }))
    },
    resume: () => {
      store.update((prev) => ({ ...prev, status: 'running' }))
    },
    restart: () => {
      deps.current.beginRun()
      session.startMatch('MODE_EXP')
    },
    toggleMute: () => {
      store.update((prev) => ({ ...prev, muted: !prev.muted }))
    },
  }

  const runtime: CardJitsuRuntimeExtended = {
    store,
    actions,
    attach,
    dispose: () => {
      // Clean up session if needed
    },
    session,
    getBelt: () => playerBelt,
    setBelt: (belt: NinjaBelt) => {
      playerBelt = belt
      session.setPlayerBelt(belt)
    },
    getDifficulty: () => difficulty,
    setDifficulty: (diff: SenseiDifficulty) => {
      difficulty = diff
      session.setDifficulty(diff)
    },
    getStats: () => _currentStats,
    getPhase: () => _currentPhase,
    startEarnBelts: () => {
      deps.current.beginRun()
      session.startMatch('MODE_EXP')
    },
    startChallengeSensei: () => {
      deps.current.beginRun()
      session.setDifficulty('ninja')
      session.startMatch('MODE_SEN')
    },
    forceWin: () => {
      totalWins++
      deps.current.bankBonus(50)
      store.update((prev) => ({
        ...prev,
        score: totalWins,
        bonus: prev.bonus + 50,
        status: 'over',
      }))
      session.forceWin()
    },
    forceLoss: () => {
      store.update((prev) => ({ ...prev, status: 'over' }))
      session.forceLoss()
    },
  }

  return runtime
}

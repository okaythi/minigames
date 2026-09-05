import { createStore } from '../../lib/observable-store'
import { getCurrentUser } from '../../services/auth-api'
import type { GameHost, GameViewFactory } from '../runtime/types'
import type { GameRuntime, GameRuntimeFactory } from '../template/types'
import { emptyGameSnapshot, type GameSnapshot } from '../template/snapshot'
import { CardJitsuSession, BELT_TO_RANK } from './engine/gateway/session'
import { getRankBelt } from './engine/progression'
import { DefaultCardStore } from './engine/deck/cards'
import type {
  CardJitsuPhase,
  CardStore,
  MatchEndDecision,
  MatchEndResult,
  MatchStats,
  NinjaBelt,
  OnMatchEndCallback,
  SenseiDifficulty,
} from './types'
import type { BotPolicy } from './engine/ai/bot-policy'

export interface CardJitsuRuntimeOptions {
  readonly player?: {
    readonly nick?: string
    readonly colorId?: number // CP 1–15
    readonly beltRank?: number // 1–9
  }
  readonly cardStore?: CardStore
  readonly mode?: 'sensei' | 'belts'
  readonly opponentPolicy?: BotPolicy
  readonly onMatchEnd?: OnMatchEndCallback
  readonly onExit?: () => void
}

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
  readonly exitToMenu: () => void
}

/**
 * Public Card-Jitsu runtime factory conforming to GameRuntimeFactory.
 *
 * Usage:
 * ```ts
 * createCardJitsuRuntime(deps, {
 *   player: { nick: 'Ninja', colorId: 6, beltRank: 1 },
 *   cardStore: new DefaultCardStore(),
 *   mode: 'belts',
 *   onMatchEnd: async (result) => ({ awardRank: 2 }),
 *   onExit: () => console.log('Exited match'),
 * })
 * ```
 */
export const createCardJitsuRuntime = (
  deps: Parameters<GameRuntimeFactory>[0],
  options?: CardJitsuRuntimeOptions,
): CardJitsuRuntimeExtended => {
  const initialBelt = options?.player?.beltRank
    ? getRankBelt(options.player.beltRank)
    : 'white'
  let playerBelt: NinjaBelt = initialBelt
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
  const playerNick =
    options?.player?.nick ?? currentUser?.nickname ?? currentUser?.username ?? 'Ninja'
  const playerColor = options?.player?.colorId ?? 6

  const session = new CardJitsuSession({
    difficulty,
    playerBelt,
    mode: options?.mode ?? 'sensei',
    playerNick,
    playerColor,
    cardStore: options?.cardStore ?? new DefaultCardStore(),
    opponentPolicy: options?.opponentPolicy,
    onStateChange: (stats, phase) => {
      _currentStats = stats
      _currentPhase = phase
      if (phase === 'choosing' || phase === 'clashing') {
        store.update((prev) => ({ ...prev, status: 'running' }))
      } else if (phase === 'game-over') {
        store.update((prev) => ({ ...prev, status: 'over' }))
      }
    },
    onMatchEnd: async (result: MatchEndResult): Promise<MatchEndDecision> => {
      if (result.winner === 'player') {
        totalWins++
        store.update((prev) => ({
          ...prev,
          score: totalWins,
          best: Math.max(prev.best ?? 0, totalWins),
        }))
        deps.current.finishRun(totalWins, { won: true, difficulty })
      } else {
        deps.current.finishRun(totalWins, { won: false, difficulty })
      }

      let defaultAwardRank: number | undefined
      if (result.winner === 'player') {
        const curRank = BELT_TO_RANK[playerBelt] ?? 1
        if (curRank < 9) {
          const nextRank = curRank + 1
          const nextBelt = getRankBelt(nextRank)
          playerBelt = nextBelt
          defaultAwardRank = nextRank
        }
      }

      if (options?.onMatchEnd) {
        const decision = await options.onMatchEnd(result)
        return decision ?? (defaultAwardRank !== undefined ? { awardRank: defaultAwardRank } : {})
      }

      return defaultAwardRank !== undefined ? { awardRank: defaultAwardRank } : {}
    },
  })

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
      session.startMatch('belts')
    },
    pause: () => {
      store.update((prev) => ({ ...prev, status: 'paused' }))
    },
    resume: () => {
      store.update((prev) => ({ ...prev, status: 'running' }))
    },
    restart: () => {
      deps.current.beginRun()
      session.startMatch('belts')
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
      session.startMatch('belts')
    },
    startChallengeSensei: () => {
      deps.current.beginRun()
      session.setDifficulty('ninja')
      session.startMatch('sensei')
    },
    forceWin: () => {
      totalWins++
      store.update((prev) => ({
        ...prev,
        score: totalWins,
        status: 'over',
      }))
      session.forceWin()
    },
    forceLoss: () => {
      store.update((prev) => ({ ...prev, status: 'over' }))
      session.forceLoss()
    },
    exitToMenu: () => {
      options?.onExit?.()
    },
  }

  return runtime
}

import { createStore } from '../../lib/observable-store'
import { getCurrentUser } from '../../services/auth-api'
import type { GameHost, GameViewFactory } from '../runtime/types'
import type { GameRuntime, GameRuntimeFactory } from '../template/types'
import { emptyGameSnapshot, type GameSnapshot } from '../template/snapshot'
import { CardJitsuSession } from './engine/gateway/session'
import { getRankBelt } from '../../../shared/progression'
import { DefaultCardStore } from './engine/deck/cards'
import type {
  CardJitsuPhase,
  CardStore,
  MatchEndDecision,
  MatchEndResult,
  MatchStats,
  NinjaBelt,
  OnMatchEndCallback,
} from './types'
import type { BotPolicy } from './engine/ai/bot-policy'
import type {
  CardJitsuProfileResponse,
  CardJitsuMatchPayload,
  CardJitsuMatchResponse,
} from '../../../shared/card-jitsu-protocol'

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
  readonly getRank: () => number
  readonly getProgress: () => number
  readonly getMatchesWon: () => number
  readonly getEligibleOpponents: () => readonly string[]
  readonly getStats: () => MatchStats
  readonly getPhase: () => CardJitsuPhase
  readonly startEarnBelts: () => void
  readonly startChallengeSensei: () => void
  readonly exitToMenu: () => void
  readonly refreshProfile: () => Promise<CardJitsuProfileResponse | null>
  readonly getIntroSeen: () => boolean
}


/**
 * Fetches server-authoritative Card-Jitsu profile from D1 endpoint.
 */
export async function fetchCardJitsuProfile(): Promise<CardJitsuProfileResponse | null> {
  try {
    const res = await fetch('/api/card-jitsu/profile')
    if (!res.ok) return null
    const data = (await res.json()) as { ok: boolean; profile: CardJitsuProfileResponse }
    return data.profile ?? null
  } catch (err) {
    console.warn('[Card-Jitsu] Error fetching profile:', err)
    return null
  }
}

/**
 * Public Card-Jitsu runtime factory conforming to GameRuntimeFactory.
 */
export const createCardJitsuRuntime = (
  deps: Parameters<GameRuntimeFactory>[0],
  options?: CardJitsuRuntimeOptions,
): CardJitsuRuntimeExtended => {
  const initialBelt = options?.player?.beltRank
    ? getRankBelt(options.player.beltRank)
    : 'white'
  let playerBelt: NinjaBelt = initialBelt
  let currentRank = options?.player?.beltRank ?? 0
  let currentProgress = 0
  let totalWins = 0
  let eligibleOpponents: readonly string[] = []

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
  const profileColor = (currentUser as { colorId?: number } | null)?.colorId
  const candidateColor = options?.player?.colorId ?? profileColor ?? 1
  const playerColor =
    candidateColor === 14 ? 1 : candidateColor >= 1 && candidateColor <= 15 ? candidateColor : 1

  const session = new CardJitsuSession({
    playerBelt,
    mode: options?.mode ?? 'sensei',
    playerNick,
    playerColor,
    cardStore: options?.cardStore ?? new DefaultCardStore(),
    ...(options?.opponentPolicy ? { opponentPolicy: options.opponentPolicy } : {}),
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
      let awardRank: number | undefined
      try {
        const matchId = crypto.randomUUID()
        const opponent = session.getOpponentNick()
        const payload: CardJitsuMatchPayload = {
          id: matchId,
          opponent,
          ...result,
        }
        const res = await fetch('/api/card-jitsu/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean } & CardJitsuMatchResponse
          currentRank = data.rank
          currentProgress = data.progress
          totalWins = data.matchesWon
          awardRank = data.awardRank
          session.setPlayerRank(data.rank)
          if (data.rank > 0) {
            playerBelt = getRankBelt(data.rank)
            session.setPlayerBelt(playerBelt)
          }
          store.update((prev) => ({
            ...prev,
            score: totalWins,
            best: Math.max(prev.best ?? 0, totalWins),
          }))
          if (awardRank !== undefined) {
            void refreshProfile()
          }
        }
      } catch (err) {
        console.error('[Card-Jitsu] Error recording match result:', err)
      }

      if (result.winner === 'player') {
        deps.current.finishRun(totalWins, { won: true })
      } else {
        deps.current.finishRun(totalWins, { won: false })
      }

      if (options?.onMatchEnd) {
        const decision = await options.onMatchEnd(result)
        return decision ?? (awardRank !== undefined ? { awardRank } : {})
      }

      return awardRank !== undefined ? { awardRank } : {}
    },
  })

  const refreshProfile = async (): Promise<CardJitsuProfileResponse | null> => {
    try {
      const profile = await fetchCardJitsuProfile()
      if (profile) {
        currentRank = profile.rank
        currentProgress = profile.progress
        totalWins = profile.matchesWon
        eligibleOpponents = profile.eligibleOpponents
        const hasCards = profile.cards.length > 0
        const introSeen = profile.introSeen || hasCards
        session.setIntroSeen(introSeen)
        if (hasCards) {
          session.addInventoryItem(821)
          session.setOwnedCards(profile.cards)
        }
        if (profile.eligibleOpponents.length > 0) {
          session.setEligibleOpponents(profile.eligibleOpponents)
        }
        session.setPlayerRank(profile.rank)
        if (profile.rank > 0) {
          playerBelt = getRankBelt(profile.rank)
          session.setPlayerBelt(playerBelt)
        }
        store.update((prev) => ({
          ...prev,
          score: totalWins,
          best: Math.max(prev.best ?? 0, totalWins),
        }))
      }
      return profile
    } finally {
      session.markReady()
    }
  }


  // Pre-fetch profile before entering match/menu
  void refreshProfile()

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
    getRank: () => currentRank,
    getProgress: () => currentProgress,
    getMatchesWon: () => totalWins,
    getEligibleOpponents: () => eligibleOpponents,
    getStats: () => _currentStats,
    getPhase: () => _currentPhase,
    startEarnBelts: () => {
      deps.current.beginRun()
      session.startMatch('belts')
    },
    startChallengeSensei: () => {
      deps.current.beginRun()
      session.startMatch('sensei')
    },
    exitToMenu: () => {
      options?.onExit?.()
    },
    refreshProfile,
    getIntroSeen: () => session.getIntroSeen(),
  }


  return runtime
}

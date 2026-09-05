import type {
  CardJitsuPhase,
  CardStore,
  ClashResult,
  MatchStats,
  NinjaBelt,
  OnMatchEndCallback,
  WinConditionResult,
} from '../../types'
import type { BotPolicy } from '../ai/bot-policy'

export type GameMode = 'sensei' | 'belts' | 'MODE_SEN' | 'MODE_EXP'

export interface SessionConfig {
  readonly playerBelt: NinjaBelt
  readonly mode: GameMode
  readonly playerNick?: string
  readonly playerColor?: number
  readonly cardStore?: CardStore
  readonly opponentPolicy?: BotPolicy
  readonly opponentTemperature?: number
  readonly onStateChange?: (stats: MatchStats, phase: CardJitsuPhase) => void
  readonly onClashDone?: (result: ClashResult, winCondition: WinConditionResult) => void
  readonly onMatchEnd?: OnMatchEndCallback
  readonly onGameOver?: (winner: 'player' | 'sensei') => void
  readonly onBeltAwarded?: (newBelt: NinjaBelt) => void
  readonly eligibleOpponents?: readonly string[]
  readonly overrideOpponent?: string
  readonly introSeen?: boolean
}


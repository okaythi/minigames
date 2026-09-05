import type {
  CardJitsuPhase,
  CardStore,
  ClashResult,
  MatchStats,
  NinjaBelt,
  OnMatchEndCallback,
  SenseiDifficulty,
  WinConditionResult,
} from '../../types'
import type { BotPolicy } from '../ai/bot-policy'

export type GameMode = 'sensei' | 'belts' | 'MODE_SEN' | 'MODE_EXP'

export interface SessionConfig {
  readonly difficulty: SenseiDifficulty
  readonly playerBelt: NinjaBelt
  readonly mode: GameMode
  readonly playerNick?: string | undefined
  readonly playerColor?: number | undefined
  readonly cardStore?: CardStore | undefined
  readonly opponentPolicy?: BotPolicy | undefined
  readonly onStateChange?: ((stats: MatchStats, phase: CardJitsuPhase) => void) | undefined
  readonly onClashDone?: ((result: ClashResult, winCondition: WinConditionResult) => void) | undefined
  readonly onMatchEnd?: OnMatchEndCallback | undefined
  readonly onGameOver?: ((winner: 'player' | 'sensei') => void) | undefined
  readonly onBeltAwarded?: ((newBelt: NinjaBelt) => void) | undefined
  readonly eligibleOpponents?: readonly string[] | undefined
  readonly overrideOpponent?: string | undefined
}

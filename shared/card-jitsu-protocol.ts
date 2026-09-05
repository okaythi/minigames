import type { MatchEndResult } from '../src/games/card-jitsu/types'

export interface OwnedCard {
  readonly cardId: number
  readonly quantity: number
  readonly memberQuantity: number
}

export interface CardJitsuProfileResponse {
  readonly rank: number
  readonly progress: number
  readonly matchesWon: number
  readonly colorId: number
  readonly introSeen: boolean
  readonly cards: readonly OwnedCard[]
  readonly eligibleOpponents: readonly string[]
  readonly ownedColors?: readonly number[]
}

export interface CardJitsuMatchPayload extends MatchEndResult {
  readonly id: string
  readonly opponent: string
}

export interface CardJitsuMatchResponse {
  readonly awardRank?: number | undefined
  readonly rank: number
  readonly progress: number
  readonly matchesWon: number
  /** Actual absolute-EXP delta applied by the server for this match. */
  readonly progressAwarded: number
}

export interface CardJitsuColorPayload {
  readonly colorId: number
}

export interface CardJitsuColorResponse {
  readonly ok: boolean
  readonly colorId: number
}

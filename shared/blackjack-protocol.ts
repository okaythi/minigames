export interface BlackjackWallet {
  readonly bonusEur: number
  readonly depositedEur: number
  readonly initialTotalEur: number
}

export interface BlackjackSessionState {
  readonly bankroll: number
  readonly wallet: BlackjackWallet
  readonly difficulty: 'easy' | 'normal' | 'hard' | 'expert'
  readonly companionCount: 1 | 2 | 3
  readonly firstTimeGranted?: boolean
}

export interface BlackjackSessionResponse {
  readonly ok: boolean
  readonly session: BlackjackSessionState
  readonly candy: number
  readonly isFirstTime?: boolean
  readonly error?: string
}

export interface BlackjackSessionUpdatePayload {
  readonly bankroll: number
  readonly wallet: BlackjackWallet
  readonly difficulty?: 'easy' | 'normal' | 'hard' | 'expert'
  readonly companionCount?: 1 | 2 | 3
}

export interface BlackjackDepositPayload {
  readonly candies: number
}

export interface BlackjackDepositResponse {
  readonly ok: boolean
  readonly candy: number
  readonly bankroll: number
  readonly wallet: BlackjackWallet
  readonly error?: string
}

export interface BlackjackCashOutResponse {
  readonly ok: boolean
  readonly cashedOutEur: number
  readonly cashedOutCandies: number
  readonly candy: number
  readonly bankroll: number
  readonly wallet: BlackjackWallet
  readonly error?: string
}

export type NinjaElement = 'f' | 'w' | 's'

export type CardColor = 'r' | 'b' | 'g' | 'y' | 'o' | 'p'

export interface OwnedCard {
  readonly cardId: number
  readonly quantity: number
  readonly memberQuantity: number
}

export interface CardStore {
  getOwned(): readonly OwnedCard[]
}

export type NinjaBelt =
  | 'white'
  | 'yellow'
  | 'orange'
  | 'green'
  | 'blue'
  | 'red'
  | 'purple'
  | 'brown'
  | 'black'

export interface BeltInfo {
  readonly belt: NinjaBelt
  readonly name: string
  readonly requiredWins: number
  readonly colorHex: string
}

export const BELT_PROGRESSION: readonly BeltInfo[] = [
  { belt: 'white', name: 'White Belt', requiredWins: 0, colorHex: '#ECEFF1' },
  { belt: 'yellow', name: 'Yellow Belt', requiredWins: 5, colorHex: '#FDD835' },
  { belt: 'orange', name: 'Orange Belt', requiredWins: 13, colorHex: '#FB8C00' },
  { belt: 'green', name: 'Green Belt', requiredWins: 21, colorHex: '#43A047' },
  { belt: 'blue', name: 'Blue Belt', requiredWins: 30, colorHex: '#1E88E5' },
  { belt: 'red', name: 'Red Belt', requiredWins: 40, colorHex: '#E53935' },
  { belt: 'purple', name: 'Purple Belt', requiredWins: 52, colorHex: '#8E24AA' },
  { belt: 'brown', name: 'Brown Belt', requiredWins: 64, colorHex: '#6D4C41' },
  { belt: 'black', name: 'Black Belt', requiredWins: 76, colorHex: '#212121' },
] as const

export interface CardData {
  readonly id: number
  readonly element: NinjaElement
  readonly value: number
  readonly color: CardColor
  readonly powerId: number
  readonly name?: string
  readonly description?: string
  readonly setId?: number
}

export type ClashWinner = 'player' | 'sensei' | 'tie'

export interface ClashResult {
  readonly playerCard: CardData
  readonly senseiCard: CardData
  readonly winner: ClashWinner
  readonly reason: 'element' | 'value' | 'power' | 'tie'
  readonly powerTriggered?: number | undefined
  readonly message: string
}

export interface WinConditionResult {
  readonly won: boolean
  readonly triadType?: 'different-elements' | 'same-element'
  readonly winningCards?: readonly CardData[]
}

export type CardJitsuPhase =
  | 'dialogue' // Sensei on green cushion dialogue menu
  | 'instructions' // Rules scroll view
  | 'dealing' // 5 cards dealt from wooden deck
  | 'choosing' // Waiting for player and Sensei to choose a card
  | 'clashing' // Cards reveal and clash animation plays
  | 'scoring' // Card moves to won rack, replacement card dealt
  | 'game-over' // Match won or lost

export interface MatchStats {
  readonly round: number
  readonly playerWonCards: readonly CardData[]
  readonly senseiWonCards: readonly CardData[]
  readonly playerHand: readonly CardData[]
  readonly senseiHand: readonly CardData[]
  readonly playerSelectedCard: CardData | null
  readonly senseiSelectedCard: CardData | null
  readonly lastClash: ClashResult | null
  readonly matchWinner: 'player' | 'sensei' | null
}

export interface MatchEndResult {
  readonly winner: 'player' | 'opponent'
  readonly mode: 'sensei' | 'belts'
  readonly rounds: number
  readonly playerBank: readonly CardData[]
  readonly opponentBank: readonly CardData[]
  readonly winMethod: 'same-element' | 'three-elements' | 'forfeit' | 'no-cards'
  readonly flawless: boolean
  readonly fullDojo: boolean
  readonly senseiCardPlayed: boolean
}

export interface MatchEndDecision {
  readonly awardRank?: number
}

export type OnMatchEndCallback = (
  result: MatchEndResult,
) => MatchEndDecision | Promise<MatchEndDecision>

import type { CardColor, CardData, NinjaBelt, NinjaElement } from '../../types'
import { checkWinCondition, doesElementBeat } from '../deck/rules'

export interface SenseiDecisionContext {
  readonly playerBelt: NinjaBelt
  readonly senseiHand: readonly CardData[]
  readonly playerCard: CardData // Used for cheat mode
  readonly senseiWonCards: readonly CardData[]
  readonly playerWonCards: readonly CardData[]
  readonly playerHistory: readonly CardData[]
}

const COUNTER_ELEMENT: Record<NinjaElement, NinjaElement> = {
  f: 'w',
  w: 's',
  s: 'f',
}

const ALL_ELEMENTS: readonly NinjaElement[] = ['f', 'w', 's']
const ALL_COLORS: readonly CardColor[] = ['r', 'b', 'g', 'y', 'o', 'p']

/**
 * Sensei AI Decision Engine.
 * 
 * Supports authentic Club Penguin mechanics:
 * 1. Pre-Black Belt: Sensei is unbeatable and counters the player's card.
 * 2. Black Belt: Sensei plays fair tactical hand evaluation (triad completion, threat neutralization, card-counting).
 */
export function decideSenseiCard(context: SenseiDecisionContext): CardData {
  const {
    playerBelt,
    senseiHand,
    playerCard,
    senseiWonCards,
    playerWonCards,
    playerHistory,
  } = context

  if (senseiHand.length === 0) {
    throw new Error('Sensei hand is empty')
  }

  // If player is NOT a Black Belt, Sensei is unbeatable (authentic Disney CP canon)
  if (playerBelt !== 'black') {
    // Find a card in hand that counters player's card
    const winningCards = senseiHand.filter(
      (c) =>
        doesElementBeat(c.element, playerCard.element) ||
        (c.element === playerCard.element && c.value > playerCard.value),
    )

    if (winningCards.length > 0) {
      return winningCards.reduce((prev, curr) => (curr.value > prev.value ? curr : prev))
    }

    // If no counter in current hand, Sensei uses an elemental mastery card
    return {
      id: 9999,
      element: COUNTER_ELEMENT[playerCard.element],
      value: Math.min(12, playerCard.value + 2),
      color: 'r',
      powerId: 0,
      name: 'Sensei Mastery Counter',
      description: 'Sensei anticipated your exact motion',
    }
  }

  // If player IS a Black Belt, Sensei plays fair master-tier cards (can be defeated)

  // --- 3. Tactical 5-Card Hand Evaluation (Grandmaster Logic) ---

  // Priority A: Win Check (Can any card in hand complete Sensei's winning triad?)
  for (const card of senseiHand) {
    const hypotheticalWon = [...senseiWonCards, card]
    if (checkWinCondition(hypotheticalWon).won) {
      return card
    }
  }

  // Priority B: Block Check (Is the player 1 card away from winning?)
  // Identify elements that would give the player a victory
  const threatElements: NinjaElement[] = []
  for (const element of ALL_ELEMENTS) {
    const mockCard: CardData = {
      id: -1,
      element,
      value: 10,
      color: 'y',
      powerId: 0,
    }
    // Check multiple colors to see if any gives player the win
    for (const color of ALL_COLORS) {
      const testCard: CardData = { ...mockCard, color }
      if (checkWinCondition([...playerWonCards, testCard]).won) {
        threatElements.push(element)
        break
      }
    }
  }

  // If there are threat elements, find cards that counter them
  if (threatElements.length > 0) {
    for (const threat of threatElements) {
      const desired = COUNTER_ELEMENT[threat]
      const matchingCards = senseiHand.filter((c) => c.element === desired)
      if (matchingCards.length > 0) {
        // Play highest value of this countering element
        return matchingCards.reduce((prev, curr) => (curr.value > prev.value ? curr : prev))
      }
    }
  }

  // Priority C: Player History Analysis (Predict player's favored element)
  if (playerHistory.length >= 2) {
    const elementCounts: Record<NinjaElement, number> = { f: 0, w: 0, s: 0 }
    for (const card of playerHistory.slice(-4)) {
      elementCounts[card.element]++
    }
    // Find most played element
    let mostPlayed: NinjaElement = 'f'
    let maxCount = -1
    for (const [elem, count] of Object.entries(elementCounts) as [NinjaElement, number][]) {
      if (count > maxCount) {
        maxCount = count
        mostPlayed = elem
      }
    }

    const desired = COUNTER_ELEMENT[mostPlayed]
    const counterCards = senseiHand.filter((c) => c.element === desired)
    if (counterCards.length > 0) {
      return counterCards.reduce((prev, curr) => (curr.value > prev.value ? curr : prev))
    }
  }

  // Priority D: Highest Value Play with power synergy
  const sorted = [...senseiHand].sort((a, b) => b.value - a.value)
  return sorted[0] ?? senseiHand[0]!
}

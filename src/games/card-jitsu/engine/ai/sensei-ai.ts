import type { CardData, NinjaBelt, NinjaElement, SenseiDifficulty } from '../../types'
import { doesElementBeat, checkWinCondition } from '../deck/rules'

export interface SenseiDecisionContext {
  readonly difficulty: SenseiDifficulty
  readonly playerBelt: NinjaBelt
  readonly senseiHand: readonly CardData[]
  readonly playerCard: CardData // Used for cheat mode
  readonly senseiWonCards: readonly CardData[]
  readonly playerWonCards: readonly CardData[]
  readonly playerHistory: readonly CardData[]
}


/**
 * Sensei AI Decision Engine.
 * 
 * Supports both authentic Club Penguin mechanics:
 * 1. Pre-Black Belt Counter-Cheat (unbeatable counter-interception).
 * 2. Authentic 5-Card Tactical Hand (triad completion, threat neutralization, card-counting).
 */
export function decideSenseiCard(context: SenseiDecisionContext): CardData {
  const {
    difficulty,
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

  // --- 1. Ninja Difficulty Logic ---
  if (difficulty === 'ninja') {
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
      const counterElement: Record<NinjaElement, NinjaElement> = {
        fire: 'water',
        water: 'snow',
        snow: 'fire',
      }
      return {
        id: 9999,
        element: counterElement[playerCard.element],
        value: Math.min(12, playerCard.value + 2),
        color: 'red',
        powerId: 0,
        name: 'Sensei Mastery Counter',
        description: 'Sensei anticipated your exact motion',
      }
    }
    // If player IS a Black Belt, Sensei plays fair master-tier cards (can be defeated)
  }

  // --- 2. Calculate Blunder Rate based on difficulty ---
  let blunderRate = 0
  if (difficulty === 'easy') {
    blunderRate = 0.60
  } else if (difficulty === 'medium') {
    blunderRate = 0.25
  } else if (difficulty === 'hard') {
    blunderRate = 0.05
  } else if (difficulty === 'ninja') {
    blunderRate = 0.0 // Flawless tactical play for Black Belt challenge
  }

  // Blunder play: play a low or random card from hand
  if (Math.random() < blunderRate) {
    const sortedLowToHigh = [...senseiHand].sort((a, b) => a.value - b.value)
    return sortedLowToHigh[0] ?? senseiHand[0]!
  }

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
  for (const element of ['fire', 'water', 'snow'] as const) {
    const mockCard: CardData = {
      id: -1,
      element,
      value: 10,
      color: 'yellow',
      powerId: 0,
    }
    // Check multiple colors to see if any gives player the win
    for (const color of ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] as const) {
      const testCard = { ...mockCard, color }
      if (checkWinCondition([...playerWonCards, testCard]).won) {
        threatElements.push(element)
        break
      }
    }
  }

  // If there are threat elements, find cards that counter them
  if (threatElements.length > 0) {
    for (const threat of threatElements) {
      // Element that beats the threat:
      // threat == 'fire' -> countered by 'water'
      // threat == 'water' -> countered by 'snow'
      // threat == 'snow' -> countered by 'fire'
      const counterElement: Record<NinjaElement, NinjaElement> = {
        fire: 'water',
        water: 'snow',
        snow: 'fire',
      }
      const desired = counterElement[threat]
      const matchingCards = senseiHand.filter((c) => c.element === desired)
      if (matchingCards.length > 0) {
        // Play highest value of this countering element
        return matchingCards.reduce((prev, curr) => (curr.value > prev.value ? curr : prev))
      }
    }
  }

  // Priority C: Player History Analysis (Predict player's favored element)
  if (playerHistory.length >= 2) {
    const elementCounts: Record<NinjaElement, number> = { fire: 0, water: 0, snow: 0 }
    for (const card of playerHistory.slice(-4)) {
      elementCounts[card.element]++
    }
    // Find most played element
    let mostPlayed: NinjaElement = 'fire'
    let maxCount = -1
    for (const [elem, count] of Object.entries(elementCounts) as [NinjaElement, number][]) {
      if (count > maxCount) {
        maxCount = count
        mostPlayed = elem
      }
    }

    const counterElement: Record<NinjaElement, NinjaElement> = {
      fire: 'water',
      water: 'snow',
      snow: 'fire',
    }
    const desired = counterElement[mostPlayed]
    const counterCards = senseiHand.filter((c) => c.element === desired)
    if (counterCards.length > 0) {
      return counterCards.reduce((prev, curr) => (curr.value > prev.value ? curr : prev))
    }
  }

  // Priority D: Highest Value Play with power synergy
  const sorted = [...senseiHand].sort((a, b) => b.value - a.value)
  return sorted[0] ?? senseiHand[0]!
}

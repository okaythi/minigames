import type { CardData, ClashResult, NinjaElement, WinConditionResult } from '../../types'

export interface ActiveEffects {
  readonly reverseActive: boolean
  readonly playerBuff: number
  readonly senseiBuff: number
  readonly lockedElement: NinjaElement | null
}

export const INITIAL_EFFECTS: ActiveEffects = {
  reverseActive: false,
  playerBuff: 0,
  senseiBuff: 0,
  lockedElement: null,
}

/**
 * Checks if element A beats element B.
 * Fire burns Snow, Snow freezes Water, Water douses Fire.
 */
export function doesElementBeat(a: NinjaElement, b: NinjaElement): boolean {
  return (
    (a === 'fire' && b === 'snow') ||
    (a === 'snow' && b === 'water') ||
    (a === 'water' && b === 'fire')
  )
}

/**
 * Resolves a round clash between the player's card and Sensei's card.
 */
export function resolveClash(
  playerCard: CardData,
  senseiCard: CardData,
  effects: ActiveEffects = INITIAL_EFFECTS,
): ClashResult {
  const pElem = playerCard.element
  const sElem = senseiCard.element

  // Apply buffs
  const pVal = playerCard.value + effects.playerBuff
  const sVal = senseiCard.value + effects.senseiBuff

  // Case 1: Elemental superiority
  if (doesElementBeat(pElem, sElem)) {
    const powerTriggered = playerCard.powerId > 0 ? playerCard.powerId : undefined
    return {
      playerCard,
      senseiCard,
      winner: 'player',
      reason: 'element',
      powerTriggered,
      message: `${capitalize(pElem)} triumphs over ${capitalize(sElem)}!`,
    }
  }

  if (doesElementBeat(sElem, pElem)) {
    const powerTriggered = senseiCard.powerId > 0 ? senseiCard.powerId : undefined
    return {
      playerCard,
      senseiCard,
      winner: 'sensei',
      reason: 'element',
      powerTriggered,
      message: `Sensei's ${capitalize(sElem)} conquers ${capitalize(pElem)}!`,
    }
  }

  // Case 2: Same element -> Compare numeric values
  if (pVal === sVal) {
    return {
      playerCard,
      senseiCard,
      winner: 'tie',
      reason: 'tie',
      message: `Equal power (${pVal} vs ${sVal})! Both cards clash and dissipate!`,
    }
  }

  // Reverse modifier check: lower value wins if active
  const lowCardWins = effects.reverseActive
  const playerWins = lowCardWins ? pVal < sVal : pVal > sVal

  if (playerWins) {
    const powerTriggered = playerCard.powerId > 0 ? playerCard.powerId : undefined
    return {
      playerCard,
      senseiCard,
      winner: 'player',
      reason: 'value',
      powerTriggered,
      message: lowCardWins
        ? `Reversal! Lower value ${pVal} beats ${sVal}!`
        : `Higher energy! ${pVal} overpowers ${sVal}!`,
    }
  }

  const powerTriggered = senseiCard.powerId > 0 ? senseiCard.powerId : undefined
  return {
    playerCard,
    senseiCard,
    winner: 'sensei',
    reason: 'value',
    powerTriggered,
    message: lowCardWins
      ? `Reversal! Sensei's lower value ${sVal} beats ${pVal}!`
      : `Sensei's higher power ${sVal} overpowers ${pVal}!`,
  }
}

/**
 * Evaluates whether a player has satisfied the 3-card Card-Jitsu victory condition.
 * 
 * Rules:
 * 1. 3 cards of DIFFERENT elements (1 Fire + 1 Water + 1 Snow), all 3 in DIFFERENT colors.
 * 2. 3 cards of the SAME element, all 3 in DIFFERENT colors.
 */
export function checkWinCondition(wonCards: readonly CardData[]): WinConditionResult {
  // Check Triad of Same Element (3 same elements, distinct colors)
  const byElement: Record<NinjaElement, CardData[]> = {
    fire: [],
    water: [],
    snow: [],
  }

  for (const card of wonCards) {
    byElement[card.element].push(card)
  }

  for (const element of ['fire', 'water', 'snow'] as const) {
    const cards = byElement[element]
    if (cards.length >= 3) {
      // Find 3 distinct colors
      const distinctColorCards: CardData[] = []
      const usedColors = new Set<string>()
      for (const card of cards) {
        if (!usedColors.has(card.color)) {
          usedColors.add(card.color)
          distinctColorCards.push(card)
          if (distinctColorCards.length === 3) {
            return {
              won: true,
              triadType: 'same-element',
              winningCards: distinctColorCards,
            }
          }
        }
      }
    }
  }

  // Check Triad of Different Elements (1 Fire + 1 Water + 1 Snow, all distinct colors)
  const fires = byElement['fire']
  const waters = byElement['water']
  const snows = byElement['snow']

  if (fires.length > 0 && waters.length > 0 && snows.length > 0) {
    for (const f of fires) {
      for (const w of waters) {
        if (f.color === w.color) continue
        for (const s of snows) {
          if (s.color === f.color || s.color === w.color) continue
          return {
            won: true,
            triadType: 'different-elements',
            winningCards: [f, w, s],
          }
        }
      }
    }
  }

  return { won: false }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

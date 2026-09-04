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

export const RULE_SET: Record<NinjaElement, NinjaElement> = {
  f: 's',
  w: 'f',
  s: 'w',
}

const ELEMENT_NAMES: Record<NinjaElement, string> = {
  f: 'Fire',
  w: 'Water',
  s: 'Snow',
}

/**
 * Checks if element A beats element B.
 * Fire burns Snow (f beats s), Snow freezes Water (s beats w), Water douses Fire (w beats f).
 */
export function doesElementBeat(a: NinjaElement, b: NinjaElement): boolean {
  return RULE_SET[a] === b
}

/**
 * Houdini's beats_card logic:
 * Checks if card A beats card B (element priority, then higher value).
 */
export function beatsCard(cardCheck: CardData, cardPlay: CardData): boolean {
  if (cardCheck.element !== cardPlay.element) {
    return RULE_SET[cardCheck.element] === cardPlay.element
  }
  return cardCheck.value > cardPlay.value
}

export const doesCardBeat = beatsCard

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
      message: `${ELEMENT_NAMES[pElem]} triumphs over ${ELEMENT_NAMES[sElem]}!`,
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
      message: `Sensei's ${ELEMENT_NAMES[sElem]} conquers ${ELEMENT_NAMES[pElem]}!`,
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
 */
export function checkWinCondition(wonCards: readonly CardData[]): WinConditionResult {
  // Check Triad of Same Element (3 same elements, distinct colors)
  const byElement: Record<NinjaElement, CardData[]> = {
    f: [],
    w: [],
    s: [],
  }

  for (const card of wonCards) {
    byElement[card.element].push(card)
  }

  for (const element of ['f', 'w', 's'] as const) {
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
  const fires = byElement['f']
  const waters = byElement['w']
  const snows = byElement['s']

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

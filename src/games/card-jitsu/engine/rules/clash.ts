import type { CardData, ClashResult, NinjaElement } from '../../types'
import { TIE_SEAT } from '../protocol/packets'
import type { ActiveCardState, ActivePowerCard } from './powers'

export const RULE_SET: Readonly<Record<NinjaElement, NinjaElement>> = {
  f: 's',
  w: 'f',
  s: 'w',
} as const

export const RuleSet = RULE_SET

export const ELEMENT_NAMES: Readonly<Record<NinjaElement, string>> = {
  f: 'Fire',
  w: 'Water',
  s: 'Snow',
} as const

/**
 * Checks if element A beats element B.
 * Fire beats Snow (f -> s), Snow beats Water (s -> w), Water beats Fire (w -> f).
 */
export function doesElementBeat(a: NinjaElement, b: NinjaElement): boolean {
  return RULE_SET[a] === b
}

/**
 * Houdini beats_card (ninja.py L171-L177):
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
 * Houdini adjust_card_values (ninja.py L191-L199):
 * Applies previous round's stored powers to modify values before clash.
 */
export function adjustCardValues(
  firstCard: ActiveCardState,
  secondCard: ActiveCardState,
  powers: ReadonlyMap<number, ActivePowerCard>,
): void {
  for (const [, powerCard] of powers) {
    if (powerCard.card.powerId === 1 && firstCard.element === secondCard.element) {
      const swapVal = firstCard.value
      firstCard.value = secondCard.value
      secondCard.value = swapVal
    }
    if (powerCard.card.powerId === 2) {
      if (powerCard.player === firstCard.player) {
        firstCard.value += 2
      } else {
        secondCard.value += 2
      }
    }
    if (powerCard.card.powerId === 3) {
      if (powerCard.player === firstCard.player) {
        secondCard.value -= 2
      } else {
        firstCard.value -= 2
      }
    }
  }
}

/**
 * Houdini get_winner_seat_id (ninja.py L179-L189):
 * Element superiority (RuleSet), then numeric value comparison. Returns winning seat or TIE_SEAT (-1).
 */
export function getWinnerSeatId(
  firstCard: ActiveCardState,
  secondCard: ActiveCardState,
): number {
  if (firstCard.element !== secondCard.element) {
    return RULE_SET[firstCard.element] === secondCard.element
      ? firstCard.player
      : secondCard.player
  }
  if (firstCard.value > secondCard.value) return firstCard.player
  if (secondCard.value > firstCard.value) return secondCard.player
  return TIE_SEAT
}

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
 * Resolves a round clash between player card and opponent card for UI display.
 */
export function resolveClash(
  playerCard: CardData,
  senseiCard: CardData,
  effects: ActiveEffects = INITIAL_EFFECTS,
): ClashResult {
  const pElem = playerCard.element
  const sElem = senseiCard.element
  const pVal = playerCard.value + effects.playerBuff
  const sVal = senseiCard.value + effects.senseiBuff

  if (doesElementBeat(pElem, sElem)) {
    return {
      playerCard,
      senseiCard,
      winner: 'player',
      reason: 'element',
      ...(playerCard.powerId > 0 ? { powerTriggered: playerCard.powerId } : {}),
      message: `${ELEMENT_NAMES[pElem]} triumphs over ${ELEMENT_NAMES[sElem]}!`,
    }
  }

  if (doesElementBeat(sElem, pElem)) {
    return {
      playerCard,
      senseiCard,
      winner: 'sensei',
      reason: 'element',
      ...(senseiCard.powerId > 0 ? { powerTriggered: senseiCard.powerId } : {}),
      message: `Opponent's ${ELEMENT_NAMES[sElem]} conquers ${ELEMENT_NAMES[pElem]}!`,
    }
  }

  if (pVal === sVal) {
    return {
      playerCard,
      senseiCard,
      winner: 'tie',
      reason: 'tie',
      message: `Equal power (${pVal} vs ${sVal})! Both cards clash and dissipate!`,
    }
  }

  const lowCardWins = effects.reverseActive
  const playerWins = lowCardWins ? pVal < sVal : pVal > sVal

  if (playerWins) {
    return {
      playerCard,
      senseiCard,
      winner: 'player',
      reason: 'value',
      ...(playerCard.powerId > 0 ? { powerTriggered: playerCard.powerId } : {}),
      message: lowCardWins
        ? `Reversal! Lower value ${pVal} beats ${sVal}!`
        : `Higher energy! ${pVal} overpowers ${sVal}!`,
    }
  }

  return {
    playerCard,
    senseiCard,
    winner: 'sensei',
    reason: 'value',
    ...(senseiCard.powerId > 0 ? { powerTriggered: senseiCard.powerId } : {}),
    message: lowCardWins
      ? `Reversal! Opponent's lower value ${sVal} beats ${pVal}!`
      : `Opponent's higher power ${sVal} overpowers ${pVal}!`,
  }
}

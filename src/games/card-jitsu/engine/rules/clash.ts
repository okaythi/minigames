import type { CardData, ClashResult, NinjaElement } from '../../types'
import { TIE_SEAT } from '../protocol/packets'
import { NORMAL_POOL } from '../deck/cards'
import {
  type ActiveCardState,
  type ActivePowerCard,
  type ActivePowerState,
  DiscardElements,
  DiscardColors,
  Replacements,
  POWER_CLASS,
  advancePowers,
  type PowerClass,
  onPlayedEffects,
} from './powers'
import { checkWinCondition } from './combos'

export { advancePowers, POWER_CLASS, type PowerClass }

export const RULE_SET: Readonly<Record<NinjaElement, NinjaElement>> = {
  f: 's',
  w: 'f',
  s: 'w',
} as const

export const REVERSED_RULE_SET: Readonly<Record<NinjaElement, NinjaElement>> = {
  s: 'f',
  f: 'w',
  w: 's',
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
  powers: ReadonlyMap<number, ActivePowerState>,
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

export interface EffectiveRules {
  readonly beats: Readonly<Record<NinjaElement, NinjaElement>>       // post-reversal
  readonly replace: Readonly<Record<NinjaElement, NinjaElement>>     // identity unless REPLACE active
  readonly valueDelta: readonly [me: number, opp: number]
  readonly lowestWins: boolean
}

const DEFAULT_EFFECTIVE_RULES: EffectiveRules = {
  beats: RULE_SET,
  replace: { f: 'f', w: 'w', s: 's' },
  valueDelta: [0, 0],
  lowestWins: false,
}

const effectiveRulesCache = new Map<string, EffectiveRules>()

export function effectiveRules(
  powers: ReadonlyMap<number, ActivePowerState>,
  mySeat: number,
): EffectiveRules {
  if (powers.size === 0) return DEFAULT_EFFECTIVE_RULES

  let cacheKey = `${mySeat}:`
  for (const [id, state] of powers) {
    cacheKey += `${id}_${state.player};`
  }
  const cached = effectiveRulesCache.get(cacheKey)
  if (cached !== undefined) return cached

  let reversed = false
  let replace: Record<NinjaElement, NinjaElement> = { f: 'f', w: 'w', s: 's' }
  let meDelta = 0
  let oppDelta = 0

  for (const power of powers.values()) {
    const pClass = POWER_CLASS.get(power.powerId)
    if (pClass === 'REVERSE') {
      reversed = true
    } else if (pClass === 'REPLACE') {
      const rep = Replacements[power.powerId]
      if (rep) {
        const [orig, repl] = rep
        replace = { ...replace, [orig]: repl }
      }
    } else if (pClass === 'VALUE') {
      if (power.powerId === 2) {
        if (power.player === mySeat) {
          meDelta += 2
        } else {
          oppDelta += 2
        }
      } else if (power.powerId === 3) {
        if (power.player === mySeat) {
          oppDelta -= 2
        } else {
          meDelta -= 2
        }
      }
    }
  }

  const result: EffectiveRules = {
    beats: reversed ? REVERSED_RULE_SET : RULE_SET,
    replace,
    valueDelta: [meDelta, oppDelta] as const,
    lowestWins: reversed,
  }

  effectiveRulesCache.set(cacheKey, result)
  return result
}

/**
 * Authoritative clash resolution under effective modified rules:
 * - Elements evaluated through rules.replace
 * - Elemental superiority determined through rules.beats (post-reversal)
 * - Same-element clash evaluated via valueDelta and lowestWins
 */
export function resolveClashWith(a: CardData, b: CardData, rules: EffectiveRules): 1 | 0 | -1 {
  const elemA = rules.replace[a.element] ?? a.element
  const elemB = rules.replace[b.element] ?? b.element

  if (elemA !== elemB) {
    if (rules.beats[elemA] === elemB) return 1
    if (rules.beats[elemB] === elemA) return -1
    return 0
  }

  const valA = a.value + rules.valueDelta[0]
  const valB = b.value + rules.valueDelta[1]

  if (valA === valB) return 0
  if (rules.lowestWins) {
    return valA < valB ? 1 : -1
  }
  return valA > valB ? 1 : -1
}

/**
 * Single authoritative clash resolver returning 1 (a wins), -1 (b wins), or 0 (tie).
 * Consistently used across MatchFlow, bot policies, and headless simulation.
 */
export function resolveClash(
  a: CardData,
  b: CardData,
  powers: ReadonlyMap<number, ActivePowerState> = new Map(),
): 1 | 0 | -1 {
  return resolveClashWith(a, b, effectiveRules(powers, 1))
}

/**
 * Pure simulation of discard power cards on player and opponent scored banks.
 */
export function applyPowerToBanks(
  powerId: number,
  myBank: readonly CardData[],
  oppBank: readonly CardData[],
): { myBank: CardData[]; oppBank: CardData[] } {
  const newMyBank = [...myBank]
  const newOppBank = [...oppBank]

  const discardElem = DiscardElements[powerId]
  if (discardElem) {
    for (let i = newOppBank.length - 1; i >= 0; i--) {
      if (newOppBank[i]!.element === discardElem) {
        newOppBank.splice(i, 1)
        break
      }
    }
    return { myBank: newMyBank, oppBank: newOppBank }
  }

  const discardColor = DiscardColors[powerId]
  if (discardColor) {
    for (let i = newOppBank.length - 1; i >= 0; i--) {
      if (newOppBank[i]!.color === discardColor) {
        newOppBank.splice(i, 1)
        break
      }
    }
  }

  return { myBank: newMyBank, oppBank: newOppBank }
}

const ALL_ELEMENTS: readonly NinjaElement[] = ['f', 'w', 's']
const ALL_COLORS: readonly CardData['color'][] = ['r', 'b', 'g', 'y', 'o', 'p']

/**
 * Elements that can complete a winning triad for the given bank across all 6 colors.
 */
export function finishingElements(bank: readonly CardData[]): ReadonlySet<NinjaElement> {
  const finishers = new Set<NinjaElement>()

  for (const element of ALL_ELEMENTS) {
    for (const color of ALL_COLORS) {
      const dummyCard: CardData = {
        id: -1,
        element,
        color,
        value: 10,
        powerId: 0,
      }
      if (checkWinCondition([...bank, dummyCard]).won) {
        finishers.add(element)
        break
      }
    }
  }

  return finishers
}

const bankPotentialCache = new Map<string, number>()

/**
 * Computes bank potential Φ ∈ [0, 1] measuring progress toward a 3-element or same-element triad.
 * Φ = max(same, tri) + 0.1 · (same + tri)
 */
export function bankPotential(bank: readonly CardData[]): number {
  if (bank.length === 0) return 0
  const key = bank
    .map((c) => `${c.element}${c.color}`)
    .sort()
    .join('')
  const cached = bankPotentialCache.get(key)
  if (cached !== undefined) return cached

  // 1. same = max_e |distinct colors in element e| / 3
  const colorsByElem: Record<NinjaElement, Set<string>> = {
    f: new Set(),
    w: new Set(),
    s: new Set(),
  }
  for (const card of bank) {
    colorsByElem[card.element].add(card.color)
  }

  const maxSameColors = Math.min(
    3,
    Math.max(
      colorsByElem.f.size,
      colorsByElem.w.size,
      colorsByElem.s.size,
    ),
  )
  const same = maxSameColors / 3

  // 2. tri = maxMatching(elements -> distinct colors) / 3
  const fColors = Array.from(colorsByElem.f)
  const wColors = Array.from(colorsByElem.w)
  const sColors = Array.from(colorsByElem.s)

  let matching = 0
  if (fColors.length > 0 || wColors.length > 0 || sColors.length > 0) {
    matching = 1
  }

  const canMatch2 = (c1: string[], c2: string[]): boolean => {
    for (const a of c1) {
      for (const b of c2) {
        if (a !== b) return true
      }
    }
    return false
  }
  if (canMatch2(fColors, wColors) || canMatch2(fColors, sColors) || canMatch2(wColors, sColors)) {
    matching = 2
  }

  let canMatch3 = false
  for (const f of fColors) {
    for (const w of wColors) {
      if (w === f) continue
      for (const s of sColors) {
        if (s !== f && s !== w) {
          canMatch3 = true
          break
        }
      }
      if (canMatch3) break
    }
    if (canMatch3) break
  }
  if (canMatch3) {
    matching = 3
  }

  const tri = matching / 3
  const phi = Math.max(same, tri) + 0.1 * (same + tri)
  bankPotentialCache.set(key, phi)
  return phi
}

function computeValueDistribution(element: NinjaElement) {
  const cards = NORMAL_POOL.filter((c) => c.element === element)
  const n = Math.max(1, cards.length)
  const values = cards.map((c) => c.value).sort((a, b) => a - b)

  return {
    values,
    pWin: (val: number) => cards.filter((c) => c.value < val).length / n,
    pTie: (val: number) => cards.filter((c) => c.value === val).length / n,
    pLoss: (val: number) => cards.filter((c) => c.value > val).length / n,
  }
}

export const VALUE_CDF_BY_ELEMENT: Readonly<Record<NinjaElement, ReturnType<typeof computeValueDistribution>>> = {
  f: computeValueDistribution('f'),
  w: computeValueDistribution('w'),
  s: computeValueDistribution('s'),
}

/**
 * Evaluates win/tie/loss probabilities for same-element clashes taking active rules into account:
 * - Applies valueDelta = [me, opp] to shift the effective value difference.
 * - Inverts win/loss probabilities when lowestWins is true.
 */
export function sameElementOutcome(
  v: number,
  e: NinjaElement,
  rules: EffectiveRules,
): { win: number; tie: number; loss: number } {
  const dist = VALUE_CDF_BY_ELEMENT[e]
  const netVal = v + rules.valueDelta[0] - rules.valueDelta[1]

  if (rules.lowestWins) {
    return {
      win: dist.pLoss(netVal),
      tie: dist.pTie(netVal),
      loss: dist.pWin(netVal),
    }
  }

  return {
    win: dist.pWin(netVal),
    tie: dist.pTie(netVal),
    loss: dist.pLoss(netVal),
  }
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
export function resolveClashUI(
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

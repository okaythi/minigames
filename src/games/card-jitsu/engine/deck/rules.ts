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

export const RuleSet = RULE_SET

export const DiscardElements: Record<number, NinjaElement> = {
  4: 's',
  5: 'w',
  6: 'f',
}

export const DiscardColors: Record<number, string> = {
  7: 'r',
  8: 'b',
  9: 'g',
  10: 'y',
  11: 'o',
  12: 'p',
}

export const Replacements: Record<number, readonly [NinjaElement, NinjaElement]> = {
  16: ['w', 'f'],
  17: ['s', 'w'],
  18: ['f', 's'],
}

export const PowerLimiters: Record<number, NinjaElement> = {
  13: 's',
  14: 'f',
  15: 'w',
}

export const OnPlayed = new Set<number>([1, 16, 17, 18])
export const CurrentRound = new Set<number>([4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18])
export const AffectsOwnPlayer = new Set<number>([2])

export interface ActivePowerCard {
  readonly powerId: number
  readonly player: number
  readonly opponent: number
  readonly card: CardData
}

export interface ActiveCardState {
  element: NinjaElement
  value: number
  readonly card: CardData
  readonly player: number
  readonly opponent: number
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

/**
 * Houdini adjust_card_values:
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
 * Houdini on_played_effects:
 * Powers 16, 17, 18 replace elements immediately. Power 1 stored for next round.
 */
export function onPlayedEffects(
  firstCard: ActiveCardState,
  secondCard: ActiveCardState,
  powers: Map<number, ActivePowerCard>,
): void {
  const cards = [firstCard, secondCard]
  for (const played of cards) {
    const powerId = played.card.powerId
    if (!powerId || !OnPlayed.has(powerId)) continue
    const currentRound = CurrentRound.has(powerId)
    if (!currentRound) {
      powers.set(powerId, {
        powerId,
        player: played.player,
        opponent: played.opponent,
        card: played.card,
      })
    } else {
      const rep = Replacements[powerId]
      if (rep) {
        const [original, replacement] = rep
        if (firstCard.element === original) firstCard.element = replacement
        if (secondCard.element === original) secondCard.element = replacement
      }
    }
  }
}

/**
 * Houdini get_winner_seat_id:
 * Element superiority (RuleSet), then numeric value comparison. Returns winning seat or -1 on tie.
 */
export function getWinnerSeatId(
  firstCard: ActiveCardState,
  secondCard: ActiveCardState,
): number {
  if (firstCard.element !== secondCard.element) {
    return RuleSet[firstCard.element] === secondCard.element
      ? firstCard.player
      : secondCard.player
  }
  if (firstCard.value > secondCard.value) return firstCard.player
  if (secondCard.value > firstCard.value) return secondCard.player
  return -1
}

/**
 * Discards a card from opponent's bank matching power conditions.
 */
export function discardOpponentCard(
  powerId: number,
  bank: CardData[],
  discards: number[],
  dealtCards: { dealtId: number; card: CardData }[],
): boolean {
  const elem = DiscardElements[powerId]
  if (elem) {
    for (let i = bank.length - 1; i >= 0; i--) {
      if (bank[i]!.element === elem) {
        const discarded = bank.splice(i, 1)[0]!
        const dIdx = dealtCards.findIndex((d) => d.card.id === discarded.id)
        if (dIdx !== -1) {
          discards.push(dealtCards[dIdx]!.dealtId)
          dealtCards.splice(dIdx, 1)
        } else {
          discards.push(discarded.id)
        }
        return true
      }
    }
  }
  const color = DiscardColors[powerId]
  if (color) {
    for (let i = bank.length - 1; i >= 0; i--) {
      if (bank[i]!.color === color) {
        const discarded = bank.splice(i, 1)[0]!
        const dIdx = dealtCards.findIndex((d) => d.card.id === discarded.id)
        if (dIdx !== -1) {
          discards.push(dealtCards[dIdx]!.dealtId)
          dealtCards.splice(dIdx, 1)
        } else {
          discards.push(discarded.id)
        }
        return true
      }
    }
  }
  return false
}

/**
 * Houdini on_scored_effects:
 * Powers 2, 3, 13, 14, 15 stored for next round; powers 4–12 discard opponent cards.
 */
export function onScoredEffects(
  winnerSeatId: number,
  firstCard: ActiveCardState,
  secondCard: ActiveCardState,
  powers: Map<number, ActivePowerCard>,
  opponentBank: CardData[],
  discards: number[],
  opponentDealtCards: { dealtId: number; card: CardData }[],
): void {
  if (winnerSeatId === -1) return
  const winnerCard = firstCard.player === winnerSeatId ? firstCard : secondCard
  const powerId = winnerCard.card.powerId
  if (!powerId || OnPlayed.has(powerId)) return

  const currentRound = CurrentRound.has(powerId)
  if (!currentRound) {
    powers.set(powerId, {
      powerId,
      player: winnerCard.player,
      opponent: winnerCard.opponent,
      card: winnerCard.card,
    })
  } else {
    discardOpponentCard(powerId, opponentBank, discards, opponentDealtCards)
  }
}

/**
 * Houdini has_cards_to_play:
 * Checks if PowerLimiters (13: 's', 14: 'f', 15: 'w') lockout opponent.
 */
export function hasCardsToPlay(
  seatId: number,
  hand: readonly { dealtId: number; card: CardData }[],
  powers: ReadonlyMap<number, ActivePowerCard>,
): boolean {
  for (const [powerIdStr, limiterElem] of Object.entries(PowerLimiters)) {
    const powerId = Number(powerIdStr)
    const powerCard = powers.get(powerId)
    if (powerCard && powerCard.opponent === seatId) {
      for (const item of hand) {
        if (item.card.element !== limiterElem) {
          return true
        }
      }
      return false
    }
  }
  return true
}

/**
 * Houdini get_winning_cards:
 * Returns dealtIds of winning triad and method ('same-element' or 'three-elements').
 */
export function getWinningCombo(
  wonDealtCards: readonly { dealtId: number; card: CardData }[],
): { winningDealtIds: number[]; winMethod: 'same-element' | 'three-elements' } | null {
  const byElem: Record<NinjaElement, { dealtId: number; card: CardData }[]> = {
    f: [],
    w: [],
    s: [],
  }
  for (const item of wonDealtCards) {
    byElem[item.card.element].push(item)
  }

  // 1. Same element, 3 distinct colors
  for (const elem of ['f', 'w', 's'] as const) {
    const cards = byElem[elem]
    const colorCards: { dealtId: number; card: CardData }[] = []
    const usedColors = new Set<string>()
    for (const item of cards) {
      if (!usedColors.has(item.card.color)) {
        usedColors.add(item.card.color)
        colorCards.push(item)
        if (colorCards.length === 3) {
          return {
            winningDealtIds: colorCards.map((c) => c.dealtId),
            winMethod: 'same-element',
          }
        }
      }
    }
  }

  // 2. Three different elements, 3 distinct colors
  for (const f of byElem.f) {
    for (const w of byElem.w) {
      if (f.card.color === w.card.color) continue
      for (const s of byElem.s) {
        if (s.card.color === f.card.color || s.card.color === w.card.color) continue
        return {
          winningDealtIds: [f.dealtId, w.dealtId, s.dealtId],
          winMethod: 'three-elements',
        }
      }
    }
  }

  return null
}

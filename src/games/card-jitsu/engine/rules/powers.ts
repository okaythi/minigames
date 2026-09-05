import type { CardData, NinjaElement } from '../../types'

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

export const DiscardElements: Readonly<Record<number, NinjaElement>> = {
  4: 's',
  5: 'w',
  6: 'f',
}

export const DiscardColors: Readonly<Record<number, string>> = {
  7: 'r',
  8: 'b',
  9: 'g',
  10: 'y',
  11: 'o',
  12: 'p',
}

export const Replacements: Readonly<Record<number, readonly [NinjaElement, NinjaElement]>> = {
  16: ['w', 'f'],
  17: ['s', 'w'],
  18: ['f', 's'],
}

export const PowerLimiters: Readonly<Record<number, NinjaElement>> = {
  13: 's',
  14: 'f',
  15: 'w',
}

export const OnPlayed = new Set<number>([1, 16, 17, 18])
export const CurrentRound = new Set<number>([4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18])
export const AffectsOwnPlayer = new Set<number>([2])

/**
 * Houdini on_played_effects (ninja.py L201-L218):
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
 * Discards a card from opponent's bank matching power conditions (ninja.py L240-L255).
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
 * Houdini on_scored_effects (ninja.py L220-L238):
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

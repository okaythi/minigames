import type { CardData, NinjaElement, WinConditionResult } from '../../types'
import { PowerLimiters, type ActivePowerCard } from './powers'

/**
 * Houdini has_cards_to_play (ninja.py L280-L287):
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
 * Houdini get_winning_cards (ninja.py L150-L169):
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

/**
 * Evaluates whether cards satisfy Card-Jitsu victory condition (for UI/stats).
 */
export function checkWinCondition(wonCards: readonly CardData[]): WinConditionResult {
  if (wonCards.length < 3) {
    return { won: false, winningCards: [] }
  }
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

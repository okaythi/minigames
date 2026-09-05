import type { CardData, NinjaElement } from '../../types'
import { RULE_SET, beatsCard, checkWinCondition } from '../deck/rules'
import type { DealtCard } from '../gateway/session'

export interface ActivePowerState {
  readonly powerId: number
  readonly player: number
  readonly opponent: number
  readonly card: CardData
}

export interface BotContext {
  readonly hand: readonly DealtCard[]
  readonly myBank: readonly CardData[]
  readonly oppBank: readonly CardData[]
  readonly oppHand?: readonly DealtCard[]
  readonly oppHistory: readonly CardData[]
  readonly activePowers: ReadonlyMap<number, ActivePowerState>
}

export interface BotPolicy {
  pick(ctx: BotContext): number
}

function wouldWinTriad(bank: readonly CardData[], newCard: CardData): boolean {
  const simulated = [...bank, newCard]
  return checkWinCondition(simulated).won
}

function randomPick(hand: readonly DealtCard[]): number {
  const idx = Math.floor(Math.random() * hand.length)
  return hand[idx]!.dealtId
}

/**
 * Tier 1–2 Policy: Uniform random selection
 */
export class UniformRandomPolicy implements BotPolicy {
  pick(ctx: BotContext): number {
    return randomPick(ctx.hand)
  }
}

/**
 * Tier 3–5 Policy: Greedy heuristic
 * 1. Complete own combo
 * 2. Deny opponent's combo
 * 3. Prefer higher value
 * 4. Hold power cards until useful
 * mistakeRate = 0.20
 */
export class GreedyHeuristicPolicy implements BotPolicy {
  constructor(private readonly mistakeRate: number = 0.2) {}

  pick(ctx: BotContext): number {
    if (ctx.hand.length === 0) return 0
    if (Math.random() < this.mistakeRate) {
      return randomPick(ctx.hand)
    }

    // 1. Check if any card completes our own winning triad
    for (const card of ctx.hand) {
      if (wouldWinTriad(ctx.myBank, card.card)) {
        return card.dealtId
      }
    }

    // 2. Check if opponent is 1 card away from winning, and deny that element
    const allElements: readonly NinjaElement[] = ['f', 'w', 's']
    const elementsOppNeeds: NinjaElement[] = []
    for (const elem of allElements) {
      const dummyCard: CardData = {
        id: 0,
        element: elem,
        value: 10,
        color: 'r',
        powerId: 0,
      }
      if (wouldWinTriad(ctx.oppBank, dummyCard)) {
        elementsOppNeeds.push(elem)
      }
    }

    if (elementsOppNeeds.length > 0) {
      // Find cards that beat the element the opponent needs
      const counters = ctx.hand.filter((c) =>
        elementsOppNeeds.some((oppElem) => RULE_SET[c.card.element] === oppElem),
      )
      if (counters.length > 0) {
        counters.sort((a, b) => b.card.value - a.card.value)
        return counters[0]!.dealtId
      }
    }

    // 3. Prefer higher value, saving power cards if value is lower
    const scored = [...ctx.hand].sort((a, b) => {
      const aVal = a.card.value - (a.card.powerId > 0 ? 0.5 : 0)
      const bVal = b.card.value - (b.card.powerId > 0 ? 0.5 : 0)
      return bVal - aVal
    })

    return scored[0]!.dealtId
  }
}

/**
 * Tier 6–8 Policy: Greedy + Opponent frequency model
 * Evaluates expected value over modeled player element distribution.
 * mistakeRate = 0.10
 */
export class OpponentModelPolicy implements BotPolicy {
  constructor(private readonly mistakeRate: number = 0.1) {}

  pick(ctx: BotContext): number {
    if (ctx.hand.length === 0) return 0
    if (Math.random() < this.mistakeRate) {
      return randomPick(ctx.hand)
    }

    // 1. Immediate win check
    for (const card of ctx.hand) {
      if (wouldWinTriad(ctx.myBank, card.card)) {
        return card.dealtId
      }
    }

    // 2. Opponent frequency model
    const counts: Record<NinjaElement, number> = { f: 1, w: 1, s: 1 }
    for (const played of ctx.oppHistory) {
      counts[played.element] = (counts[played.element] ?? 0) + 1
    }
    const total = counts.f + counts.w + counts.s
    const prob: Record<NinjaElement, number> = {
      f: counts.f / total,
      w: counts.w / total,
      s: counts.s / total,
    }

    let bestDealtId = ctx.hand[0]!.dealtId
    let bestScore = -Infinity

    for (const candidate of ctx.hand) {
      let ev = 0
      const cElem = candidate.card.element
      for (const elem of ['f', 'w', 's'] as const) {
        const p = prob[elem]
        if (RULE_SET[cElem] === elem) {
          ev += p * 1.2
        } else if (RULE_SET[elem] === cElem) {
          ev -= p * 1.2
        } else {
          ev += p * (candidate.card.value / 12)
        }
      }

      if (candidate.card.powerId > 0) {
        ev += 0.3
      }

      if (ev > bestScore) {
        bestScore = ev
        bestDealtId = candidate.dealtId
      }
    }

    return bestDealtId
  }
}

/**
 * Tier 9 Policy: One-ply Expectimax with peeking at oppHand
 * mistakeRate = 0.05
 */
export class ExpectimaxPolicy implements BotPolicy {
  constructor(private readonly mistakeRate: number = 0.05) {}

  pick(ctx: BotContext): number {
    if (ctx.hand.length === 0) return 0
    if (Math.random() < this.mistakeRate) {
      return randomPick(ctx.hand)
    }

    // Immediate win
    for (const card of ctx.hand) {
      if (wouldWinTriad(ctx.myBank, card.card)) {
        return card.dealtId
      }
    }

    const oppCards = ctx.oppHand && ctx.oppHand.length > 0 ? ctx.oppHand : ctx.hand

    let bestDealtId = ctx.hand[0]!.dealtId
    let bestUtility = -Infinity

    for (const myCard of ctx.hand) {
      let utility = 0
      for (const oppCard of oppCards) {
        if (beatsCard(myCard.card, oppCard.card)) {
          utility += 2.0
          if (wouldWinTriad(ctx.myBank, myCard.card)) {
            utility += 5.0
          }
        } else if (beatsCard(oppCard.card, myCard.card)) {
          utility -= 2.0
          if (wouldWinTriad(ctx.oppBank, oppCard.card)) {
            utility -= 5.0
          }
        } else {
          utility += 0.1
        }
      }

      if (utility > bestUtility) {
        bestUtility = utility
        bestDealtId = myCard.dealtId
      }
    }

    return bestDealtId
  }
}

/**
 * Creates the authentic bot policy for a given belt rank.
 */
export function createBotPolicy(
  botRank: number,
  mistakeRateOverride?: number,
): BotPolicy {
  if (botRank <= 2) {
    return new UniformRandomPolicy()
  }
  if (botRank <= 5) {
    return new GreedyHeuristicPolicy(mistakeRateOverride ?? 0.2)
  }
  if (botRank <= 8) {
    return new OpponentModelPolicy(mistakeRateOverride ?? 0.1)
  }
  return new ExpectimaxPolicy(mistakeRateOverride ?? 0.05)
}

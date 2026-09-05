import type { CardData } from '../../types'
import {
  checkWinCondition,
  resolveClash,
  advancePowers,
  discardOpponentCard,
  type ActivePowerState,
} from '../rules'
import { BOT_TIERS } from '../opponents/tiers'
import { BotDeck } from '../opponents/bot-deck'
import {
  createBotPolicy,
  UniformRandomPolicy,
  type BotContext,
  type BotPolicy,
} from './bot-policy'

export interface SimMatchResult {
  readonly winner: 'a' | 'b' | 'draw'
  readonly rounds: number
}

export interface MatchupStats {
  readonly rankA: number | string
  readonly rankB: number | string
  readonly matches: number
  readonly winsA: number
  readonly winsB: number
  readonly draws: number
  readonly winRateA: number
  readonly winRateB: number
}

export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Headless match simulation per §6:
 * Uses resolveClash + checkWinCondition directly (no MatchFlow/Flash).
 * Uses identical rank-9 decks at τ = 0.5 for both sides to isolate skill.
 */
export function simulateHeadlessMatch(
  policyA: BotPolicy,
  policyB: BotPolicy,
  options: {
    maxRounds?: number
    rng?: () => number
  } = {},
): SimMatchResult {
  const rng = options.rng ?? Math.random
  const maxRounds = options.maxRounds ?? 100

  const tier9 = BOT_TIERS[9]
  const deckA = new BotDeck(tier9, 0.5, rng)
  const deckB = new BotDeck(tier9, 0.5, rng)

  const handA: { dealtId: number; card: CardData }[] = []
  const handB: { dealtId: number; card: CardData }[] = []
  const bankA: CardData[] = []
  const bankB: CardData[] = []
  const historyA: CardData[] = []
  const historyB: CardData[] = []

  let powers: ReadonlyMap<number, ActivePowerState> = new Map<number, ActivePowerState>()
  let nextDealtId = 1
  let round = 1

  while (round <= maxRounds) {
    const needA = 5 - handA.length
    if (needA > 0) {
      for (const card of deckA.draw(needA)) {
        handA.push({ dealtId: nextDealtId++, card })
      }
    }
    const needB = 5 - handB.length
    if (needB > 0) {
      for (const card of deckB.draw(needB)) {
        handB.push({ dealtId: nextDealtId++, card })
      }
    }

    if (handA.length === 0 && handB.length === 0) return { winner: 'draw', rounds: round }
    if (handA.length === 0) return { winner: 'b', rounds: round }
    if (handB.length === 0) return { winner: 'a', rounds: round }

    const ctxA: BotContext = {
      hand: handA,
      myBank: bankA,
      oppBank: bankB,
      oppHistory: historyB,
      myHistory: historyA,
      activePowers: powers,
      round,
      rng,
    }

    const ctxB: BotContext = {
      hand: handB,
      myBank: bankB,
      oppBank: bankA,
      oppHistory: historyA,
      myHistory: historyB,
      activePowers: powers,
      round,
      rng,
    }

    const pickAId = policyA.pick(ctxA)
    const pickBId = policyB.pick(ctxB)

    const idxA = handA.findIndex((c) => c.dealtId === pickAId)
    const cardAItem = idxA !== -1 ? handA.splice(idxA, 1)[0]! : handA.shift()!

    const idxB = handB.findIndex((c) => c.dealtId === pickBId)
    const cardBItem = idxB !== -1 ? handB.splice(idxB, 1)[0]! : handB.shift()!

    const cardA = cardAItem.card
    const cardB = cardBItem.card

    historyA.push(cardA)
    historyB.push(cardB)

    const clashWinner = resolveClash(cardA, cardB, powers)
    let scoredCard: { seat: number; card: CardData } | null = null

    if (clashWinner === 1) {
      bankA.push(cardA)
      if (cardA.powerId !== 0) {
        const oppDealt = bankB.map((c, i) => ({ dealtId: i, card: c }))
        discardOpponentCard(cardA.powerId, bankB, [], oppDealt)
      }
      if (checkWinCondition(bankA).won) {
        return { winner: 'a', rounds: round }
      }
      scoredCard = { seat: 1, card: cardA }
    } else if (clashWinner === -1) {
      bankB.push(cardB)
      if (cardB.powerId !== 0) {
        const oppDealt = bankA.map((c, i) => ({ dealtId: i, card: c }))
        discardOpponentCard(cardB.powerId, bankA, [], oppDealt)
      }
      if (checkWinCondition(bankB).won) {
        return { winner: 'b', rounds: round }
      }
      scoredCard = { seat: 0, card: cardB }
    }

    powers = advancePowers(
      powers,
      [
        { seat: 1, card: cardA },
        { seat: 0, card: cardB },
      ],
      scoredCard,
    )
    round++
  }

  return { winner: 'draw', rounds: round }
}

export function runMatchupSimulations(
  rankOrPolicyA: number | BotPolicy,
  rankOrPolicyB: number | BotPolicy,
  matches = 2000,
  options?: { rng?: () => number },
): MatchupStats {
  const policyA = typeof rankOrPolicyA === 'number' ? createBotPolicy(rankOrPolicyA) : rankOrPolicyA
  const policyB = typeof rankOrPolicyB === 'number' ? createBotPolicy(rankOrPolicyB) : rankOrPolicyB

  let winsA = 0
  let winsB = 0
  let draws = 0

  for (let i = 0; i < matches; i++) {
    const res = simulateHeadlessMatch(policyA, policyB, options)
    if (res.winner === 'a') winsA++
    else if (res.winner === 'b') winsB++
    else draws++
  }

  return {
    rankA: typeof rankOrPolicyA === 'number' ? rankOrPolicyA : policyA instanceof UniformRandomPolicy ? 'Random' : 'PolicyA',
    rankB: typeof rankOrPolicyB === 'number' ? rankOrPolicyB : policyB instanceof UniformRandomPolicy ? 'Random' : 'PolicyB',
    matches,
    winsA,
    winsB,
    draws,
    winRateA: matches > 0 ? winsA / matches : 0,
    winRateB: matches > 0 ? winsB / matches : 0,
  }
}

import type { CardData, NinjaElement } from '../../types'
import {
  doesElementBeat,
  checkWinCondition,
  finishingElements,
  bankPotential,
  applyPowerToBanks,
  VALUE_CDF_BY_ELEMENT,
} from '../rules'
import type { DealtCard } from '../gateway/match-flow'
import { BOT_TIERS, type PolicyParams } from '../opponents/tiers'

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
  readonly oppHistory: readonly CardData[] // resolved clashes only; EXCLUDES current round's pick
  readonly myHistory: readonly CardData[]
  readonly activePowers: ReadonlyMap<number, ActivePowerState>
  readonly round: number
  readonly rng: () => number
}

export interface BotPolicy {
  pick(ctx: BotContext): number
}

function wouldWinTriad(bank: readonly CardData[], newCard: CardData): boolean {
  return checkWinCondition([...bank, newCard]).won
}

function bankKey(bank: readonly CardData[]): string {
  return bank
    .map((c) => `${c.element}${c.color}`)
    .sort()
    .join('')
}

/**
 * Tier 1–2 Policy: Uniform random selection
 */
export class UniformRandomPolicy implements BotPolicy {
  pick(ctx: BotContext): number {
    if (ctx.hand.length === 0) return 0
    const idx = Math.floor(ctx.rng() * ctx.hand.length)
    return ctx.hand[idx]!.dealtId
  }
}

const ALL_ELEMENTS: readonly NinjaElement[] = ['f', 'w', 's']
const ALL_COLORS: readonly CardData['color'][] = ['r', 'b', 'g', 'y', 'o', 'p']
const W_TRIAD = 10
const BASE = 1
const EPSILON = 0.05
const DISCOUNT = 0.9

/**
 * Parameterized strategic Card-Jitsu AI with Expectimax search,
 * recency-weighted opponent modeling, and zero-information leakage.
 */
export class StrategicPolicy implements BotPolicy {
  constructor(public readonly params: PolicyParams) {}

  pick(ctx: BotContext): number {
    if (ctx.hand.length === 0) return 0
    if (ctx.hand.length === 1) return ctx.hand[0]!.dealtId

    // 1. Immediate-win shortcut: all ranks >= 3 play an immediate winning triad
    for (const item of ctx.hand) {
      if (wouldWinTriad(ctx.myBank, item.card)) {
        return item.dealtId
      }
    }

    // 2. Compute opponent elemental distribution P(e)
    const pOpp = this.computeOpponentDistribution(ctx)

    // 3. Score each candidate card in hand via Expectimax search
    const memo = new Map<string, number>()
    const utilities: { dealtId: number; utility: number }[] = []

    for (const item of ctx.hand) {
      const u = this.evaluateCandidate(
        item.card,
        ctx.hand.filter((c) => c.dealtId !== item.dealtId).map((c) => c.card),
        ctx.myBank,
        ctx.oppBank,
        pOpp,
        this.params.horizon,
        memo,
      )
      utilities.push({ dealtId: item.dealtId, utility: u })
    }

    // 4. Action selection based on precision parameter
    if (this.params.precision === Infinity) {
      // Argmax with uniform tie-break among candidates within ε of max
      let maxU = -Infinity
      for (const u of utilities) {
        if (u.utility > maxU) maxU = u.utility
      }
      const candidates = utilities.filter((u) => u.utility >= maxU - EPSILON)
      const chosenIdx = Math.floor(ctx.rng() * candidates.length)
      return candidates[chosenIdx]!.dealtId
    }

    // Softmax selection: P(c) ∝ exp(precision * U(c))
    let maxU = -Infinity
    for (const u of utilities) {
      if (u.utility > maxU) maxU = u.utility
    }

    const expWeights: number[] = []
    let totalWeight = 0
    for (const u of utilities) {
      const w = Math.exp(this.params.precision * (u.utility - maxU))
      expWeights.push(w)
      totalWeight += w
    }

    let threshold = ctx.rng() * totalWeight
    for (let i = 0; i < utilities.length; i++) {
      threshold -= expWeights[i]!
      if (threshold <= 0) {
        return utilities[i]!.dealtId
      }
    }

    return utilities[utilities.length - 1]!.dealtId
  }

  private computeOpponentDistribution(ctx: BotContext): Record<NinjaElement, number> {
    // 1. Recency-weighted Dirichlet: prior 1 each; add γ^age per history card, γ = 0.7
    const counts: Record<NinjaElement, number> = { f: 1, w: 1, s: 1 }
    const gamma = 0.7
    const histLen = ctx.oppHistory.length

    for (let i = 0; i < histLen; i++) {
      const card = ctx.oppHistory[i]!
      const age = histLen - 1 - i
      counts[card.element] += Math.pow(gamma, age)
    }

    let total = counts.f + counts.w + counts.s
    let p: Record<NinjaElement, number> = {
      f: counts.f / total,
      w: counts.w / total,
      s: counts.s / total,
    }

    // 2. Rational overlay, weight s = modelStrength
    const s = this.params.modelStrength
    if (s > 0) {
      const oppFinishers = finishingElements(ctx.oppBank)
      if (oppFinishers.size > 0) {
        const uVal = 1 / oppFinishers.size
        p = {
          f: (1 - s) * p.f + (oppFinishers.has('f') ? s * uVal : 0),
          w: (1 - s) * p.w + (oppFinishers.has('w') ? s * uVal : 0),
          s: (1 - s) * p.s + (oppFinishers.has('s') ? s * uVal : 0),
        }
      } else {
        const myFinishers = finishingElements(ctx.myBank)
        if (myFinishers.size > 0) {
          // Find elements that beat our finishing elements: B = { e : e beats g, g ∈ G }
          const blockers = new Set<NinjaElement>()
          for (const elem of ALL_ELEMENTS) {
            for (const g of myFinishers) {
              if (doesElementBeat(elem, g)) {
                blockers.add(elem)
              }
            }
          }
          if (blockers.size > 0) {
            const uVal = 1 / blockers.size
            const halfS = s / 2
            p = {
              f: (1 - halfS) * p.f + (blockers.has('f') ? halfS * uVal : 0),
              w: (1 - halfS) * p.w + (blockers.has('w') ? halfS * uVal : 0),
              s: (1 - halfS) * p.s + (blockers.has('s') ? halfS * uVal : 0),
            }
          }
        }
      }
    }

    // 3. Normalize
    total = p.f + p.w + p.s
    return {
      f: p.f / total,
      w: p.w / total,
      s: p.s / total,
    }
  }

  private evaluateCandidate(
    candidate: CardData,
    remainingHand: readonly CardData[],
    myBank: readonly CardData[],
    oppBank: readonly CardData[],
    pOpp: Record<NinjaElement, number>,
    horizon: number,
    memo: Map<string, number>,
  ): number {
    let expectedUtility = 0

    for (const oppElem of ALL_ELEMENTS) {
      const pE = pOpp[oppElem]
      if (pE <= 0) continue

      const clashOutcome = this.evaluateClashVsElement(
        candidate,
        oppElem,
        remainingHand,
        myBank,
        oppBank,
        pOpp,
        horizon,
        memo,
      )
      expectedUtility += pE * clashOutcome
    }

    return expectedUtility
  }

  private evaluateClashVsElement(
    candidate: CardData,
    oppElem: NinjaElement,
    remainingHand: readonly CardData[],
    myBank: readonly CardData[],
    oppBank: readonly CardData[],
    pOpp: Record<NinjaElement, number>,
    horizon: number,
    memo: Map<string, number>,
  ): number {
    // Win outcome evaluation
    const evalWin = (): number => {
      if (checkWinCondition([...myBank, candidate]).won) {
        return W_TRIAD
      }
      let simMy = [...myBank, candidate]
      let simOpp = [...oppBank]
      if (candidate.powerId !== 0) {
        const sim = applyPowerToBanks(candidate.powerId, simMy, simOpp)
        simMy = sim.myBank
        simOpp = sim.oppBank
      }
      const deltaMe = bankPotential(simMy) - bankPotential(myBank)
      const immediateScore = BASE + deltaMe

      if (horizon <= 0 || remainingHand.length === 0) {
        return immediateScore
      }

      // Plies beyond: recursive expectimax
      const nextU = this.searchMax(remainingHand, simMy, simOpp, pOpp, horizon - 1, memo)
      return immediateScore + DISCOUNT * nextU
    }

    // Loss outcome evaluation: worst-case opponent color c*
    const evalLoss = (): number => {
      const worst = this.getWorstCaseOpponentCard(oppBank, oppElem)
      if (worst.wouldWin) {
        return -W_TRIAD
      }
      const simOpp = [...oppBank, worst.card]
      const deltaOpp = bankPotential(simOpp) - bankPotential(oppBank)
      const immediateScore = -BASE - deltaOpp

      if (horizon <= 0 || remainingHand.length === 0) {
        return immediateScore
      }

      const nextU = this.searchMax(remainingHand, myBank, simOpp, pOpp, horizon - 1, memo)
      return immediateScore + DISCOUNT * nextU
    }

    // Resolve based on elemental rules
    if (doesElementBeat(candidate.element, oppElem)) {
      return evalWin()
    }
    if (doesElementBeat(oppElem, candidate.element)) {
      return evalLoss()
    }

    // Same element: integrate over VALUE_CDF_BY_ELEMENT
    const dist = VALUE_CDF_BY_ELEMENT[oppElem]
    const pWin = dist.pWin(candidate.value)
    const pTie = dist.pTie(candidate.value)
    const pLoss = dist.pLoss(candidate.value)

    // Immediate payoffs
    const wouldWinMe = checkWinCondition([...myBank, candidate]).won
    let simMy = [...myBank, candidate]
    let simOppAfterMe = [...oppBank]
    if (candidate.powerId !== 0) {
      const sim = applyPowerToBanks(candidate.powerId, simMy, simOppAfterMe)
      simMy = sim.myBank
      simOppAfterMe = sim.oppBank
    }
    const winPayoff = wouldWinMe ? W_TRIAD : BASE + (bankPotential(simMy) - bankPotential(myBank))

    const worst = this.getWorstCaseOpponentCard(oppBank, oppElem)
    const lossPayoff = worst.wouldWin ? -W_TRIAD : -BASE - (bankPotential([...oppBank, worst.card]) - bankPotential(oppBank))
    const tiePayoff = 0

    const expectedImmediate = pWin * winPayoff + pLoss * lossPayoff + pTie * tiePayoff

    if (horizon <= 0 || remainingHand.length === 0) {
      return expectedImmediate
    }

    // State transition applies the assumed outcome per §3.5
    let nextMy = myBank
    let nextOpp = oppBank
    if (pWin > pLoss) {
      nextMy = simMy
      nextOpp = simOppAfterMe
    } else if (pLoss > pWin) {
      nextOpp = [...oppBank, worst.card]
    }

    const nextU = this.searchMax(remainingHand, nextMy, nextOpp, pOpp, horizon - 1, memo)
    return expectedImmediate + DISCOUNT * nextU
  }

  private searchMax(
    hand: readonly CardData[],
    myBank: readonly CardData[],
    oppBank: readonly CardData[],
    pOpp: Record<NinjaElement, number>,
    horizon: number,
    memo: Map<string, number>,
  ): number {
    if (hand.length === 0 || checkWinCondition(myBank).won || checkWinCondition(oppBank).won) {
      if (checkWinCondition(myBank).won) return W_TRIAD
      if (checkWinCondition(oppBank).won) return -W_TRIAD
      return bankPotential(myBank) - bankPotential(oppBank)
    }

    const stateKey = `${horizon}:${hand.map((c) => c.id).sort((a, b) => a - b).join(',')}:${bankKey(myBank)}:${bankKey(oppBank)}`
    const cached = memo.get(stateKey)
    if (cached !== undefined) return cached

    let maxVal = -Infinity
    for (const card of hand) {
      const nextHand = hand.filter((c) => c.id !== card.id)
      const u = this.evaluateCandidate(card, nextHand, myBank, oppBank, pOpp, horizon, memo)
      if (u > maxVal) maxVal = u
    }

    memo.set(stateKey, maxVal)
    return maxVal
  }

  private worstCaseMemo = new Map<string, { card: CardData; wouldWin: boolean }>()

  private getWorstCaseOpponentCard(
    oppBank: readonly CardData[],
    element: NinjaElement,
  ): { card: CardData; wouldWin: boolean } {
    const key = `${element}:${bankKey(oppBank)}`
    const cached = this.worstCaseMemo.get(key)
    if (cached !== undefined) return cached

    let maxDelta = -Infinity
    let bestCard: CardData = { id: -1, element, color: 'r', value: 10, powerId: 0 }
    const basePhi = bankPotential(oppBank)

    for (const color of ALL_COLORS) {
      const candidate: CardData = { id: -1, element, color, value: 10, powerId: 0 }
      if (checkWinCondition([...oppBank, candidate]).won) {
        const res = { card: candidate, wouldWin: true }
        this.worstCaseMemo.set(key, res)
        return res
      }
      const delta = bankPotential([...oppBank, candidate]) - basePhi
      if (delta > maxDelta) {
        maxDelta = delta
        bestCard = candidate
      }
    }

    const res = { card: bestCard, wouldWin: false }
    this.worstCaseMemo.set(key, res)
    return res
  }
}

/**
 * Creates the authoritative bot policy for a given belt rank per BOT_TIERS.
 */
export function createBotPolicy(rank: number): BotPolicy {
  const clampedRank = Math.max(1, Math.min(9, Math.floor(rank))) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  const tier = BOT_TIERS[clampedRank]
  if (tier.policy === 'random') {
    return new UniformRandomPolicy()
  }
  return new StrategicPolicy(tier.policy)
}

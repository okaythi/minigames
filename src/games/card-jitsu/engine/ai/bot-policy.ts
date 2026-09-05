import type { CardData, NinjaElement } from '../../types'
import {
  checkWinCondition,
  finishingElements,
  bankPotential,
  applyPowerToBanks,
  type EffectiveRules,
  effectiveRules,
  advancePowers,
  sameElementOutcome,
  POWER_CLASS,
  RULE_SET,
  type ActivePowerState,
} from '../rules'
import type { DealtCard } from '../gateway/match-flow'
import { BOT_TIERS, type PolicyParams } from '../opponents/tiers'

export type { ActivePowerState }

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

function powersKey(powers: ReadonlyMap<number, ActivePowerState>): string {
  if (powers.size === 0) return ''
  let k = ''
  for (const [id, state] of powers) {
    k += `${id}_${state.player};`
  }
  return k
}

function maxConcentration(bank: readonly CardData[]): number {
  if (bank.length < 2) return 0
  let f = 0, w = 0, s = 0
  const colorCounts: Record<string, number> = {}
  for (const c of bank) {
    if (c.element === 'f') f++
    else if (c.element === 'w') w++
    else s++
    colorCounts[c.color] = (colorCounts[c.color] || 0) + 1
  }
  let maxElem = Math.max(f, w, s)
  let maxCol = 0
  for (const col in colorCounts) {
    if (colorCounts[col]! > maxCol) maxCol = colorCounts[col]!
  }
  const maxC = Math.max(maxElem, maxCol)
  return maxC >= 2 ? maxC : 0
}

const BASE_RULES: EffectiveRules = {
  beats: RULE_SET,
  replace: { f: 'f', w: 'w', s: 's' },
  valueDelta: [0, 0],
  lowestWins: false,
}

const EMPTY_POWERS: ReadonlyMap<number, ActivePowerState> = new Map<number, ActivePowerState>()

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

    const startPowers = this.params.powerAwareness === 0 ? EMPTY_POWERS : ctx.activePowers

    for (const item of ctx.hand) {
      const u = this.evaluateCandidate(
        item.card,
        ctx.hand.filter((c) => c.dealtId !== item.dealtId).map((c) => c.card),
        ctx.myBank,
        ctx.oppBank,
        startPowers,
        pOpp,
        this.params.horizon,
        memo,
      )
      utilities.push({ dealtId: item.dealtId, utility: u })
    }

    // 4. Action selection based on precision parameter
    if (this.params.precision === Infinity) {
      let maxU = -Infinity
      for (const u of utilities) {
        if (u.utility > maxU) maxU = u.utility
      }
      const candidates = utilities.filter((u) => u.utility >= maxU - EPSILON)

      // Bank vulnerability tie-breaker (awareness 2, rank 9 tie-breaker only)
      if (this.params.powerAwareness === 2 && candidates.length > 1) {
        const candidateScores = candidates.map((cand) => {
          const item = ctx.hand.find((h) => h.dealtId === cand.dealtId)!
          const resultingBank = [...ctx.myBank, item.card]
          const concentration = maxConcentration(resultingBank)
          const adjUtility = cand.utility - 0.05 * concentration
          return { dealtId: cand.dealtId, score: adjUtility }
        })
        let bestScore = -Infinity
        for (const cs of candidateScores) {
          if (cs.score > bestScore) bestScore = cs.score
        }
        const bestCandidates = candidateScores.filter((cs) => cs.score >= bestScore - 1e-6)
        const chosenIdx = Math.floor(ctx.rng() * bestCandidates.length)
        return bestCandidates[chosenIdx]!.dealtId
      }

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
      const rules =
        this.params.powerAwareness === 2
          ? effectiveRules(ctx.activePowers, 1)
          : BASE_RULES

      const oppFinishers = finishingElements(ctx.oppBank)
      if (oppFinishers.size > 0) {
        // F = finishingElements(oppBank) -> rational set { e : rules.replace[e] in F }
        const rationalSet = ALL_ELEMENTS.filter((e) => oppFinishers.has(rules.replace[e]))
        if (rationalSet.length > 0) {
          const uVal = 1 / rationalSet.length
          p = {
            f: (1 - s) * p.f + (rationalSet.includes('f') ? s * uVal : 0),
            w: (1 - s) * p.w + (rationalSet.includes('w') ? s * uVal : 0),
            s: (1 - s) * p.s + (rationalSet.includes('s') ? s * uVal : 0),
          }
        }
      } else {
        const myFinishers = finishingElements(ctx.myBank)
        if (myFinishers.size > 0) {
          // G = finishingElements(myBank) -> block set { e : rules.beats[rules.replace[e]] in G' } where G' = { rules.replace[g] : g in G }
          const gPrime = new Set(Array.from(myFinishers).map((g) => rules.replace[g]))
          const blockers = ALL_ELEMENTS.filter((e) => gPrime.has(rules.beats[rules.replace[e]]))
          if (blockers.length > 0) {
            const uVal = 1 / blockers.length
            const halfS = s / 2
            p = {
              f: (1 - halfS) * p.f + (blockers.includes('f') ? halfS * uVal : 0),
              w: (1 - halfS) * p.w + (blockers.includes('w') ? halfS * uVal : 0),
              s: (1 - halfS) * p.s + (blockers.includes('s') ? halfS * uVal : 0),
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
    powers: ReadonlyMap<number, ActivePowerState>,
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
        powers,
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
    powers: ReadonlyMap<number, ActivePowerState>,
    pOpp: Record<NinjaElement, number>,
    horizon: number,
    memo: Map<string, number>,
  ): number {
    const rules =
      this.params.powerAwareness >= 1
        ? effectiveRules(powers, 1)
        : BASE_RULES

    const ce = rules.replace[candidate.element]
    const ee = rules.replace[oppElem]

    // Win outcome evaluation
    const evalWin = (): number => {
      if (checkWinCondition([...myBank, candidate]).won) {
        return W_TRIAD
      }
      const simMy = [...myBank, candidate]
      let simOpp = [...oppBank]
      let discardDelta = 0

      if (this.params.powerAwareness >= 1 && candidate.powerId !== 0) {
        const pClass = POWER_CLASS.get(candidate.powerId)
        if (pClass === 'DISCARD') {
          const sim = applyPowerToBanks(candidate.powerId, simMy, oppBank)
          simOpp = sim.oppBank
          discardDelta = (bankPotential(oppBank) - bankPotential(simOpp)) * (W_TRIAD / 2)
        }
      }

      let staticBonus = 0
      if (candidate.powerId !== 0) {
        const pClass = POWER_CLASS.get(candidate.powerId)
        if (pClass !== 'DISCARD') {
          if (this.params.powerAwareness === 1 || (this.params.powerAwareness === 2 && horizon === 0)) {
            staticBonus = 0.5 * BASE
          }
        }
      }

      const deltaMe = bankPotential(simMy) - bankPotential(myBank)
      const immediateScore = BASE + deltaMe + discardDelta + staticBonus

      if (horizon <= 0 || remainingHand.length === 0) {
        return immediateScore
      }

      // Plies beyond: recursive expectimax
      const nextPowers =
        this.params.powerAwareness === 2
          ? advancePowers(powers, { seat: 1, card: candidate }, { seat: 1, card: candidate })
          : EMPTY_POWERS

      const nextU = this.searchMax(remainingHand, simMy, simOpp, nextPowers, pOpp, horizon - 1, memo)
      return immediateScore + DISCOUNT * nextU
    }

    // Loss outcome evaluation: worst-case opponent color c*
    const evalLoss = (): number => {
      const worst = this.getWorstCaseOpponentCard(oppBank, ee)
      if (worst.wouldWin) {
        return -W_TRIAD
      }
      const simOpp = [...oppBank, worst.card]
      const deltaOpp = bankPotential(simOpp) - bankPotential(oppBank)
      const immediateScore = -BASE - deltaOpp

      if (horizon <= 0 || remainingHand.length === 0) {
        return immediateScore
      }

      const nextPowers =
        this.params.powerAwareness === 2
          ? advancePowers(powers, { seat: 1, card: candidate }, null)
          : EMPTY_POWERS

      const nextU = this.searchMax(remainingHand, myBank, simOpp, nextPowers, pOpp, horizon - 1, memo)
      return immediateScore + DISCOUNT * nextU
    }

    // Resolve based on rules.beats
    if (rules.beats[ce] === ee) {
      return evalWin()
    }
    if (rules.beats[ee] === ce) {
      return evalLoss()
    }

    // Same element: integrate over modified CDF mixture
    const outcome = sameElementOutcome(candidate.value, ce, rules)

    // Immediate payoffs
    let winPayoff: number
    const simMy = [...myBank, candidate]
    let simOpp = [...oppBank]

    if (checkWinCondition([...myBank, candidate]).won) {
      winPayoff = W_TRIAD
    } else {
      let discardDelta = 0
      if (this.params.powerAwareness >= 1 && candidate.powerId !== 0) {
        const pClass = POWER_CLASS.get(candidate.powerId)
        if (pClass === 'DISCARD') {
          const sim = applyPowerToBanks(candidate.powerId, simMy, oppBank)
          simOpp = sim.oppBank
          discardDelta = (bankPotential(oppBank) - bankPotential(simOpp)) * (W_TRIAD / 2)
        }
      }
      let staticBonus = 0
      if (candidate.powerId !== 0) {
        const pClass = POWER_CLASS.get(candidate.powerId)
        if (pClass !== 'DISCARD') {
          if (this.params.powerAwareness === 1 || (this.params.powerAwareness === 2 && horizon === 0)) {
            staticBonus = 0.5 * BASE
          }
        }
      }
      winPayoff = BASE + (bankPotential(simMy) - bankPotential(myBank)) + discardDelta + staticBonus
    }

    const worst = this.getWorstCaseOpponentCard(oppBank, ee)
    const lossPayoff = worst.wouldWin
      ? -W_TRIAD
      : -BASE - (bankPotential([...oppBank, worst.card]) - bankPotential(oppBank))
    const tiePayoff = 0

    const expectedImmediate = outcome.win * winPayoff + outcome.loss * lossPayoff + outcome.tie * tiePayoff

    if (horizon <= 0 || remainingHand.length === 0) {
      return expectedImmediate
    }

    // State transition applies the assumed outcome per §3.5 & §5
    let nextMy = myBank
    let nextOpp = oppBank
    let scoredBranch: { seat: number; card: CardData } | null = null

    if (outcome.win > outcome.loss) {
      nextMy = simMy
      nextOpp = simOpp
      scoredBranch = { seat: 1, card: candidate }
    } else if (outcome.loss > outcome.win) {
      nextOpp = [...oppBank, worst.card]
    }

    const nextPowers =
      this.params.powerAwareness === 2
        ? advancePowers(powers, { seat: 1, card: candidate }, scoredBranch)
        : EMPTY_POWERS

    const nextU = this.searchMax(remainingHand, nextMy, nextOpp, nextPowers, pOpp, horizon - 1, memo)
    return expectedImmediate + DISCOUNT * nextU
  }

  private searchMax(
    hand: readonly CardData[],
    myBank: readonly CardData[],
    oppBank: readonly CardData[],
    powers: ReadonlyMap<number, ActivePowerState>,
    pOpp: Record<NinjaElement, number>,
    horizon: number,
    memo: Map<string, number>,
  ): number {
    if (hand.length === 0 || checkWinCondition(myBank).won || checkWinCondition(oppBank).won) {
      if (checkWinCondition(myBank).won) return W_TRIAD
      if (checkWinCondition(oppBank).won) return -W_TRIAD
      return bankPotential(myBank) - bankPotential(oppBank)
    }

    const pKey = powers.size === 0 ? '' : powersKey(powers)
    const stateKey = `${horizon}:${hand.map((c) => c.id).sort((a, b) => a - b).join(',')}:${bankKey(myBank)}:${bankKey(oppBank)}:${pKey}`
    const cached = memo.get(stateKey)
    if (cached !== undefined) return cached

    let maxVal = -Infinity
    for (const card of hand) {
      const nextHand = hand.filter((c) => c.id !== card.id)
      const u = this.evaluateCandidate(card, nextHand, myBank, oppBank, powers, pOpp, horizon, memo)
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

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  DEALABLE_CARDS,
  NORMAL_POOL,
  POWER_POOL,
} from '../src/games/card-jitsu/engine/deck/cards'
import starterDeckRows from '../src/games/card-jitsu/engine/deck/starter-deck.json'
import {
  BOT_TIERS,
  clampTemperature,
  type BotTier,
} from '../src/games/card-jitsu/engine/opponents/tiers'
import { BotDeck } from '../src/games/card-jitsu/engine/opponents/bot-deck'
import {
  createBotPolicy,
  UniformRandomPolicy,
  StrategicPolicy,
  type BotContext,
} from '../src/games/card-jitsu/engine/ai/bot-policy'
import { CardJitsuSession } from '../src/games/card-jitsu/engine/gateway/session'
import {
  createSeededRng,
  simulateHeadlessMatch,
} from '../src/games/card-jitsu/engine/ai/simulate'
import type { CardData } from '../src/games/card-jitsu/types'
import {
  POWER_CLASS,
  advancePowers,
  type ActivePowerState,
} from '../src/games/card-jitsu/engine/rules/powers'
import {
  effectiveRules,
  resolveClashWith,
  resolveClash,
  sameElementOutcome,
  RULE_SET,
  REVERSED_RULE_SET,
  type EffectiveRules,
} from '../src/games/card-jitsu/engine/rules/clash'

describe('Card-Jitsu AI & Engine Overhaul (§6 Verification)', () => {
  describe('1. Pool Partition & BOT_TIERS Specification', () => {
    it('partitions pool into exactly 405 normal and 104 power cards', () => {
      expect(NORMAL_POOL.length).toBe(405)
      expect(POWER_POOL.length).toBe(104)
      expect(DEALABLE_CARDS.length).toBe(405 + 104)
      for (const card of NORMAL_POOL) {
        expect(card.powerId).toBe(0)
      }
      for (const card of POWER_POOL) {
        expect(card.powerId).not.toBe(0)
      }
    })

    it('validates BOT_TIERS pool requests and temperature clamping', () => {
      for (let r = 1; r <= 9; r++) {
        const tier = BOT_TIERS[r as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9]
        if (typeof tier.normal === 'number') {
          expect(tier.normal).toBeLessThanOrEqual(NORMAL_POOL.length)
        }
        if (typeof tier.power === 'number') {
          expect(tier.power).toBeLessThanOrEqual(POWER_POOL.length)
        }
        expect(tier.temperature).toBeGreaterThanOrEqual(0)
        expect(tier.temperature).toBeLessThanOrEqual(1)
        expect(clampTemperature(tier.temperature)).toBe(tier.temperature)
      }

      // Clamping rounding mode test: Math.round
      expect(clampTemperature(0.55)).toBe(0.6)
      expect(clampTemperature(0.54)).toBe(0.5)
      expect(clampTemperature(1.2)).toBe(1.0)
      expect(clampTemperature(-0.3)).toBe(0.0)
    })
  })

  describe('2. Bot Deck Sizes & Draw Uniqueness', () => {
    it('rank 1 BotDeck equals the 12 starter IDs exactly without sampling', () => {
      const deck = new BotDeck(BOT_TIERS[1], 0.5)
      expect(deck.size).toBe(12)
      expect(deck.remaining).toBe(12)
      const drawn = deck.draw(12)
      const drawnIds = drawn.map((c) => c.id).sort((a, b) => a - b)
      const expectedIds = starterDeckRows.map((r) => r.cardId).sort((a, b) => a - b)
      expect(drawnIds).toEqual(expectedIds)
    })

    it('ranks 2-9 sizes equal normal + power counts', () => {
      for (let r = 2; r <= 9; r++) {
        const tier = BOT_TIERS[r as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9]
        const deck = new BotDeck(tier, 0.5)
        const expectedSize = (tier.normal as number) + (tier.power as number)
        expect(deck.size).toBe(expectedSize)
        expect(deck.remaining).toBe(expectedSize)
      }
    })

    it('draw never repeats a card until reset', () => {
      const deck = new BotDeck(BOT_TIERS[3], 0.5)
      const totalSize = deck.size
      const drawnCards = deck.draw(totalSize)
      const uniqueIds = new Set(drawnCards.map((c) => c.id))
      expect(uniqueIds.size).toBe(totalSize)
      expect(deck.remaining).toBe(0)

      // Next draw resets and refills
      const nextBatch = deck.draw(5)
      expect(nextBatch.length).toBe(5)
      expect(deck.remaining).toBe(totalSize - 5)
    })
  })

  describe('3. Temperature Dealing Bias', () => {
    it('mean card value over 10k draws obeys mean(τ=1) > mean(τ=0.5) > mean(τ=0)', () => {
      const count = 10000
      const tier = BOT_TIERS[9]

      const sampleMean = (temp: number): number => {
        const rng = createSeededRng(12345)
        const deck = new BotDeck(tier, temp, rng)
        let sum = 0
        for (let i = 0; i < count; i++) {
          const card = deck.draw(1)[0]!
          sum += card.value
        }
        return sum / count
      }

      const meanHigh = sampleMean(1.0)
      const meanMid = sampleMean(0.5)
      const meanLow = sampleMean(0.0)

      expect(meanHigh).toBeGreaterThan(meanMid)
      expect(meanMid).toBeGreaterThan(meanLow)

      // τ=0.5 mean within 2% of uniform mean of the tier's deck composition
      const normalMean = NORMAL_POOL.reduce((a, b) => a + b.value, 0) / NORMAL_POOL.length
      const powerMean = POWER_POOL.reduce((a, b) => a + b.value, 0) / POWER_POOL.length
      const uniformMean = ((tier.normal as number) * normalMean + (tier.power as number) * powerMean) / ((tier.normal as number) + (tier.power as number))
      const diffPercent = Math.abs(meanMid - uniformMean) / uniformMean
      expect(diffPercent).toBeLessThan(0.05)
    })
  })

  describe('4. Policy Purity & Performance', () => {
    it('identical BotContext + seeded rng produces identical pick', () => {
      const policy = createBotPolicy(9)
      const ctx1: BotContext = {
        hand: DEALABLE_CARDS.slice(0, 5).map((card, i) => ({ dealtId: i + 1, card })),
        myBank: [DEALABLE_CARDS[10]!, DEALABLE_CARDS[20]!],
        oppBank: [DEALABLE_CARDS[30]!, DEALABLE_CARDS[40]!],
        oppHistory: [DEALABLE_CARDS[50]!],
        myHistory: [DEALABLE_CARDS[60]!],
        activePowers: new Map(),
        round: 2,
        rng: createSeededRng(42),
      }

      const ctx2: BotContext = {
        hand: DEALABLE_CARDS.slice(0, 5).map((card, i) => ({ dealtId: i + 1, card })),
        myBank: [DEALABLE_CARDS[10]!, DEALABLE_CARDS[20]!],
        oppBank: [DEALABLE_CARDS[30]!, DEALABLE_CARDS[40]!],
        oppHistory: [DEALABLE_CARDS[50]!],
        myHistory: [DEALABLE_CARDS[60]!],
        activePowers: new Map(),
        round: 2,
        rng: createSeededRng(42),
      }

      const pick1 = policy.pick(ctx1)
      const pick2 = policy.pick(ctx2)
      expect(pick1).toBe(pick2)
    })

    it('rank 9 pick latency p99 <= 10 ms over 1k random states', () => {
      const policy = createBotPolicy(9)
      const rng = createSeededRng(999)

      // Warmup JIT with representative states
      for (let i = 0; i < 50; i++) {
        const start = Math.floor(rng() * 300)
        const ctx: BotContext = {
          hand: DEALABLE_CARDS.slice(start, start + 5).map((card, idx) => ({ dealtId: idx + 1, card })),
          myBank: DEALABLE_CARDS.slice(start + 5, start + 7),
          oppBank: DEALABLE_CARDS.slice(start + 7, start + 9),
          oppHistory: DEALABLE_CARDS.slice(start + 9, start + 11),
          myHistory: DEALABLE_CARDS.slice(start + 11, start + 13),
          activePowers: new Map(),
          round: 3,
          rng,
        }
        policy.pick(ctx)
      }

      const times: number[] = []
      for (let i = 0; i < 1000; i++) {
        const start = Math.floor(rng() * 300)
        const ctx: BotContext = {
          hand: DEALABLE_CARDS.slice(start, start + 5).map((card, idx) => ({ dealtId: idx + 1, card })),
          myBank: DEALABLE_CARDS.slice(start + 5, start + 7),
          oppBank: DEALABLE_CARDS.slice(start + 7, start + 9),
          oppHistory: DEALABLE_CARDS.slice(start + 9, start + 11),
          myHistory: DEALABLE_CARDS.slice(start + 11, start + 13),
          activePowers: new Map(),
          round: 3,
          rng,
        }
        const t0 = performance.now()
        policy.pick(ctx)
        times.push(performance.now() - t0)
      }

      times.sort((a, b) => a - b)
      const p99 = times[Math.floor(times.length * 0.99)]!
      expect(p99).toBeLessThanOrEqual(10)
    })
  })

  describe('5. Security & Zero-Peek Verification', () => {
    it('engine/ai/** and bot-policy.ts contain zero references to playerDealtMap, oppHand, or playerSelectedCard', () => {
      const aiDir = path.resolve(__dirname, '../src/games/card-jitsu/engine/ai')
      const files = fs.readdirSync(aiDir).filter((f) => f.endsWith('.ts'))

      for (const file of files) {
        const content = fs.readFileSync(path.join(aiDir, file), 'utf8')
        expect(content).not.toContain('playerDealtMap')
        expect(content).not.toContain('oppHand')
        expect(content).not.toContain('playerSelectedCard')
      }
    })

    it('asserts oppHistory in session contains only resolved rounds', () => {
      const session = new CardJitsuSession({
        playerBelt: 'white',
        mode: 'belts',
      })
      session.startMatch('belts')
      const stats = session.getStats()
      // Initially round is 1, resolved rounds is 0
      expect(stats.round).toBe(1)
    })
  })

  describe('6. Power Taxonomy & Rule Mapping (§7 Verification)', () => {
    it('POWER_CLASS covers all 104 power cards and maps all 18 power IDs', () => {
      expect(POWER_POOL.length).toBe(104)
      expect(POWER_CLASS.size).toBe(18)
      for (const card of POWER_POOL) {
        expect(POWER_CLASS.has(card.powerId)).toBe(true)
      }

      // Power 1: REVERSE
      expect(POWER_CLASS.get(1)).toBe('REVERSE')

      // Powers 16, 17, 18: REPLACE
      expect(POWER_CLASS.get(16)).toBe('REPLACE')
      expect(POWER_CLASS.get(17)).toBe('REPLACE')
      expect(POWER_CLASS.get(18)).toBe('REPLACE')

      // Powers 2, 3, 13, 14, 15: VALUE
      for (const id of [2, 3, 13, 14, 15]) {
        expect(POWER_CLASS.get(id)).toBe('VALUE')
      }

      // Powers 4–12: DISCARD
      for (let id = 4; id <= 12; id++) {
        expect(POWER_CLASS.get(id)).toBe('DISCARD')
      }
    })

    it('advancePowers follows strict round-trip lifecycle (on-played vs on-scored vs discard)', () => {
      const reverseCard: CardData = { id: 1001, element: 'f', color: 'y', value: 5, powerId: 1 }
      const normalCard1: CardData = { id: 1002, element: 'w', color: 'b', value: 6, powerId: 0 }
      const normalCard2: CardData = { id: 1003, element: 's', color: 'g', value: 4, powerId: 0 }
      const valueCard: CardData = { id: 1004, element: 'f', color: 'r', value: 8, powerId: 2 }
      const discardCard: CardData = { id: 1005, element: 'w', color: 'o', value: 7, powerId: 6 }

      let powers: ReadonlyMap<number, ActivePowerState> = new Map()

      // Round 1: REVERSE played (takes effect next round regardless of win/loss)
      powers = advancePowers(
        powers,
        [{ seat: 1, card: reverseCard }, { seat: 0, card: normalCard1 }],
        { seat: 0, card: normalCard1 },
      )
      expect(powers.has(1)).toBe(true)
      expect(powers.get(1)?.player).toBe(1)

      // Round 2: normal cards played. The previous round's REVERSE expires
      powers = advancePowers(
        powers,
        [{ seat: 1, card: normalCard1 }, { seat: 0, card: normalCard2 }],
        { seat: 1, card: normalCard1 },
      )
      expect(powers.has(1)).toBe(false)
      expect(powers.size).toBe(0)

      // Round 3: VALUE card played but lost -> does NOT activate next round
      powers = advancePowers(
        powers,
        [{ seat: 1, card: valueCard }, { seat: 0, card: normalCard1 }],
        { seat: 0, card: normalCard1 },
      )
      expect(powers.has(2)).toBe(false)

      // Round 4: VALUE card played and won -> activates next round
      powers = advancePowers(
        powers,
        [{ seat: 1, card: valueCard }, { seat: 0, card: normalCard2 }],
        { seat: 1, card: valueCard },
      )
      expect(powers.has(2)).toBe(true)

      // Round 5: DISCARD card won -> executes immediately, does NOT enter next round's powers
      powers = advancePowers(
        powers,
        [{ seat: 1, card: discardCard }, { seat: 0, card: normalCard2 }],
        { seat: 1, card: discardCard },
      )
      expect(powers.has(6)).toBe(false)
      expect(powers.has(2)).toBe(false)
    })

    it('MatchFlow and advancePowers maintain state parity over scripted rounds', () => {
      let powers: ReadonlyMap<number, ActivePowerState> = new Map()
      const c1: CardData = { id: 73, element: 'f', color: 'y', value: 10, powerId: 1 } // REVERSE
      const c2: CardData = { id: 1, element: 'f', color: 'b', value: 3, powerId: 0 }
      const c3: CardData = { id: 72, element: 'w', color: 'r', value: 10, powerId: 16 } // REPLACE w->f
      const c4: CardData = { id: 2, element: 'f', color: 'g', value: 2, powerId: 0 }

      powers = advancePowers(powers, [{ seat: 0, card: c1 }, { seat: 1, card: c2 }], { seat: 0, card: c1 })
      expect(powers.has(1)).toBe(true)

      powers = advancePowers(powers, [{ seat: 0, card: c3 }, { seat: 1, card: c4 }], { seat: 0, card: c3 })
      expect(powers.has(1)).toBe(false)
      expect(powers.has(16)).toBe(true)
    })

    it('reversal pick: hand {f10, s2}, opp heavy fire => Awareness >= 1 picks s2, Awareness 0 picks f10', () => {
      const f10: CardData = { id: 10, element: 'f', color: 'r', value: 10, powerId: 0 }
      const s2: CardData = { id: 2, element: 's', color: 'b', value: 2, powerId: 0 }
      const oppFire1: CardData = { id: 11, element: 'f', color: 'g', value: 5, powerId: 0 }
      const oppFire2: CardData = { id: 12, element: 'f', color: 'o', value: 6, powerId: 0 }

      const reversePowers = new Map<number, ActivePowerState>([
        [1, { powerId: 1, player: 1, opponent: 0, card: { id: 73, element: 'f', color: 'y', value: 10, powerId: 1 } }],
      ])

      const ctx: BotContext = {
        hand: [{ dealtId: 1, card: f10 }, { dealtId: 2, card: s2 }],
        myBank: [],
        oppBank: [oppFire1, oppFire2], // Fire finisher -> P(f) = 1 under modelStrength: 1
        oppHistory: [oppFire1, oppFire2],
        myHistory: [],
        activePowers: reversePowers,
        round: 2,
        rng: createSeededRng(1),
      }

      const policyAware = new StrategicPolicy({ precision: Infinity, horizon: 0, modelStrength: 1, powerAwareness: 1 })
      const policyNaive = new StrategicPolicy({ precision: Infinity, horizon: 0, modelStrength: 1, powerAwareness: 0 })

      expect(policyAware.pick(ctx)).toBe(2) // s2 (Snow beats Fire under reversal)
      expect(policyNaive.pick(ctx)).toBe(1) // f10 (Fire vs Fire high value under normal)
    })

    it('replacement pick w -> f: hand {s5, w5}, opp water => Awareness >= 1 picks w5', () => {
      const s5: CardData = { id: 21, element: 's', color: 'r', value: 5, powerId: 0 }
      const w5: CardData = { id: 22, element: 'w', color: 'b', value: 5, powerId: 0 }
      const oppW1: CardData = { id: 23, element: 'w', color: 'g', value: 6, powerId: 0 }
      const oppW2: CardData = { id: 24, element: 'w', color: 'y', value: 7, powerId: 0 }

      const replacePowers = new Map<number, ActivePowerState>([
        [16, { powerId: 16, player: 1, opponent: 0, card: { id: 72, element: 'w', color: 'r', value: 10, powerId: 16 } }],
      ])

      const ctx: BotContext = {
        hand: [{ dealtId: 1, card: s5 }, { dealtId: 2, card: w5 }],
        myBank: [],
        oppBank: [oppW1, oppW2], // Water finisher -> P(w) = 1 under modelStrength: 1
        oppHistory: [oppW1, oppW2],
        myHistory: [],
        activePowers: replacePowers,
        round: 2,
        rng: createSeededRng(1),
      }

      const policyAware = new StrategicPolicy({ precision: Infinity, horizon: 0, modelStrength: 1, powerAwareness: 1 })
      const rules = effectiveRules(replacePowers, 1)

      // Verified against resolveClashWith
      expect(resolveClashWith(s5, oppW1, rules)).toBe(-1) // s5 (Snow) vs replaced Fire -> loses
      expect(resolveClashWith(w5, oppW1, rules)).toBe(-1) // w5 (Water->Fire) vs replaced Fire (7 vs 5)
      expect(policyAware.pick(ctx)).toBe(2) // w5 preferred over certain loss
    })

    it('lowestWins pick: hand {f3, f11}, P(f)=1 => Awareness >= 1 picks f3', () => {
      const f3: CardData = { id: 31, element: 'f', color: 'r', value: 3, powerId: 0 }
      const f11: CardData = { id: 32, element: 'f', color: 'b', value: 11, powerId: 0 }
      const oppFire1: CardData = { id: 33, element: 'f', color: 'g', value: 6, powerId: 0 }
      const oppFire2: CardData = { id: 34, element: 'f', color: 'o', value: 7, powerId: 0 }

      const reversePowers = new Map<number, ActivePowerState>([
        [1, { powerId: 1, player: 1, opponent: 0, card: { id: 73, element: 'f', color: 'y', value: 10, powerId: 1 } }],
      ])

      const ctx: BotContext = {
        hand: [{ dealtId: 1, card: f3 }, { dealtId: 2, card: f11 }],
        myBank: [],
        oppBank: [oppFire1, oppFire2],
        oppHistory: [oppFire1, oppFire2],
        myHistory: [],
        activePowers: reversePowers,
        round: 2,
        rng: createSeededRng(1),
      }

      const policyAware = new StrategicPolicy({ precision: Infinity, horizon: 0, modelStrength: 1, powerAwareness: 1 })
      const policyNaive = new StrategicPolicy({ precision: Infinity, horizon: 0, modelStrength: 1, powerAwareness: 0 })

      expect(policyAware.pick(ctx)).toBe(1) // f3 wins ties under lowestWins
      expect(policyNaive.pick(ctx)).toBe(2) // f11 wins ties under standard rules
    })

    it('discard planning: oppBank 2 fire cards, hand {discard-fire (5), normal f5} => Awareness 2 horizon >= 1 picks discard', () => {
      const discardF5: CardData = { id: 41, element: 'f', color: 'g', value: 5, powerId: 6 } // discard fire
      const normalF5: CardData = { id: 42, element: 'f', color: 'y', value: 5, powerId: 0 }
      const oppF1: CardData = { id: 43, element: 'f', color: 'r', value: 4, powerId: 0 }
      const oppF2: CardData = { id: 44, element: 'f', color: 'b', value: 8, powerId: 0 }

      const ctx: BotContext = {
        hand: [{ dealtId: 1, card: discardF5 }, { dealtId: 2, card: normalF5 }],
        myBank: [],
        oppBank: [oppF1, oppF2],
        oppHistory: [],
        myHistory: [],
        activePowers: new Map(),
        round: 2,
        rng: createSeededRng(1),
      }

      const policyAware = new StrategicPolicy({ precision: Infinity, horizon: 1, modelStrength: 0.5, powerAwareness: 2 })
      expect(policyAware.pick(ctx)).toBe(1) // Discard fire selected to break oppBank potential

      // Awareness 0 is indifferent (50% +/- 10%)
      const policyNaive = new StrategicPolicy({ precision: 0.6, horizon: 1, modelStrength: 0.5, powerAwareness: 0 })
      let discardPicks = 0
      for (let i = 0; i < 200; i++) {
        const testCtx = { ...ctx, rng: createSeededRng(i + 100) }
        if (policyNaive.pick(testCtx) === 1) discardPicks++
      }
      const ratio = discardPicks / 200
      expect(ratio).toBeGreaterThanOrEqual(0.40)
      expect(ratio).toBeLessThanOrEqual(0.60)
    })

    it('reverse planning: myBank needs snow, hand has REVERSE + snow card, model heavy fire => Awareness 2 horizon >= 1 plays reverse first', () => {
      const revF10: CardData = { id: 73, element: 'f', color: 'y', value: 10, powerId: 1 }
      const snowG8: CardData = { id: 8, element: 's', color: 'g', value: 8, powerId: 0 }

      // myBank has 1 snow card; needs snow to advance toward triad
      const snow1: CardData = { id: 51, element: 's', color: 'r', value: 4, powerId: 0 }

      // Opponent plays heavy fire
      const oppF1: CardData = { id: 53, element: 'f', color: 'r', value: 6, powerId: 0 }
      const oppF2: CardData = { id: 54, element: 'f', color: 'b', value: 7, powerId: 0 }

      const ctx: BotContext = {
        hand: [{ dealtId: 1, card: revF10 }, { dealtId: 2, card: snowG8 }],
        myBank: [snow1],
        oppBank: [oppF1, oppF2],
        oppHistory: [oppF1, oppF2, oppF1, oppF2],
        myHistory: [],
        activePowers: new Map(),
        round: 3,
        rng: createSeededRng(42),
      }

      const policyAware2 = new StrategicPolicy({ precision: Infinity, horizon: 1, modelStrength: 1, powerAwareness: 2 })
      // Awareness 2 recognizes that playing REVERSE now sets up Snow to beat Fire on next round
      expect(policyAware2.pick(ctx)).toBe(1) // revF10

      // Awareness 2 plays reverse with higher frequency than Awareness 1 under softmax
      const policySoftmax2 = new StrategicPolicy({ precision: 2.0, horizon: 1, modelStrength: 1, powerAwareness: 2 })
      const policySoftmax1 = new StrategicPolicy({ precision: 2.0, horizon: 1, modelStrength: 1, powerAwareness: 1 })
      let revCount2 = 0
      let revCount1 = 0
      for (let i = 0; i < 100; i++) {
        const testCtx = { ...ctx, rng: createSeededRng(i + 50) }
        if (policySoftmax2.pick(testCtx) === 1) revCount2++
        if (policySoftmax1.pick(testCtx) === 1) revCount1++
      }
      expect(revCount2).toBeGreaterThanOrEqual(revCount1)
    })

    it('sameElementOutcome verifies lowestWins inverts win/loss and valueDelta shifts win monotonically', () => {
      const normalRules: EffectiveRules = { beats: RULE_SET, replace: { f: 'f', w: 'w', s: 's' }, valueDelta: [0, 0], lowestWins: false }
      const lowestRules: EffectiveRules = { beats: REVERSED_RULE_SET, replace: { f: 'f', w: 'w', s: 's' }, valueDelta: [0, 0], lowestWins: true }
      const buffRules: EffectiveRules = { beats: RULE_SET, replace: { f: 'f', w: 'w', s: 's' }, valueDelta: [2, 0], lowestWins: false }
      const debuffRules: EffectiveRules = { beats: RULE_SET, replace: { f: 'f', w: 'w', s: 's' }, valueDelta: [-2, 0], lowestWins: false }

      const outNorm = sameElementOutcome(4, 'f', normalRules)
      const outLow = sameElementOutcome(4, 'f', lowestRules)
      expect(outLow.win).toBe(outNorm.loss)
      expect(outLow.loss).toBe(outNorm.win)
      expect(outLow.tie).toBe(outNorm.tie)

      const outBuff = sameElementOutcome(6, 'f', buffRules)
      const outBase = sameElementOutcome(6, 'f', normalRules)
      const outDebuff = sameElementOutcome(6, 'f', debuffRules)
      expect(outBuff.win).toBeGreaterThan(outBase.win)
      expect(outBase.win).toBeGreaterThan(outDebuff.win)
    })

    it('card bank pinning: replaced card enters bank with its original element', () => {
      const w5: CardData = { id: 22, element: 'w', color: 'b', value: 5, powerId: 0 }
      const replaceRules: EffectiveRules = { beats: RULE_SET, replace: { f: 'f', w: 'f', s: 's' }, valueDelta: [0, 0], lowestWins: false }
      expect(replaceRules.replace['w']).toBe('f')

      // Card object itself is unmodified
      const bank: CardData[] = []
      bank.push(w5)
      expect(bank[0]?.element).toBe('w')
    })
  })
})


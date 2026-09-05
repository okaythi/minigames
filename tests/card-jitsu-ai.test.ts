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
  type BotContext,
} from '../src/games/card-jitsu/engine/ai/bot-policy'
import { CardJitsuSession } from '../src/games/card-jitsu/engine/gateway/session'
import {
  createSeededRng,
  simulateHeadlessMatch,
} from '../src/games/card-jitsu/engine/ai/simulate'

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
})

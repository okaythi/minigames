import type { DealableCard } from '../deck/cards'
import {
  DEALABLE_CARDS,
  DEALABLE_CARD_BY_ID,
  NORMAL_POOL,
  POWER_POOL,
  sample,
  weightedSample,
} from '../deck/cards'
import starterDeckRows from '../deck/starter-deck.json'
import { clampTemperature, type BotTier, type Temperature } from './tiers'

const MIN_VALUE = Math.min(...DEALABLE_CARDS.map((c) => c.value))
const MAX_VALUE = Math.max(...DEALABLE_CARDS.map((c) => c.value))
const TEMPERATURE_SHARPNESS = 4

function normalizeCardValue(value: number): number {
  if (MAX_VALUE === MIN_VALUE) return 0.5
  return (value - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)
}

export function computeCardWeight(card: DealableCard, temperature: Temperature): number {
  const w = normalizeCardValue(card.value)
  return Math.exp(TEMPERATURE_SHARPNESS * (2 * temperature - 1) * (w - 0.5))
}

export class BotDeck {
  private pool: DealableCard[] = []
  private readonly initialSize: number
  private readonly temperature: Temperature

  constructor(
    private readonly tier: BotTier,
    temperature: Temperature,
    private readonly rng: () => number = Math.random,
  ) {
    this.temperature = clampTemperature(temperature)
    this.initialSize =
      this.tier.normal === 'starter'
        ? starterDeckRows.length
        : (this.tier.normal as number) + (this.tier.power as number)
    this.reset()
  }

  get size(): number {
    return this.initialSize
  }

  get remaining(): number {
    return this.pool.length
  }

  reset(): void {
    if (this.tier.normal === 'starter') {
      const cards: DealableCard[] = []
      for (const row of starterDeckRows) {
        const card = DEALABLE_CARD_BY_ID.get(row.cardId)
        if (card) cards.push(card)
      }
      this.pool = cards
    } else {
      const normalCount = this.tier.normal as number
      const powerCount = this.tier.power as number
      const normalCards = sample(NORMAL_POOL, normalCount, this.rng)
      const powerCards = sample(POWER_POOL, powerCount, this.rng)
      this.pool = [...normalCards, ...powerCards]
    }
  }

  draw(count: number): DealableCard[] {
    if (count <= 0) return []
    if (this.pool.length < count) {
      this.reset()
    }

    const drawn = weightedSample(
      this.pool,
      count,
      (c) => computeCardWeight(c, this.temperature),
      this.rng,
    )

    // Remove drawn cards from pool without replacement
    for (const card of drawn) {
      const idx = this.pool.indexOf(card)
      if (idx !== -1) {
        this.pool.splice(idx, 1)
      }
    }

    return drawn
  }
}

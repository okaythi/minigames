import rawCards from './cards.json'
import starterDeckRows from './starter-deck.json'
import dealableIds from './dealable-ids.json'
import type { CardData, CardStore, OwnedCard } from '../../types'

export const ALL_CARDS: readonly CardData[] = rawCards.map((c) => ({
  id: c.id,
  name: c.name,
  setId: c.set_id,
  powerId: c.power_id,
  element: c.element as CardData['element'],
  color: c.color as CardData['color'],
  value: c.value,
  description: c.description,
}))

export const CARD_BY_ID: ReadonlyMap<number, CardData> = new Map(
  ALL_CARDS.map((c) => [c.id, c]),
)

export const DEALABLE_IDS: ReadonlySet<number> = new Set<number>(dealableIds)

declare const DealableCardBrand: unique symbol

/**
 * Branded type representing a CardData whose media assets (icon SWF and power battle SWFs)
 * have been verified to exist and conform to the SWF specification.
 *
 * Deal paths, decks, and bot policies strictly operate on DealableCard, ensuring
 * unrepresentability of unplayable cards at the type level.
 */
export type DealableCard = CardData & { readonly [DealableCardBrand]: true }

export function asDealableCard(card: CardData): DealableCard | null {
  if (!DEALABLE_IDS.has(card.id)) return null
  return card as DealableCard
}

export function assertDealableCard(card: CardData): DealableCard {
  if (!DEALABLE_IDS.has(card.id)) {
    throw new Error(`Card ${card.id} lacks verified media assets and cannot be dealt`)
  }
  return card as DealableCard
}

export const DEALABLE_CARDS: readonly DealableCard[] = ALL_CARDS.filter(
  (c): c is DealableCard => DEALABLE_IDS.has(c.id),
)

export const DEALABLE_CARD_BY_ID: ReadonlyMap<number, DealableCard> = new Map(
  DEALABLE_CARDS.map((c) => [c.id, c]),
)

export class DefaultCardStore implements CardStore {
  constructor(private owned: readonly OwnedCard[] = starterDeckRows) {}

  getOwned(): readonly OwnedCard[] {
    return this.owned
  }

  setOwned(cards: readonly OwnedCard[]): void {
    this.owned = cards
  }
}

export function sample<T>(population: readonly T[], k: number): T[] {
  const copy = [...population]
  const result: T[] = []
  const count = Math.min(k, copy.length)
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    result.push(copy[idx]!)
    copy.splice(idx, 1)
  }
  return result
}

export function shuffleDeck<T>(deck: readonly T[]): T[] {
  const result = [...deck]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]
    const swapTarget = result[j]
    if (temp !== undefined && swapTarget !== undefined) {
      result[i] = swapTarget
      result[j] = temp
    }
  }
  return result
}

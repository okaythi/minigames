import type { CardData, CardStore } from '../../types'
import {
  CARD_BY_ID,
  DEALABLE_CARDS,
  DEALABLE_CARD_BY_ID,
  DEALABLE_IDS,
  type DealableCard,
  sample,
} from '../deck/cards'
import { beatsCard } from '../rules/clash'
import { formatCardWire } from '../protocol/packets'

export interface DealItem {
  readonly dealtId: number
  readonly card: CardData
  readonly wire: string
}

export interface DealBatch {
  readonly playerDealt: readonly DealItem[]
  readonly oppDealt: readonly DealItem[]
  readonly senseiPairs: readonly [number, number][]
  readonly nextDealtId: number
}

export function drawPlayerCards(
  store: CardStore,
  currentHand: readonly CardData[],
  count: number,
  isSensei: boolean,
  canBeatSensei: boolean,
): DealableCard[] {
  if (count <= 0) return []
  const deck = new Map<number, number>()
  for (const o of store.getOwned()) {
    if (!DEALABLE_IDS.has(o.cardId)) continue
    const card = CARD_BY_ID.get(o.cardId)
    if (!card) continue
    if (isSensei && !canBeatSensei && card.powerId !== 0) continue
    deck.set(o.cardId, (deck.get(o.cardId) ?? 0) + o.quantity + o.memberQuantity)
  }

  for (const c of currentHand) {
    const remaining = deck.get(c.id) ?? 0
    if (remaining > 0) deck.set(c.id, remaining - 1)
  }

  const pool: number[] = []
  for (const [id, n] of deck) {
    for (let i = 0; i < n; i++) pool.push(id)
  }

  if (pool.length === 0) {
    for (const card of DEALABLE_CARDS) {
      if (!isSensei || canBeatSensei || card.powerId === 0) pool.push(card.id)
    }
  }

  const sampledIds = sample(pool, count)
  return sampledIds.map((id) => DEALABLE_CARD_BY_ID.get(id) ?? (CARD_BY_ID.get(id) as DealableCard))
}

export function getSenseiCounterCard(playerCard: CardData, usedColors: string[]): DealableCard {
  if (usedColors.length >= 6) usedColors.length = 0
  const dealable = DEALABLE_CARDS
  const start = Math.floor(Math.random() * (dealable.length + 1))
  for (let k = 0; k < dealable.length; k++) {
    const c = dealable[(start + k) % dealable.length]!
    if (!usedColors.includes(c.color) && beatsCard(c, playerCard)) {
      usedColors.push(c.color)
      return c
    }
  }
  return dealable[Math.floor(Math.random() * dealable.length)]!
}

export function drawBotCards(count: number): DealableCard[] {
  if (count <= 0) return []
  return sample(DEALABLE_CARDS, count)
}

export function executeDealRound(
  isSensei: boolean,
  canBeat: boolean,
  startDealtId: number,
  store: CardStore,
  currentPHand: readonly CardData[],
  currentOHandSize: number,
  senseiColors: string[],
  oppDeckPool?: readonly DealableCard[],
): DealBatch {
  let nextId = startDealtId
  const needPlayer = 5 - currentPHand.length
  if (needPlayer <= 0) {
    return { playerDealt: [], oppDealt: [], senseiPairs: [], nextDealtId: nextId }
  }

  const undealt = drawPlayerCards(store, currentPHand, needPlayer, isSensei, canBeat)
  const playerDealt: DealItem[] = []
  const oppDealt: DealItem[] = []
  const senseiPairs: [number, number][] = []

  if (isSensei) {
    for (const card of undealt) {
      const pId = nextId++
      playerDealt.push({ dealtId: pId, card, wire: formatCardWire(pId, card) })
      const sCard = canBeat
        ? DEALABLE_CARDS[Math.floor(Math.random() * DEALABLE_CARDS.length)]!
        : getSenseiCounterCard(card, senseiColors)
      const sId = nextId++
      oppDealt.push({ dealtId: sId, card: sCard, wire: formatCardWire(sId, sCard) })
      senseiPairs.push([pId, sId])
    }
  } else {
    for (const card of undealt) {
      const pId = nextId++
      playerDealt.push({ dealtId: pId, card, wire: formatCardWire(pId, card) })
    }
    const pool = oppDeckPool && oppDeckPool.length > 0 ? oppDeckPool : DEALABLE_CARDS
    for (const oppCard of sample(pool, 5 - currentOHandSize)) {
      const sId = nextId++
      oppDealt.push({ dealtId: sId, card: oppCard, wire: formatCardWire(sId, oppCard) })
    }
  }

  return { playerDealt, oppDealt, senseiPairs, nextDealtId: nextId }
}

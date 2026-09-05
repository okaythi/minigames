import rawRoster from './roster.json'
import { CARD_BY_ID, DEALABLE_CARD_BY_ID, DEALABLE_IDS, type DealableCard } from '../deck/cards'
import { BELT_TO_RANK, getRankBelt, type BeltRank } from '../progression'
import type { NinjaBelt } from '../../types'

export type CardRange = readonly [number, number]

export interface RosterDeckSpec {
  readonly normal: readonly CardRange[]
  readonly power: readonly CardRange[]
}

export interface RosterEntry {
  readonly name: string
  readonly belt: NinjaBelt
  readonly colorId: number
  readonly deck: RosterDeckSpec
}

export interface BotOpponent {
  readonly name: string
  readonly belt: NinjaBelt
  readonly rank: BeltRank
  readonly colorId: number
  readonly deckCards: readonly DealableCard[]
  readonly normalDeck: readonly DealableCard[]
  readonly powerDeck: readonly DealableCard[]
}

export interface RosterDiscrepancy {
  readonly bot: string
  readonly type: 'power-in-normal' | 'normal-in-power' | 'missing-media' | 'unknown-card'
  readonly cardId: number
  readonly details: string
}

export interface RosterValidationResult {
  readonly valid: boolean
  readonly discrepancies: readonly RosterDiscrepancy[]
}

export function expandRanges(ranges: readonly CardRange[]): number[] {
  const result: number[] = []
  for (const [start, end] of ranges) {
    for (let id = start; id <= end; id++) {
      result.push(id)
    }
  }
  return result
}

/**
 * Validates the opponent roster against cards.json and dealable media pool.
 * Identifies power cards placed in normal ranges and normal cards placed in power ranges.
 */
export function validateRoster(roster: readonly RosterEntry[] = rawRoster as unknown as readonly RosterEntry[]): RosterValidationResult {
  const discrepancies: RosterDiscrepancy[] = []

  for (const bot of roster) {
    const isSensei = bot.name.toLowerCase() === 'sensei'

    // 1. Validate normal ranges: must have powerId === 0
    const normalIds = expandRanges(bot.deck.normal)
    for (const id of normalIds) {
      const card = CARD_BY_ID.get(id)
      if (!card) {
        discrepancies.push({ bot: bot.name, type: 'unknown-card', cardId: id, details: `Card ${id} not found in cards.json` })
        continue
      }
      if (card.powerId !== 0 && !isSensei) {
        discrepancies.push({
          bot: bot.name,
          type: 'power-in-normal',
          cardId: id,
          details: `Card ${id} (${card.name}) has power_id ${card.powerId} but listed in normal range`,
        })
      }
      if (!DEALABLE_IDS.has(id)) {
        discrepancies.push({
          bot: bot.name,
          type: 'missing-media',
          cardId: id,
          details: `Card ${id} lacks complete media assets on disk`,
        })
      }
    }

    // 2. Validate power ranges: non-Sensei cards must have powerId > 0
    const powerIds = expandRanges(bot.deck.power)
    for (const id of powerIds) {
      const card = CARD_BY_ID.get(id)
      if (!card) {
        discrepancies.push({ bot: bot.name, type: 'unknown-card', cardId: id, details: `Card ${id} not found in cards.json` })
        continue
      }
      if (card.powerId === 0 && !isSensei) {
        discrepancies.push({
          bot: bot.name,
          type: 'normal-in-power',
          cardId: id,
          details: `Card ${id} (${card.name}) has power_id 0 but listed in power range`,
        })
      }
      if (!DEALABLE_IDS.has(id)) {
        discrepancies.push({
          bot: bot.name,
          type: 'missing-media',
          cardId: id,
          details: `Card ${id} lacks complete media assets on disk`,
        })
      }
    }
  }

  return {
    valid: discrepancies.filter((d) => d.type === 'power-in-normal' || d.type === 'normal-in-power').length === 0,
    discrepancies,
  }
}

/**
 * Builds expanded, verified dealable deck for a roster bot.
 */
export function buildBotDeck(bot: RosterEntry): {
  readonly normalDeck: readonly DealableCard[]
  readonly powerDeck: readonly DealableCard[]
  readonly deckCards: readonly DealableCard[]
} {
  const normalIds = expandRanges(bot.deck.normal)
  const powerIds = expandRanges(bot.deck.power)

  const normalDeck: DealableCard[] = []
  for (const id of normalIds) {
    const card = DEALABLE_CARD_BY_ID.get(id)
    if (card) normalDeck.push(card)
  }

  const powerDeck: DealableCard[] = []
  for (const id of powerIds) {
    const card = DEALABLE_CARD_BY_ID.get(id)
    if (card) powerDeck.push(card)
  }

  const combinedMap = new Map<number, DealableCard>()
  for (const c of normalDeck) combinedMap.set(c.id, c)
  for (const c of powerDeck) combinedMap.set(c.id, c)

  return {
    normalDeck,
    powerDeck,
    deckCards: Array.from(combinedMap.values()),
  }
}

export const ROSTER_ENTRIES: readonly RosterEntry[] = rawRoster as unknown as readonly RosterEntry[]

/**
 * Pure opponent selection:
 * bot belt = min(playerRank + 1, 9)
 * Supports explicit opponent override and eligibleOpponents restriction.
 */
export function selectOpponent(
  playerRank: number,
  history: readonly string[] = [],
  eligibleOpponents?: readonly string[],
  overrideOpponent?: string,
): BotOpponent {
  if (overrideOpponent) {
    const entry = ROSTER_ENTRIES.find((b) => b.name.toLowerCase() === overrideOpponent.toLowerCase())
    if (entry) {
      const decks = buildBotDeck(entry)
      return {
        name: entry.name,
        belt: entry.belt,
        rank: BELT_TO_RANK[entry.belt],
        colorId: entry.colorId,
        ...decks,
      }
    }
  }

  const targetRank = Math.min(Math.max(1, playerRank + 1), 9) as BeltRank
  const targetBelt = getRankBelt(targetRank)

  let candidates = ROSTER_ENTRIES.filter((b) => b.belt === targetBelt && b.name.toLowerCase() !== 'sensei')
  if (candidates.length === 0) {
    candidates = ROSTER_ENTRIES.filter((b) => b.name.toLowerCase() !== 'sensei')
  }

  if (eligibleOpponents && eligibleOpponents.length > 0) {
    const filtered = candidates.filter((b) => eligibleOpponents.includes(b.name))
    if (filtered.length > 0) candidates = filtered
  }

  // Avoid recently played opponents if possible
  const unplayed = candidates.filter((b) => !history.slice(-candidates.length + 1).includes(b.name))
  const pool = unplayed.length > 0 ? unplayed : candidates

  const selected = pool[Math.floor(Math.random() * pool.length)]!
  const decks = buildBotDeck(selected)

  return {
    name: selected.name,
    belt: selected.belt,
    rank: targetRank,
    colorId: selected.colorId,
    ...decks,
  }
}

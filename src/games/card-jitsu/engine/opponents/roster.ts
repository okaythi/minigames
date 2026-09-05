import rawRoster from './roster.json'
import { BELT_TO_RANK, getRankBelt, type BeltRank } from '../progression'
import type { NinjaBelt } from '../../types'
import { clampTemperature } from './tiers'

export interface RosterEntry {
  readonly name: string
  readonly belt: NinjaBelt
  readonly colorId: number
  readonly onceOnly?: boolean
  readonly temperature?: number
  readonly normal?: number
  readonly power?: number
}

export interface BotOpponent {
  readonly name: string
  readonly belt: NinjaBelt
  readonly rank: BeltRank
  readonly colorId: number
  readonly temperature?: number
  readonly normal?: number
  readonly power?: number
}

export interface RosterDiscrepancy {
  readonly bot: string
  readonly type: 'pool-overflow' | 'invalid-temperature'
  readonly details: string
}

export interface RosterValidationResult {
  readonly valid: boolean
  readonly discrepancies: readonly RosterDiscrepancy[]
}

const NORMAL_POOL_SIZE = 405
const POWER_POOL_SIZE = 104

/**
 * Validates the opponent roster overrides against pool sizes and temperature bounds.
 */
export function validateRoster(
  roster: readonly RosterEntry[] = rawRoster as unknown as readonly RosterEntry[],
): RosterValidationResult {
  const discrepancies: RosterDiscrepancy[] = []

  for (const bot of roster) {
    if (bot.normal !== undefined) {
      if (bot.normal < 0 || bot.normal > NORMAL_POOL_SIZE) {
        discrepancies.push({
          bot: bot.name,
          type: 'pool-overflow',
          details: `Bot ${bot.name} normal override ${bot.normal} exceeds pool size ${NORMAL_POOL_SIZE}`,
        })
      }
    }
    if (bot.power !== undefined) {
      if (bot.power < 0 || bot.power > POWER_POOL_SIZE) {
        discrepancies.push({
          bot: bot.name,
          type: 'pool-overflow',
          details: `Bot ${bot.name} power override ${bot.power} exceeds pool size ${POWER_POOL_SIZE}`,
        })
      }
    }
    if (bot.temperature !== undefined) {
      if (typeof bot.temperature !== 'number' || isNaN(bot.temperature) || bot.temperature < 0 || bot.temperature > 1) {
        discrepancies.push({
          bot: bot.name,
          type: 'invalid-temperature',
          details: `Bot ${bot.name} temperature ${bot.temperature} outside [0.0, 1.0]`,
        })
      } else {
        const clamped = clampTemperature(bot.temperature)
        if (clamped < 0 || clamped > 1) {
          discrepancies.push({
            bot: bot.name,
            type: 'invalid-temperature',
            details: `Bot ${bot.name} clamped temperature ${clamped} invalid`,
          })
        }
      }
    }
  }

  return {
    valid: discrepancies.length === 0,
    discrepancies,
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
      return {
        name: entry.name,
        belt: entry.belt,
        rank: BELT_TO_RANK[entry.belt],
        colorId: entry.colorId,
        ...(entry.temperature !== undefined ? { temperature: clampTemperature(entry.temperature) } : {}),
        ...(entry.normal !== undefined ? { normal: entry.normal } : {}),
        ...(entry.power !== undefined ? { power: entry.power } : {}),
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

  return {
    name: selected.name,
    belt: selected.belt,
    rank: targetRank,
    colorId: selected.colorId,
    ...(selected.temperature !== undefined ? { temperature: clampTemperature(selected.temperature) } : {}),
    ...(selected.normal !== undefined ? { normal: selected.normal } : {}),
    ...(selected.power !== undefined ? { power: selected.power } : {}),
  }
}

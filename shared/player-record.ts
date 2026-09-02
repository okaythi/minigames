import {
  isRecordOfStats,
  readField,
  type PlayerGameRecord,
  type PlayerRecord,
  type StatsEvent,
} from './stats-protocol'
import { isPlayerId, parseSyncCode } from './player-cookie'

/**
 * The rules that decide what one event does to a player's own row. Pure, and
 * shared by every storage implementation.
 */

export function emptyPlayerRecord(id: string): PlayerRecord {
  return { id, syncCode: null, highscore: null, candy: 0, games: {} }
}

const maxScore = (current: number | null, score: number): number =>
  current === null ? score : Math.max(current, score)

/** `null` when the event changes nothing about this player. */
export function applyPlayerEvent(
  record: PlayerRecord,
  game: string,
  event: StatsEvent,
): PlayerRecord | null {
  if (event.type === 'visit' || event.type === 'play') {
    return null
  }
  if (event.type === 'candy') {
    const amount = wholeCount(event.amount, MAX_CANDY_GRAB)
    if (amount === null || game.length === 0) {
      return null
    }
    const perGame = perGameFor(record, game)
    return {
      ...record,
      candy: Math.max(0, record.candy + amount),
      games: { ...record.games, [game]: { ...perGame, candy: Math.max(0, perGame.candy + amount) } },
    }
  }

  const score = wholeCount(event.score, MAX_SCORE)
  if (score === null) {
    return null
  }
  const perGame = perGameFor(record, game)
  const completedDifficulties = completedDifficultiesFor(perGame, event)
  return {
    ...record,
    highscore: maxScore(record.highscore, score),
    games:
      game.length === 0
        ? record.games
        : {
            ...record.games,
            [game]: {
              ...perGame,
              highscore: maxScore(perGame.highscore, score),
              completedDifficulties,
            },
          },
  }
}

const completedDifficultiesFor = (
  record: PlayerGameRecord,
  event: StatsEvent,
): readonly string[] => {
  if (
    event.type !== 'score' ||
    event.won !== true ||
    typeof event.difficulty !== 'string' ||
    event.difficulty.length === 0
  ) {
    return record.completedDifficulties
  }
  return record.completedDifficulties.includes(event.difficulty)
    ? record.completedDifficulties
    : [...record.completedDifficulties, event.difficulty]
}

/**
 * What a device that had never seen this account knows, folded into the account
 * it just claimed. Scores take the maximum, banks add up.
 */
export function mergePlayerRecords(target: PlayerRecord, incoming: PlayerRecord): PlayerRecord {
  const games: Record<string, PlayerGameRecord> = { ...target.games }
  for (const [slug, record] of Object.entries(incoming.games)) {
    const existing = games[slug]
    games[slug] =
      existing === undefined
        ? record
        : {
            highscore:
              existing.highscore === null
                ? record.highscore
                : maxScore(existing.highscore, record.highscore ?? 0),
            candy: existing.candy + record.candy,
            completedDifficulties: mergeDifficulties(
              existing.completedDifficulties,
              record.completedDifficulties,
            ),
          }
  }
  return {
    ...target,
    highscore:
      target.highscore === null ? incoming.highscore : maxScore(target.highscore, incoming.highscore ?? 0),
    candy: target.candy + incoming.candy,
    games,
  }
}

const mergeDifficulties = (
  left: readonly string[],
  right: readonly string[],
): readonly string[] => [...new Set([...left, ...right])]

const perGameFor = (record: PlayerRecord, game: string): PlayerGameRecord =>
  record.games[game] ?? { highscore: null, candy: 0, completedDifficulties: [] }

/** A number off the wire, bounded: nobody banks a million candy in one frame. */
const wholeCount = (value: number, max: number): number | null =>
  Number.isFinite(value) && Math.abs(value) <= max ? Math.floor(value) : null

const MAX_CANDY_GRAB = 10000
const MAX_SCORE = 1_000_000

// --- parsing: the same shape, validated on the way in -------------------------

export function readCompletedDifficulties(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const result: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0 && entry.length <= 32 && !result.includes(entry)) {
      result.push(entry)
    }
  }
  return result
}

export function parsePlayerGameRecord(value: unknown): PlayerGameRecord | null {
  if (!isRecordOfStats(value)) {
    return null
  }
  const highscore = readField(value, 'highscore')
  const candy = readField(value, 'candy')
  if (highscore !== null && (typeof highscore !== 'number' || !Number.isFinite(highscore))) {
    return null
  }
  if (typeof candy !== 'number' || !Number.isFinite(candy)) {
    return null
  }
  return {
    highscore: highscore === null ? null : Math.floor(highscore),
    candy: Math.max(0, Math.floor(candy)),
    completedDifficulties: readCompletedDifficulties(readField(value, 'completedDifficulties')),
  }
}

export function parsePlayerRecord(value: unknown): PlayerRecord | null {
  if (!isRecordOfStats(value)) {
    return null
  }
  const id = readField(value, 'id')
  if (!isPlayerId(id)) {
    return null
  }
  const gamesRaw = readField(value, 'games')
  const games: Record<string, PlayerGameRecord> = {}
  if (isRecordOfStats(gamesRaw)) {
    for (const [slug, entry] of Object.entries(gamesRaw)) {
      const parsed = parsePlayerGameRecord(entry)
      if (parsed !== null) {
        games[slug] = parsed
      }
    }
  }
  const highscore = readField(value, 'highscore')
  const candy = readField(value, 'candy')
  return {
    id,
    syncCode: parseSyncCode(readField(value, 'syncCode')),
    highscore: typeof highscore === 'number' && Number.isFinite(highscore) ? Math.floor(highscore) : null,
    candy: typeof candy === 'number' && Number.isFinite(candy) ? Math.max(0, Math.floor(candy)) : 0,
    games,
  }
}

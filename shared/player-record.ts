import {
  isRecordOfStats,
  isUnlockablePongDifficulty,
  readField,
  type PlayerGameRecord,
  type PlayerRecord,
  type StatsEvent,
  type UnlockablePongDifficulty,
} from './stats-protocol'
import { isPlayerId, parseSyncCode } from './player-cookie'

/**
 * The rules that decide what one event does to a player's own row. Pure, and
 * shared by every storage implementation (D1 mirrors the same arithmetic in
 * SQL, the in-memory store and the Vite dev file run this), so "banked candy"
 * cannot mean three different things.
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
      candy: record.candy + amount,
      games: { ...record.games, [game]: { ...perGame, candy: perGame.candy + amount } },
    }
  }

  const score = wholeCount(event.score, MAX_SCORE)
  if (score === null) {
    return null
  }
  const perGame = perGameFor(record, game)
  const completedDifficulties = completedDifficultiesFor(game, perGame, event)
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
  game: string,
  record: PlayerGameRecord,
  event: StatsEvent,
): readonly UnlockablePongDifficulty[] => {
  if (game !== 'pong' || event.type !== 'score' || event.won !== true || !isUnlockablePongDifficulty(event.difficulty)) {
    return record.completedDifficulties
  }
  return record.completedDifficulties.includes(event.difficulty)
    ? record.completedDifficulties
    : [...record.completedDifficulties, event.difficulty]
}

/**
 * What a device that had never seen this account knows, folded into the account
 * it just claimed. Scores take the maximum, banks add up: two devices each
 * collected their own candy, and neither of those drops should be lost.
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
            completedDifficulties: mergeDifficulties(existing.completedDifficulties, record.completedDifficulties),
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
  left: readonly UnlockablePongDifficulty[],
  right: readonly UnlockablePongDifficulty[],
): readonly UnlockablePongDifficulty[] => [...new Set([...left, ...right])]

const perGameFor = (record: PlayerRecord, game: string): PlayerGameRecord =>
  record.games[game] ?? { highscore: null, candy: 0, completedDifficulties: [] }

/** A number off the wire, bounded: nobody banks a million candy in one frame. */
const wholeCount = (value: number, max: number): number | null =>
  Number.isFinite(value) && Math.abs(value) <= max ? Math.floor(value) : null

const MAX_CANDY_GRAB = 10000
const MAX_SCORE = 1_000_000

// --- parsing: the same shape, validated on the way in -------------------------

export function readCompletedDifficulties(value: unknown): readonly UnlockablePongDifficulty[] {
  if (!Array.isArray(value)) {
    return []
  }
  const result: UnlockablePongDifficulty[] = []
  for (const entry of value) {
    if (isUnlockablePongDifficulty(entry) && !result.includes(entry)) {
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

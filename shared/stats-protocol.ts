/**
 * Wire protocol shared by the browser client (src/services/stats) and the
 * Cloudflare Pages Function (functions/api/stats).
 *
 * Kept dependency-free on purpose: both `tsconfig.app.json` and
 * `tsconfig.functions.json` include this folder.
 */

export const STATS_ENDPOINT = '/api/stats' as const

/** Aggregate counters stored centrally, one record per game. */
export interface GameStatsRecord {
  /** How many times the game has been started, across every visitor. */
  readonly plays: number
  /** Highest score ever submitted by anyone. `null` until the first run. */
  readonly highscore: number | null
  /** Unix epoch (ms) of the last write, used for staleness checks in the UI. */
  readonly updatedAt: number
}

export type StatsMap = Readonly<Record<string, GameStatsRecord>>

/** One game, as this player left it. */
export type PongDifficulty = 'easy' | 'normal' | 'hard' | 'very-hard'
export type UnlockablePongDifficulty = Exclude<PongDifficulty, 'very-hard'>

export const isPongDifficulty = (value: unknown): value is PongDifficulty =>
  value === 'easy' || value === 'normal' || value === 'hard' || value === 'very-hard'

export const isUnlockablePongDifficulty = (value: unknown): value is UnlockablePongDifficulty =>
  value === 'easy' || value === 'normal' || value === 'hard'

export interface PlayerGameRecord {
  readonly highscore: number | null
  readonly candy: number
  /** Pong difficulties this player has won at least once. */
  readonly completedDifficulties: readonly UnlockablePongDifficulty[]
}

/**
 * The player's own row from `players` + `player_games`. This is what makes a
 * highscore survive a cache clear: it lives against the uuid, not the device.
 */
export interface PlayerRecord {
  readonly id: string
  /** `XXXX-XXXX`, the code you type on another device to take over this one. */
  readonly syncCode: string | null
  /** Best score across every game - the number shown to the player. */
  readonly highscore: number | null
  /** Global candy bank. */
  readonly candy: number
  readonly games: Readonly<Record<string, PlayerGameRecord>>
}

export interface StatsResponseBody {
  readonly ok: true
  readonly games: StatsMap
  /** Distinct anonymous players. `0` when the DB is not bound. */
  readonly uniquePlayers: number
  /** `null` when the edge has no row for this browser yet. */
  readonly player: PlayerRecord | null
  /** `false` when the deployment has no D1 database bound, so the client can
   *  stay quiet about a "global" number that is really only its own. */
  readonly distributed: boolean
}

export interface PlayEvent {
  readonly type: 'play'
}

export interface ScoreEvent {
  readonly type: 'score'
  readonly score: number
  /** Optional game progression metadata, currently used by Pong. */
  readonly difficulty?: PongDifficulty
  readonly won?: boolean
}

/** Sent once per page session: counts a visitor without counting a run. */
export interface VisitEvent {
  readonly type: 'visit'
}

/** A pickup banked by this player - global and per game, never an aggregate. */
export interface CandyEvent {
  readonly type: 'candy'
  readonly amount: number
}

export type StatsEvent = PlayEvent | ScoreEvent | VisitEvent | CandyEvent

export interface StatsEventRequestBody {
  readonly game: string
  readonly event: StatsEvent
  /** Stops a client from re-sending the same finished run (e.g. on retry). */
  readonly nonce: string
}

export interface StatsEventResponseBody {
  readonly ok: boolean
  readonly stats: GameStatsRecord | null
  readonly uniquePlayers?: number
  /** The player's own row after the event was applied, when there is one. */
  readonly player?: PlayerRecord | null
}

export const EMPTY_STATS_RECORD: GameStatsRecord = {
  plays: 0,
  highscore: null,
  updatedAt: 0,
}

/**
 * Pure reducer both the Pages Function and the Vite dev stand-in use, so the
 * two implementations cannot drift apart.
 */
export function applyStatsEvent(
  record: GameStatsRecord,
  event: StatsEvent,
  now: number,
): GameStatsRecord {
  // A visit only touches the players table, never a game's counters.
  if (event.type === 'visit') {
    return record
  }
  // Candy is banked against the player; the public record does not care.
  if (event.type === 'candy') {
    return record
  }
  if (event.type === 'play') {
    return { ...record, plays: record.plays + 1, updatedAt: now }
  }
  if (!Number.isFinite(event.score) || event.score < 0) {
    return record
  }
  const score = Math.floor(event.score)
  return {
    ...record,
    highscore: record.highscore === null ? score : Math.max(record.highscore, score),
    updatedAt: now,
  }
}

/**
 * Reads one property out of untrusted JSON. Narrowing `unknown` happens here so
 * every consumer is free of casts.
 */
export function readField(source: unknown, key: string): unknown {
  return typeof source === 'object' && source !== null ? Reflect.get(source, key) : undefined
}

export const isRecordOfStats = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Defensive parse of one record coming back from the edge: every field is
 * validated before it reaches typed code.
 */
export function parseGameStatsRecord(value: unknown): GameStatsRecord | null {
  if (!isRecordOfStats(value)) {
    return null
  }
  const plays = readField(value, 'plays')
  const highscore = readField(value, 'highscore')
  const updatedAt = readField(value, 'updatedAt')
  if (typeof plays !== 'number' || !Number.isFinite(plays) || plays < 0) {
    return null
  }
  if (highscore !== null && (typeof highscore !== 'number' || !Number.isFinite(highscore))) {
    return null
  }
  return {
    plays: Math.floor(plays),
    highscore: highscore === null ? null : Math.floor(highscore),
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0,
  }
}

/** Defensive parse of the aggregate payload; `null` when it is not usable. */
export function parseStatsResponse(
  value: unknown,
): { games: StatsMap; uniquePlayers: number; distributed: boolean } | null {
  if (!isRecordOfStats(value)) {
    return null
  }
  const gamesRaw = readField(value, 'games')
  if (!isRecordOfStats(gamesRaw)) {
    return null
  }
  const games: Record<string, GameStatsRecord> = {}
  for (const [key, entry] of Object.entries(gamesRaw)) {
    const parsed = parseGameStatsRecord(entry)
    if (parsed !== null) {
      games[key] = parsed
    }
  }
  return {
    games,
    uniquePlayers: readCount(readField(value, 'uniquePlayers')),
    distributed: readField(value, 'distributed') === true,
  }
}

/** A counter off the wire: non-negative whole number, or 0. */
function readCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

export function parseStatsEventBody(value: unknown): StatsEventRequestBody | null {
  if (!isRecordOfStats(value)) {
    return null
  }
  const game = readField(value, 'game')
  const nonce = readField(value, 'nonce')
  if (typeof game !== 'string' || typeof nonce !== 'string' || nonce.length === 0) {
    return null
  }
  const cleanNonce = nonce.slice(0, 64)
  const eventRaw = readField(value, 'event')
  const type = readField(eventRaw, 'type')
  if (type === 'visit' || type === 'play') {
    return { game, event: { type }, nonce: cleanNonce }
  }
  if (type === 'score' || type === 'candy') {
    const key = type === 'score' ? 'score' : 'amount'
    const amount = readField(eventRaw, key)
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return null
    }
    if (type === 'score' && amount < 0) {
      return null
    }
    if (type === 'candy') {
      return { game, event: { type: 'candy', amount: Math.floor(amount) }, nonce: cleanNonce }
    }

    const difficulty = readField(eventRaw, 'difficulty')
    const won = readField(eventRaw, 'won')
    if (difficulty !== undefined && !isPongDifficulty(difficulty)) {
      return null
    }
    if (won !== undefined && typeof won !== 'boolean') {
      return null
    }
    const event: ScoreEvent = {
      type: 'score',
      score: Math.floor(amount),
      ...(difficulty === undefined ? {} : { difficulty }),
      ...(won === undefined ? {} : { won }),
    }
    return { game, event, nonce: cleanNonce }
  }
  return null
}

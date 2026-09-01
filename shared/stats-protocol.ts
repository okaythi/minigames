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

export interface StatsResponseBody {
  readonly ok: true
  readonly games: StatsMap
  /** Distinct anonymous visitors ever seen. `0` when the DB is not bound. */
  readonly uniquePlayers: number
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
}

/** Sent once per page session: counts a visitor without counting a run. */
export interface VisitEvent {
  readonly type: 'visit'
}

export type StatsEvent = PlayEvent | ScoreEvent | VisitEvent

export interface StatsEventRequestBody {
  readonly game: string
  readonly event: StatsEvent
  /** Stops a client from re-sending the same finished run (e.g. on retry). */
  readonly nonce: string
  /** Anonymous, stable per browser. Absent means "don't count a player". */
  readonly playerId?: string
}

export interface StatsEventResponseBody {
  readonly ok: boolean
  readonly stats: GameStatsRecord | null
  readonly uniquePlayers?: number
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
  const playerId = readPlayerId(value)
  const eventRaw = readField(value, 'event')
  const type = readField(eventRaw, 'type')
  if (type === 'visit') {
    // A visit needs somebody to visit; without an id there is nothing to count.
    return playerId === null ? null : { game, event: { type: 'visit' }, nonce: cleanNonce, playerId }
  }
  if (type === 'play') {
    return { game, event: { type: 'play' }, nonce: cleanNonce, ...(playerId === null ? {} : { playerId }) }
  }
  const score = readField(eventRaw, 'score')
  if (type === 'score' && typeof score === 'number' && Number.isFinite(score)) {
    return {
      game,
      event: { type: 'score', score },
      nonce: cleanNonce,
      ...(playerId === null ? {} : { playerId }),
    }
  }
  return null
}

/** The anonymous browser id, shape-checked (`crypto.randomUUID()` output). */
export function readPlayerId(value: unknown): string | null {
  const raw = readField(value, 'playerId')
  if (typeof raw !== 'string' || raw.length < 8 || raw.length > 64) {
    return null
  }
  return /^[A-Za-z0-9_-]+$/.test(raw) ? raw : null
}

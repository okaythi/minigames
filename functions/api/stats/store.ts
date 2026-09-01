/// <reference types="@cloudflare/workers-types" />

import {
  applyStatsEvent,
  EMPTY_STATS_RECORD,
  type GameStatsRecord,
  type StatsEvent,
  type StatsMap,
} from '../../../shared/stats-protocol'

/**
 * Storage for the counters, with two interchangeable implementations:
 *
 *  - `d1Store()`   Cloudflare D1 (binding `NIXLABS_DB`, see migrations/0001_init.sql)
 *  - `memoryStore()` no binding at all - a fork, a bare `pages dev`, a preview
 *
 * The HTTP layer only ever talks to `StatsStore`, so the route behaves the same
 * with or without the database; it just reports `distributed: false`.
 */

export interface StatsRequest {
  readonly game: string
  readonly event: StatsEvent
  readonly nonce: string
  readonly playerId: string | null
}

export interface StatsSnapshot {
  readonly games: StatsMap
  readonly uniquePlayers: number
}

export interface StatsStore {
  /** Everything the GET route needs to answer in one round trip. */
  readonly snapshot: () => Promise<StatsSnapshot>
  /** Applies one event and returns the game's record afterwards. */
  readonly apply: (request: StatsRequest) => Promise<GameStatsRecord>
  readonly distributed: boolean
}

interface StatsRow {
  readonly slug: string
  readonly plays: number
  readonly highscore: number | null
  readonly updated_at: number
}

interface CountRow {
  readonly total: number
}

const toRecord = (row: StatsRow): GameStatsRecord => ({
  plays: row.plays,
  highscore: row.highscore,
  updatedAt: row.updated_at,
})

export function d1Store(db: D1Database): StatsStore {
  const readAll = async (): Promise<StatsSnapshot> => {
    const [stats, players] = await Promise.all([
      db.prepare('SELECT slug, plays, highscore, updated_at FROM game_stats').all<StatsRow>(),
      db
        .prepare('SELECT COUNT(*) AS total FROM players')
        .first<CountRow>(),
    ])
    const games: Record<string, GameStatsRecord> = {}
    for (const row of stats.results) {
      games[row.slug] = toRecord(row)
    }
    return { games, uniquePlayers: players?.total ?? 0 }
  }

  const upsertStats = async (slug: string, event: StatsEvent, now: number): Promise<void> => {
    if (event.type === 'visit') {
      return
    }
    if (event.type === 'play') {
      await db
        .prepare(
          `INSERT INTO game_stats (slug, plays, highscore, updated_at)
           VALUES (?1, 1, NULL, ?2)
           ON CONFLICT(slug) DO UPDATE
             SET plays = game_stats.plays + 1, updated_at = excluded.updated_at`,
        )
        .bind(slug, now)
        .run()
      return
    }
    await db
      .prepare(
        `INSERT INTO game_stats (slug, plays, highscore, updated_at)
         VALUES (?1, 0, ?2, ?3)
         ON CONFLICT(slug) DO UPDATE
           SET highscore = MAX(COALESCE(game_stats.highscore, 0), excluded.highscore),
               updated_at = excluded.updated_at`,
      )
      .bind(slug, event.score, now)
      .run()
  }

  const upsertPlayer = async (
    playerId: string,
    event: StatsEvent,
    now: number,
  ): Promise<void> => {
    const runs = event.type === 'play' || event.type === 'visit' ? 1 : 0
    const best = event.type === 'score' ? event.score : null
    await db
      .prepare(
        `INSERT INTO players (id, first_seen, last_seen, runs, best_score)
         VALUES (?1, ?2, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE
           SET last_seen = excluded.last_seen,
               runs = players.runs + ?3,
               best_score = CASE
                 WHEN ?4 IS NULL THEN players.best_score
                 ELSE MAX(COALESCE(players.best_score, 0), ?4)
               END`,
      )
      .bind(playerId, now, runs, best)
      .run()
  }

  const claimNonce = async (nonce: string, now: number): Promise<boolean> => {
    const result = await db
      .prepare('INSERT OR IGNORE INTO seen_nonces (nonce, seen_at) VALUES (?1, ?2)')
      .bind(nonce, now)
      .run()
    return result.meta.changes === 1
  }

  const pruneNonces = async (): Promise<void> => {
    // Keep the table bounded; 24h of replay protection is plenty.
    await db
      .prepare('DELETE FROM seen_nonces WHERE seen_at < ?1')
      .bind(Date.now() - 24 * 60 * 60 * 1000)
      .run()
  }

  return {
    distributed: true,
    snapshot: readAll,
    async apply(request: StatsRequest): Promise<GameStatsRecord> {
      const now = Date.now()
      if (!(await claimNonce(request.nonce, now))) {
        const current = await readAll()
        return current.games[request.game] ?? EMPTY_STATS_RECORD
      }
      await upsertStats(request.game, request.event, now)
      if (request.playerId !== null) {
        await upsertPlayer(request.playerId, request.event, now)
      }
      await pruneNonces()
      const updated = await readAll()
      return updated.games[request.game] ?? EMPTY_STATS_RECORD
    },
  }
}

export function memoryStore(slugs: readonly string[]): StatsStore {
  const games = new Map<string, GameStatsRecord>(slugs.map((slug) => [slug, EMPTY_STATS_RECORD]))
  const players = new Set<string>()
  const nonces = new Set<string>()

  return {
    distributed: false,
    async snapshot(): Promise<StatsSnapshot> {
      return { games: Object.fromEntries(games) as StatsMap, uniquePlayers: players.size }
    },
    async apply(request: StatsRequest): Promise<GameStatsRecord> {
      if (nonces.has(request.nonce)) {
        return games.get(request.game) ?? EMPTY_STATS_RECORD
      }
      nonces.add(request.nonce)
      if (nonces.size > 512) {
        nonces.clear()
        nonces.add(request.nonce)
      }
      if (request.playerId !== null) {
        players.add(request.playerId)
      }
      // A site-wide visit has no game row to touch.
      if (request.game.length === 0) {
        return EMPTY_STATS_RECORD
      }
      const next = applyStatsEvent(
        games.get(request.game) ?? EMPTY_STATS_RECORD,
        request.event,
        Date.now(),
      )
      games.set(request.game, next)
      return next
    },
  }
}

/// <reference types="@cloudflare/workers-types" />

import {
  EMPTY_STATS_RECORD,
  isUnlockablePongDifficulty,
  type GameStatsRecord,
  type PlayerGameRecord,
  type PlayerRecord,
  type StatsEvent,
  type StatsMap,
} from '../../../shared/stats-protocol'
import { mergePlayerRecords, readCompletedDifficulties } from '../../../shared/player-record'
import { mintSyncCode } from '../../../shared/player-cookie'
import type { StatsApplyResult, StatsRequest, StatsSnapshot, StatsStore } from '../../../shared/stats-store'

/**
 * The D1 implementation. Every statement is written so that a replay of the same
 * event is a no-op, and so a score can only ever go up: the aggregate tables
 * use `MAX`, the banks use `+`, and neither trusts the client to remember.
 */

interface GameRow {
  readonly slug: string
  readonly plays: number
  readonly highscore: number | null
  readonly updated_at: number
}

interface PlayerRow {
  readonly id: string
  readonly sync_code: string | null
  readonly fingerprint: string | null
  readonly highscore: number | null
  readonly candy: number
}

interface PlayerGameRow {
  readonly slug: string
  readonly highscore: number | null
  readonly candy: number
}

interface PongDifficultyRow {
  readonly difficulty: string
}

interface CountRow {
  readonly total: number
}

const toRecord = (row: GameRow): GameStatsRecord => ({
  plays: row.plays,
  highscore: row.highscore,
  updatedAt: row.updated_at,
})

export function d1Store(db: D1Database): StatsStore {
  const readGames = async (): Promise<StatsMap> => {
    const result = await db
      .prepare('SELECT slug, plays, highscore, updated_at FROM game_stats')
      .all<GameRow>()
    const games: Record<string, GameStatsRecord> = {}
    for (const row of result.results) {
      games[row.slug] = toRecord(row)
    }
    return games
  }

  const countPlayers = async (): Promise<number> => {
    const row = await db.prepare('SELECT COUNT(*) AS total FROM players').first<CountRow>()
    return row?.total ?? 0
  }

  /** A row without a code is a row that cannot be moved to another device. */
  const mintCode = async (playerId: string): Promise<string | null> => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = mintSyncCode(Math.random)
      const taken = await db
        .prepare('SELECT 1 AS taken FROM players WHERE sync_code = ?1')
        .bind(code)
        .first()
      if (taken === null) {
        await db.prepare('UPDATE players SET sync_code = ?2 WHERE id = ?1').bind(playerId, code).run()
        return code
      }
    }
    return null
  }

  const readPlayer = async (playerId: string): Promise<PlayerRecord | null> => {
    const row = await db
      .prepare('SELECT id, sync_code, fingerprint, highscore, candy FROM players WHERE id = ?1')
      .bind(playerId)
      .first<PlayerRow>()
    if (row === null) {
      return null
    }
    const syncCode = row.sync_code ?? (await mintCode(playerId))
    const [games, difficultyRows] = await Promise.all([
      db
        .prepare('SELECT slug, highscore, candy FROM player_games WHERE player_id = ?1')
        .bind(playerId)
        .all<PlayerGameRow>(),
      db
        .prepare('SELECT difficulty FROM player_pong_difficulties WHERE player_id = ?1')
        .bind(playerId)
        .all<PongDifficultyRow>(),
    ])
    const perGame: Record<string, PlayerGameRecord> = {}
    for (const entry of games.results) {
      perGame[entry.slug] = { highscore: entry.highscore, candy: entry.candy, completedDifficulties: [] }
    }
    const completedDifficulties = readCompletedDifficulties(difficultyRows.results.map((entry) => entry.difficulty))
    if (completedDifficulties.length > 0) {
      const pong = perGame['pong'] ?? { highscore: null, candy: 0, completedDifficulties: [] }
      perGame['pong'] = { ...pong, completedDifficulties }
    }
    return {
      id: row.id,
      syncCode,
      highscore: row.highscore,
      candy: row.candy,
      games: perGame,
    }
  }

  const touchPlayer = async (request: StatsRequest, now: number): Promise<void> => {
    const playerId = request.playerId
    if (playerId === null) {
      return
    }
    await db
      .prepare(
        `INSERT INTO players (id, sync_code, fingerprint, first_seen, last_seen, highscore, candy)
         VALUES (?1, NULL, ?2, ?3, ?3, NULL, 0)
         ON CONFLICT(id) DO UPDATE
           SET last_seen = excluded.last_seen,
               fingerprint = COALESCE(players.fingerprint, excluded.fingerprint)`,
      )
      .bind(playerId, request.fingerprint, now)
      .run()
  }

  const bumpGames = async (game: string, event: StatsEvent, now: number): Promise<void> => {
    if (event.type === 'visit' || event.type === 'candy' || game.length === 0) {
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
        .bind(game, now)
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
      .bind(game, event.score, now)
      .run()
  }

  /** The player's own copy of the same event: their row and their game row. */
  const bumpPlayer = async (
    playerId: string,
    game: string,
    event: StatsEvent,
    now: number,
  ): Promise<void> => {
    if (event.type === 'score') {
      if (game.length > 0) {
        await db
          .prepare(
            `INSERT INTO player_games (player_id, slug, highscore, candy, updated_at)
             VALUES (?1, ?2, ?3, 0, ?4)
             ON CONFLICT(player_id, slug) DO UPDATE
               SET highscore = MAX(COALESCE(player_games.highscore, 0), excluded.highscore),
                   updated_at = excluded.updated_at`,
          )
          .bind(playerId, game, event.score, now)
          .run()
      }
      await db
        .prepare(
          `UPDATE players
             SET highscore = MAX(COALESCE(highscore, 0), ?2), last_seen = ?3
           WHERE id = ?1`,
        )
        .bind(playerId, event.score, now)
        .run()
      if (game === 'pong' && event.won === true && isUnlockablePongDifficulty(event.difficulty)) {
        await db
          .prepare(
            `INSERT OR IGNORE INTO player_pong_difficulties (player_id, difficulty, completed_at)
             VALUES (?1, ?2, ?3)`,
          )
          .bind(playerId, event.difficulty, now)
          .run()
      }
      return
    }
    if (event.type === 'candy' && game.length > 0) {
      await db
        .prepare(
          `INSERT INTO player_games (player_id, slug, highscore, candy, updated_at)
           VALUES (?1, ?2, NULL, ?3, ?4)
           ON CONFLICT(player_id, slug) DO UPDATE
             SET candy = player_games.candy + excluded.candy, updated_at = excluded.updated_at`,
        )
        .bind(playerId, game, event.amount, now)
        .run()
      await db
        .prepare('UPDATE players SET candy = players.candy + ?2, last_seen = ?3 WHERE id = ?1')
        .bind(playerId, event.amount, now)
        .run()
    }
  }

  const claimNonce = async (nonce: string, now: number): Promise<boolean> => {
    const result = await db
      .prepare('INSERT OR IGNORE INTO seen_nonces (nonce, seen_at) VALUES (?1, ?2)')
      .bind(nonce, now)
      .run()
    return result.meta.changes === 1
  }

  const pruneNonces = async (): Promise<void> => {
    // A day of replay protection is plenty; the table must not grow forever.
    await db
      .prepare('DELETE FROM seen_nonces WHERE seen_at < ?1')
      .bind(Date.now() - 24 * 60 * 60 * 1000)
      .run()
  }

  const writeMergedPlayer = async (target: PlayerRecord): Promise<void> => {
    await db
      .prepare('UPDATE players SET highscore = ?2, candy = ?3 WHERE id = ?1')
      .bind(target.id, target.highscore, target.candy)
      .run()
    await db.prepare('DELETE FROM player_games WHERE player_id = ?1').bind(target.id).run()
    await db.prepare('DELETE FROM player_pong_difficulties WHERE player_id = ?1').bind(target.id).run()
    for (const [slug, record] of Object.entries(target.games)) {
      await db
        .prepare(
          `INSERT INTO player_games (player_id, slug, highscore, candy, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(target.id, slug, record.highscore, record.candy, Date.now())
        .run()
    }
    for (const difficulty of target.games['pong']?.completedDifficulties ?? []) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO player_pong_difficulties (player_id, difficulty, completed_at)
           VALUES (?1, ?2, ?3)`,
        )
        .bind(target.id, difficulty, Date.now())
        .run()
    }
  }

  return {
    distributed: true,

    async snapshot(playerId): Promise<StatsSnapshot> {
      const [games, uniquePlayers, player] = await Promise.all([
        readGames(),
        countPlayers(),
        playerId === null ? Promise.resolve(null) : readPlayer(playerId),
      ])
      return { games, uniquePlayers, player }
    },

    findPlayerByFingerprint: async (fingerprint) => {
      const row = await db
        .prepare('SELECT id FROM players WHERE fingerprint = ?1 ORDER BY last_seen DESC LIMIT 1')
        .bind(fingerprint)
        .first<{ readonly id: string }>()
      return row?.id ?? null
    },

    claimSyncCode: async (syncCode, sourcePlayerId) => {
      const owner = await db
        .prepare('SELECT id FROM players WHERE sync_code = ?1')
        .bind(syncCode)
        .first<{ readonly id: string }>()
      if (owner === null) {
        return null
      }
      const target = await readPlayer(owner.id)
      if (target === null) {
        return null
      }
      if (sourcePlayerId === null || sourcePlayerId === owner.id) {
        return target
      }
      const source = await readPlayer(sourcePlayerId)
      const merged = source === null ? target : mergePlayerRecords(target, source)
      await writeMergedPlayer(merged)
      await db.prepare('DELETE FROM player_games WHERE player_id = ?1').bind(sourcePlayerId).run()
      await db.prepare('DELETE FROM player_pong_difficulties WHERE player_id = ?1').bind(sourcePlayerId).run()
      await db.prepare('DELETE FROM players WHERE id = ?1').bind(sourcePlayerId).run()
      return readPlayer(owner.id)
    },

    async apply(request): Promise<StatsApplyResult> {
      const now = Date.now()
      const fresh = await claimNonce(request.nonce, now)
      if (fresh) {
        await touchPlayer(request, now)
        await bumpGames(request.game, request.event, now)
        if (request.playerId !== null) {
          await bumpPlayer(request.playerId, request.game, request.event, now)
        }
        await pruneNonces()
      }
      const [games, uniquePlayers, player] = await Promise.all([
        readGames(),
        countPlayers(),
        request.playerId === null ? Promise.resolve(null) : readPlayer(request.playerId),
      ])
      return {
        stats: games[request.game] ?? EMPTY_STATS_RECORD,
        player,
        uniquePlayers,
      }
    },
  }
}

/// <reference types="@cloudflare/workers-types" />

import type { PlayerGameRecord, PlayerRecord, StatsEvent } from '../../../shared/stats-protocol'
import { readCompletedDifficulties } from '../../../shared/player-record'
import { mintSyncCode } from '../../../shared/player-cookie'
import type { StatsRequest } from '../../../shared/stats-store'

export interface PlayerRow {
  readonly id: string
  readonly sync_code: string | null
  readonly fingerprint: string | null
  readonly highscore: number | null
  readonly candy: number
}

export interface PlayerGameRow {
  readonly slug: string
  readonly highscore: number | null
  readonly candy: number
}

export interface PongDifficultyRow {
  readonly difficulty: string
}

export interface CountRow {
  readonly total: number
}

export async function countPlayers(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS total FROM players').first<CountRow>()
  return row?.total ?? 0
}

/** A row without a code is a row that cannot be moved to another device. */
export async function mintCode(db: D1Database, playerId: string): Promise<string | null> {
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

export async function readPlayer(db: D1Database, playerId: string): Promise<PlayerRecord | null> {
  const row = await db
    .prepare('SELECT id, sync_code, fingerprint, highscore, candy FROM players WHERE id = ?1')
    .bind(playerId)
    .first<PlayerRow>()
  if (row === null) {
    return null
  }
  const syncCode = row.sync_code ?? (await mintCode(db, playerId))
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

export async function touchPlayer(db: D1Database, request: StatsRequest, now: number): Promise<void> {
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

/** The player's own copy of the same event: their row and their game row. */
export async function bumpPlayer(
  db: D1Database,
  playerId: string,
  game: string,
  event: StatsEvent,
  now: number,
): Promise<void> {
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
    if (game === 'pong' && event.won === true && typeof event.difficulty === 'string') {
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

export async function writeMergedPlayer(db: D1Database, target: PlayerRecord): Promise<void> {
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

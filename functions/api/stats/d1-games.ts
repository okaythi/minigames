/// <reference types="@cloudflare/workers-types" />

import type { GameStatsRecord, StatsEvent, StatsMap } from '../../../shared/stats-protocol'

interface GameRow {
  readonly slug: string
  readonly plays: number
  readonly highscore: number | null
  readonly updated_at: number
}

const toRecord = (row: GameRow): GameStatsRecord => ({
  plays: row.plays,
  highscore: row.highscore,
  updatedAt: row.updated_at,
})

export async function readGames(db: D1Database): Promise<StatsMap> {
  const result = await db
    .prepare('SELECT slug, plays, highscore, updated_at FROM game_stats')
    .all<GameRow>()
  const games: Record<string, GameStatsRecord> = {}
  for (const row of result.results) {
    games[row.slug] = toRecord(row)
  }
  return games
}

export async function bumpGames(
  db: D1Database,
  game: string,
  event: StatsEvent,
  now: number,
): Promise<void> {
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

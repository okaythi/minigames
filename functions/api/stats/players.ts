import { jsonResponse } from './respond'
import type { StatsEnv } from './store-for'

interface DebugPlayerRow {
  readonly id: string
  readonly sync_code: string | null
  readonly fingerprint: string | null
  readonly first_seen: number
  readonly last_seen: number
  readonly highscore: number | null
  readonly candy: number
}

/**
 * Dev-only: list players for debugging unique-player counts.
 * Must be requested with header `x-debug: 1` to avoid exposure.
 */
export const onRequestGet = async ({ request, env }: { request: Request; env: StatsEnv }): Promise<Response> => {
  if (request.headers.get('x-debug') !== '1') {
    return jsonResponse(403, { ok: false, error: 'forbidden' })
  }
  const db = env.NIXLABS_DB
  if (!db) {
    return jsonResponse(400, { ok: false, error: 'no database binding' })
  }
  const rows = await db
    .prepare(
      `SELECT id, sync_code, fingerprint, first_seen, last_seen, highscore, candy
       FROM players
       ORDER BY last_seen DESC
       LIMIT 200`,
    )
    .all<DebugPlayerRow>()
  return jsonResponse(200, { ok: true, count: rows.results.length, rows: rows.results })
}

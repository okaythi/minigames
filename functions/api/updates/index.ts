import { drizzle } from 'drizzle-orm/d1'
import { jsonResponse } from '../stats/respond'
import { loadReleaseAggregates } from './_load'

interface PagesContext {
  readonly request: Request
  readonly env: { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ env }: PagesContext): Promise<Response> => {
  if (!env.NIXLABS_DB) {
    return jsonResponse(200, { ok: true, releases: [] })
  }

  const db = drizzle(env.NIXLABS_DB)
  const published = await loadReleaseAggregates(db, ['published'])

  return jsonResponse(200, { ok: true, releases: published })
}

import { drizzle } from 'drizzle-orm/d1'
import { gameOverrides } from '../../../../src/db/schema'
import { GAME_REGISTRY } from '../../../../shared/game-registry.config'
import { jsonResponse } from '../../stats/respond'
import type { StatsEnv } from '../../stats/store-for'
import { requireGamesAdmin } from './_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requireGamesAdmin(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const overridesList = await db.select().from(gameOverrides).all()
  const overridesMap = new Map(overridesList.map((o) => [o.slug, o]))

  const merged = GAME_REGISTRY.map((entry) => {
    const override = overridesMap.get(entry.slug)
    const status = override?.status ?? (entry.enabled ? 'published' : 'hidden')
    const flags = override ? override.flags : (entry.flags ?? 0)

    return {
      slug: entry.slug,
      title: entry.title,
      source: entry.source,
      defaultEnabled: entry.enabled,
      status, // 'published' | 'maintenance' | 'hidden'
      flags,
      hasOverride: override !== undefined,
      updatedBy: override?.updatedBy ?? null,
      updatedAt: override?.updatedAt ?? null,
    }
  })

  return jsonResponse(200, {
    ok: true,
    games: merged,
  })
}

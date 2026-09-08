import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { gameOverrides } from '../../../../../src/db/schema'
import { findRegistryEntry } from '../../../../../shared/game-registry.config'
import { writeAudit } from '../../_shared/audit'
import { readJsonBody } from '../../../stats/body'
import { jsonResponse, badRequest } from '../../../stats/respond'
import type { StatsEnv } from '../../../stats/store-for'
import { requireGamesAdmin } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { slug: string }
}

export const onRequestPost = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireGamesAdmin(request, env)
  if (!auth.ok) return auth.response

  const slug = params.slug
  const baseEntry = findRegistryEntry(slug)
  if (!baseEntry) {
    return badRequest(`Unknown game slug '${slug}'`)
  }

  const json = await readJsonBody(request)
  const { status, flags, reason } = (json || {}) as {
    status?: string
    flags?: number
    reason?: string
  }

  if (status && !['published', 'maintenance', 'hidden'].includes(status)) {
    return badRequest("status must be 'published', 'maintenance', or 'hidden'")
  }

  const targetStatus = status || 'published'
  const targetFlags = typeof flags === 'number' && !isNaN(flags) ? Math.floor(flags) : 0
  const now = Date.now()

  const db = drizzle(env.NIXLABS_DB)
  const existingOverride = await db.select().from(gameOverrides).where(eq(gameOverrides.slug, slug)).get()

  if (existingOverride) {
    await db
      .update(gameOverrides)
      .set({
        status: targetStatus,
        flags: targetFlags,
        updatedBy: auth.user.playerId,
        updatedAt: now,
      })
      .where(eq(gameOverrides.slug, slug))
  } else {
    await db.insert(gameOverrides).values({
      slug,
      status: targetStatus,
      flags: targetFlags,
      updatedBy: auth.user.playerId,
      updatedAt: now,
    })
  }

  await writeAudit(db, {
    actorPlayerId: auth.user.playerId,
    action: 'game.override_update',
    targetType: 'game',
    targetId: slug,
    reason: reason?.trim() || `Updated status to ${targetStatus}`,
    metadata: {
      slug,
      before: existingOverride ? { status: existingOverride.status, flags: existingOverride.flags } : null,
      after: { status: targetStatus, flags: targetFlags },
    },
  })

  return jsonResponse(200, {
    ok: true,
    slug,
    status: targetStatus,
    flags: targetFlags,
  })
}

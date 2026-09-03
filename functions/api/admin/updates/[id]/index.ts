import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { updateReleases } from '../../../../../src/db/schema'
import { jsonResponse } from '../../../stats/respond'
import type { StatsEnv } from '../../../stats/store-for'
import { requireCmsEditor } from '../_auth'
import { loadReleaseAggregateById } from '../../../updates/_load'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

export const onRequestGet = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const aggregate = await loadReleaseAggregateById(db, params.id)

  if (!aggregate) {
    return jsonResponse(404, { ok: false, error: 'Release not found' })
  }

  return jsonResponse(200, { ok: true, release: aggregate })
}

export const onRequestDelete = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const release = await db.select().from(updateReleases).where(eq(updateReleases.id, params.id)).get()

  if (!release) {
    return jsonResponse(404, { ok: false, error: 'Release not found' })
  }

  if (release.status === 'published') {
    return jsonResponse(400, {
      ok: false,
      error: 'Cannot delete published release. Archive it instead.',
    })
  }

  await db.delete(updateReleases).where(eq(updateReleases.id, params.id))

  return jsonResponse(200, { ok: true })
}

import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { updateReleases } from '../../../../../src/db/schema'
import { jsonResponse } from '../../../stats/respond'
import type { StatsEnv } from '../../../stats/store-for'
import { requireCmsEditor } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

export const onRequestPost = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const existing = await db.select().from(updateReleases).where(eq(updateReleases.id, params.id)).get()

  if (!existing) {
    return jsonResponse(404, { ok: false, error: 'Release not found' })
  }

  const now = Date.now()
  await db
    .update(updateReleases)
    .set({
      status: 'published',
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(updateReleases.id, params.id))

  return jsonResponse(200, { ok: true })
}

import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { updateRationales, updateReleases } from '../../../../../src/db/schema'
import { jsonResponse } from '../../../stats/respond'
import { readJsonBody } from '../../../stats/body'
import type { StatsEnv } from '../../../stats/store-for'
import { requireCmsEditor } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

interface RationaleBody {
  readonly content?: string
  readonly authorUsername?: string
}

export const onRequestPut = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const body = (await readJsonBody(request)) as RationaleBody
  if (!body || typeof body.content !== 'string' || body.content.trim().length === 0) {
    return jsonResponse(400, { ok: false, error: 'Rationale content must be a non-empty string' })
  }

  const db = drizzle(env.NIXLABS_DB)
  const existingRelease = await db
    .select()
    .from(updateReleases)
    .where(eq(updateReleases.id, params.id))
    .get()

  if (!existingRelease) {
    return jsonResponse(404, { ok: false, error: 'Release not found' })
  }

  const content = body.content.trim()
  const authorUsername = body.authorUsername?.trim() || auth.user.username
  const now = Date.now()

  const existingRat = await db
    .select()
    .from(updateRationales)
    .where(eq(updateRationales.releaseId, params.id))
    .get()

  if (existingRat) {
    await db
      .update(updateRationales)
      .set({
        content,
        authorUsername,
        updatedAt: now,
      })
      .where(eq(updateRationales.releaseId, params.id))
  } else {
    await db.insert(updateRationales).values({
      releaseId: params.id,
      content,
      authorUsername,
      updatedAt: now,
    })
  }

  return jsonResponse(200, { ok: true })
}

import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { updateReleases } from '../../../../../src/db/schema'
import { parseUpdateReleaseMetaInput } from '../../../../../src/engine/updates/parser'
import { jsonResponse } from '../../../stats/respond'
import { readJsonBody } from '../../../stats/body'
import type { StatsEnv } from '../../../stats/store-for'
import { requireCmsEditor } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

export const onRequestPatch = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const raw = await readJsonBody(request)
  const parsed = parseUpdateReleaseMetaInput(raw)

  if (!parsed.ok) {
    return jsonResponse(400, { ok: false, errors: parsed.errors })
  }

  const patch = parsed.value
  const db = drizzle(env.NIXLABS_DB)

  const existing = await db.select().from(updateReleases).where(eq(updateReleases.id, params.id)).get()
  if (!existing) {
    return jsonResponse(404, { ok: false, error: 'Release not found' })
  }

  await db
    .update(updateReleases)
    .set({
      ...(patch.globalVersion !== undefined && { globalVersion: patch.globalVersion }),
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.headline !== undefined && { headline: patch.headline }),
      ...(patch.releaseDate !== undefined && { releaseDate: patch.releaseDate }),
      ...(patch.authorUsername !== undefined && { authorUsername: patch.authorUsername }),
      ...(patch.status !== undefined && { status: patch.status }),
      updatedAt: Date.now(),
    })
    .where(eq(updateReleases.id, params.id))

  return jsonResponse(200, { ok: true })
}

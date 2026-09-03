import { drizzle } from 'drizzle-orm/d1'
import { updateReleases, updateRationales } from '../../../../src/db/schema'
import { parseCreateReleaseInput } from '../../../../src/engine/updates/parser'
import { asReleaseId } from '../../../../src/engine/updates/types'
import { jsonResponse } from '../../stats/respond'
import { readJsonBody } from '../../stats/body'
import type { StatsEnv } from '../../stats/store-for'
import { requireCmsEditor } from './_auth'
import { loadReleaseAggregates } from '../../updates/_load'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  // Retrieve all releases so the CMS authoring view can manage drafts, review, and published
  const all = await loadReleaseAggregates(db)
  return jsonResponse(200, { ok: true, releases: all })
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const raw = await readJsonBody(request)
  const parsed = parseCreateReleaseInput(raw)

  if (!parsed.ok) {
    return jsonResponse(400, { ok: false, errors: parsed.errors })
  }

  const input = parsed.value
  const id = asReleaseId(`rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  const now = Date.now()

  const db = drizzle(env.NIXLABS_DB)

  await db.insert(updateReleases).values({
    id,
    globalVersion: input.globalVersion,
    title: input.title,
    headline: input.headline,
    status: 'draft',
    releaseDate: input.releaseDate,
    authorUsername: input.authorUsername ?? auth.user.username,
    createdAt: now,
    updatedAt: now,
  })

  if (input.rationale) {
    await db.insert(updateRationales).values({
      releaseId: id,
      content: input.rationale,
      authorUsername: input.authorUsername ?? auth.user.username,
      updatedAt: now,
    })
  }

  return jsonResponse(201, { ok: true, id })
}

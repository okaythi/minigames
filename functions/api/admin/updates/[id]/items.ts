import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { updateItems, updateReleases } from '../../../../../src/db/schema'
import { parseCreateItemInput } from '../../../../../src/engine/updates/parser'
import { asItemId } from '../../../../../src/engine/updates/types'
import { jsonResponse } from '../../../stats/respond'
import { readJsonBody } from '../../../stats/body'
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

  const raw = await readJsonBody(request)
  const parsed = parseCreateItemInput(raw)

  if (!parsed.ok) {
    return jsonResponse(400, { ok: false, errors: parsed.errors })
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

  const item = parsed.value
  const itemId = asItemId(`item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  const now = Date.now()

  let sortOrder = item.sortOrder
  if (sortOrder === undefined) {
    const existingItems = await db
      .select({ sortOrder: updateItems.sortOrder })
      .from(updateItems)
      .where(eq(updateItems.releaseId, params.id))
    sortOrder = existingItems.length + 1
  }

  await db.insert(updateItems).values({
    id: itemId,
    releaseId: params.id,
    scopeType: item.scope.type,
    scopeTargetId: item.scope.targetId,
    scopeEntityName: item.scope.entityName,
    tag: item.tag,
    itemVersion: item.itemVersion,
    subject: item.subject,
    description: item.description,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  })

  return jsonResponse(201, { ok: true, itemId })
}

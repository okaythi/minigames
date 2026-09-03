import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { updateItems } from '../../../../../src/db/schema'
import { parseUpdateItemInput } from '../../../../../src/engine/updates/parser'
import { jsonResponse } from '../../../stats/respond'
import { readJsonBody } from '../../../stats/body'
import type { StatsEnv } from '../../../stats/store-for'
import { requireCmsEditor } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { itemId: string }
}

export const onRequestPatch = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const raw = await readJsonBody(request)
  const parsed = parseUpdateItemInput(raw)

  if (!parsed.ok) {
    return jsonResponse(400, { ok: false, errors: parsed.errors })
  }

  const patch = parsed.value
  const db = drizzle(env.NIXLABS_DB)

  const existing = await db.select().from(updateItems).where(eq(updateItems.id, params.itemId)).get()
  if (!existing) {
    return jsonResponse(404, { ok: false, error: 'Item not found' })
  }

  await db
    .update(updateItems)
    .set({
      ...(patch.scope !== undefined && {
        scopeType: patch.scope.type,
        scopeTargetId: patch.scope.targetId,
        scopeEntityName: patch.scope.entityName,
      }),
      ...(patch.tag !== undefined && { tag: patch.tag }),
      ...(patch.itemVersion !== undefined && { itemVersion: patch.itemVersion }),
      ...(patch.subject !== undefined && { subject: patch.subject }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
      updatedAt: Date.now(),
    })
    .where(eq(updateItems.id, params.itemId))

  return jsonResponse(200, { ok: true })
}

export const onRequestDelete = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  await db.delete(updateItems).where(eq(updateItems.id, params.itemId))

  return jsonResponse(200, { ok: true })
}

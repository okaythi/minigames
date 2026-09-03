import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { updateItems } from '../../../../../src/db/schema'
import { jsonResponse } from '../../../stats/respond'
import { readJsonBody } from '../../../stats/body'
import type { StatsEnv } from '../../../stats/store-for'
import { requireCmsEditor } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

interface ReorderBody {
  readonly orderedItemIds?: readonly string[]
}

export const onRequestPut = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) return auth.response

  const body = (await readJsonBody(request)) as ReorderBody
  if (!body || !Array.isArray(body.orderedItemIds)) {
    return jsonResponse(400, { ok: false, error: 'orderedItemIds array required' })
  }

  const db = drizzle(env.NIXLABS_DB)
  const now = Date.now()

  // Batch update sort orders scoped to this release
  const batchStatements = body.orderedItemIds.map((itemId, idx) =>
    db
      .update(updateItems)
      .set({ sortOrder: idx + 1, updatedAt: now })
      .where(eq(updateItems.id, itemId)),
  )

  if (params.id) {
    await Promise.all(batchStatements)
  }


  return jsonResponse(200, { ok: true })
}

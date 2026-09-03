import { eq, inArray, desc, asc } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { updateReleases, updateRationales, updateItems } from '../../../src/db/schema'
import type { ReleaseAggregate, ReleaseItem, ReleaseMeta, DeveloperRationale, TargetScopeType, UpdateTag, ReleaseStatus } from '../../../src/engine/updates/types'
import { asItemId, asReleaseId } from '../../../src/engine/updates/types'
import { defaultProjections } from '../../../src/engine/updates/projections'

export async function loadReleaseAggregates(
  db: DrizzleD1Database,
  statuses?: readonly ReleaseStatus[],
): Promise<readonly ReleaseAggregate[]> {
  const query = db
    .select()
    .from(updateReleases)
    .orderBy(desc(updateReleases.publishedAt), desc(updateReleases.createdAt))

  const rows = statuses && statuses.length > 0
    ? await query.where(inArray(updateReleases.status, statuses as string[]))
    : await query

  if (rows.length === 0) {
    return []
  }

  const releaseIds = rows.map((r) => r.id)

  const [allRationales, allItems] = await Promise.all([
    db.select().from(updateRationales).where(inArray(updateRationales.releaseId, releaseIds)),
    db
      .select()
      .from(updateItems)
      .where(inArray(updateItems.releaseId, releaseIds))
      .orderBy(asc(updateItems.sortOrder)),
  ])

  const rationaleMap = new Map<string, DeveloperRationale>()
  for (const rat of allRationales) {
    rationaleMap.set(rat.releaseId, {
      releaseId: asReleaseId(rat.releaseId),
      content: rat.content,
      authorUsername: rat.authorUsername ?? undefined,
    })
  }

  const itemsMap = new Map<string, ReleaseItem[]>()
  for (const item of allItems) {
    const list = itemsMap.get(item.releaseId) ?? []
    list.push({
      id: asItemId(item.id),
      releaseId: asReleaseId(item.releaseId),
      scope: {
        type: item.scopeType as TargetScopeType,
        targetId: item.scopeTargetId,
        entityName: item.scopeEntityName ?? undefined,
      },
      tag: item.tag as UpdateTag,
      itemVersion: item.itemVersion ?? undefined,
      subject: item.subject ?? undefined,
      description: item.description,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
    itemsMap.set(item.releaseId, list)
  }

  return rows.map((row) => {
    const meta: ReleaseMeta = {
      id: asReleaseId(row.id),
      globalVersion: row.globalVersion,
      title: row.title,
      headline: row.headline,
      status: row.status as ReleaseStatus,
      releaseDate: row.releaseDate,
      authorUsername: row.authorUsername ?? undefined,
      publishedAt: row.publishedAt ?? undefined,
    }

    const items = itemsMap.get(row.id) ?? []
    const rationale = rationaleMap.get(row.id)

    return defaultProjections.toAggregate(meta, items, rationale)
  })
}

export async function loadReleaseAggregateById(
  db: DrizzleD1Database,
  releaseId: string,
): Promise<ReleaseAggregate | null> {
  const row = await db.select().from(updateReleases).where(eq(updateReleases.id, releaseId)).get()
  if (!row) return null

  const [ratRow, itemRows] = await Promise.all([
    db.select().from(updateRationales).where(eq(updateRationales.releaseId, releaseId)).get(),
    db
      .select()
      .from(updateItems)
      .where(eq(updateItems.releaseId, releaseId))
      .orderBy(asc(updateItems.sortOrder)),
  ])

  const meta: ReleaseMeta = {
    id: asReleaseId(row.id),
    globalVersion: row.globalVersion,
    title: row.title,
    headline: row.headline,
    status: row.status as ReleaseStatus,
    releaseDate: row.releaseDate,
    authorUsername: row.authorUsername ?? undefined,
    publishedAt: row.publishedAt ?? undefined,
  }

  const rationale: DeveloperRationale | undefined = ratRow
    ? {
        releaseId: asReleaseId(ratRow.releaseId),
        content: ratRow.content,
        authorUsername: ratRow.authorUsername ?? undefined,
      }
    : undefined

  const items: ReleaseItem[] = itemRows.map((it) => ({
    id: asItemId(it.id),
    releaseId: asReleaseId(it.releaseId),
    scope: {
      type: it.scopeType as TargetScopeType,
      targetId: it.scopeTargetId,
      entityName: it.scopeEntityName ?? undefined,
    },
    tag: it.tag as UpdateTag,
    itemVersion: it.itemVersion ?? undefined,
    subject: it.subject ?? undefined,
    description: it.description,
    sortOrder: it.sortOrder,
    createdAt: it.createdAt,
    updatedAt: it.updatedAt,
  }))

  return defaultProjections.toAggregate(meta, items, rationale)
}

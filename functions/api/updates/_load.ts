import { eq, inArray, desc, asc } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { updateReleases, updateRationales, updateItems, users } from '../../../src/db/schema'
import type { ReleaseAggregate, ReleaseAuthor, ReleaseItem, ReleaseMeta, DeveloperRationale, TargetScopeType, UpdateTag, ReleaseStatus } from '../../../src/engine/updates/types'
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
  const authorUsernames = Array.from(
    new Set(
      rows
        .map((r) => r.authorUsername?.trim().toLowerCase())
        .filter((u): u is string => Boolean(u)),
    ),
  )

  const [allRationales, allItems, authorRows] = await Promise.all([
    db.select().from(updateRationales).where(inArray(updateRationales.releaseId, releaseIds)),
    db
      .select()
      .from(updateItems)
      .where(inArray(updateItems.releaseId, releaseIds))
      .orderBy(asc(updateItems.sortOrder)),
    authorUsernames.length > 0
      ? db
          .select({
            username: users.username,
            nickname: users.nickname,
            pfpR2Key: users.pfpR2Key,
            flags: users.flags,
            developer: users.developer,
            legacyUser: users.legacyUser,
          })
          .from(users)
          .where(inArray(users.username, authorUsernames))
          .all()
      : Promise.resolve([]),
  ])

  const authorMap = new Map<string, ReleaseAuthor>()
  for (const u of authorRows) {
    authorMap.set(u.username.toLowerCase(), {
      username: u.username,
      nickname: u.nickname ?? undefined,
      pfpUrl: u.pfpR2Key ? `/api/assets/pfp/${u.pfpR2Key}` : null,
      flags: u.flags,
      developer: u.developer === 1,
      legacyUser: u.legacyUser === 1,
    })
  }

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
    const author = row.authorUsername
      ? authorMap.get(row.authorUsername.trim().toLowerCase())
      : undefined

    const meta: ReleaseMeta = {
      id: asReleaseId(row.id),
      globalVersion: row.globalVersion,
      title: row.title,
      headline: row.headline,
      status: row.status as ReleaseStatus,
      releaseDate: row.releaseDate,
      authorUsername: row.authorUsername ?? undefined,
      author,
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

  const [ratRow, itemRows, authorRow] = await Promise.all([
    db.select().from(updateRationales).where(eq(updateRationales.releaseId, releaseId)).get(),
    db
      .select()
      .from(updateItems)
      .where(eq(updateItems.releaseId, releaseId))
      .orderBy(asc(updateItems.sortOrder)),
    row.authorUsername
      ? db
          .select({
            username: users.username,
            nickname: users.nickname,
            pfpR2Key: users.pfpR2Key,
            flags: users.flags,
            developer: users.developer,
            legacyUser: users.legacyUser,
          })
          .from(users)
          .where(eq(users.username, row.authorUsername.trim().toLowerCase()))
          .get()
      : Promise.resolve(null),
  ])

  const author: ReleaseAuthor | undefined = authorRow
    ? {
        username: authorRow.username,
        nickname: authorRow.nickname ?? undefined,
        pfpUrl: authorRow.pfpR2Key ? `/api/assets/pfp/${authorRow.pfpR2Key}` : null,
        flags: authorRow.flags,
        developer: authorRow.developer === 1,
        legacyUser: authorRow.legacyUser === 1,
      }
    : undefined

  const meta: ReleaseMeta = {
    id: asReleaseId(row.id),
    globalVersion: row.globalVersion,
    title: row.title,
    headline: row.headline,
    status: row.status as ReleaseStatus,
    releaseDate: row.releaseDate,
    authorUsername: row.authorUsername ?? undefined,
    author,
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

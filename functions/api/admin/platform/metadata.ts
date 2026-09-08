import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { platformMetadata, systemConfig } from '../../../../src/db/schema'
import { writeAudit } from '../_shared/audit'
import { readJsonBody } from '../../stats/body'
import { jsonResponse, badRequest } from '../../stats/respond'
import type { StatsEnv } from '../../stats/store-for'
import { requirePlatformAdmin } from './_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requirePlatformAdmin(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const [metaRows, configRows] = await Promise.all([
    db.select().from(platformMetadata).all(),
    db.select().from(systemConfig).all(),
  ])

  const metadata: Record<string, { value: string | null; updatedBy: string | null; updatedAt: number }> = {}
  for (const row of metaRows) {
    metadata[row.key] = {
      value: row.value,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    }
  }

  const systemConfigMap: Record<string, number> = {}
  for (const row of configRows) {
    systemConfigMap[row.key] = row.value
  }

  return jsonResponse(200, {
    ok: true,
    metadata,
    systemConfig: systemConfigMap,
  })
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requirePlatformAdmin(request, env)
  if (!auth.ok) return auth.response

  const json = await readJsonBody(request)
  const { key, value, reason } = (json || {}) as {
    key?: string
    value?: string
    reason?: string
  }

  if (!key || key.trim().length === 0) {
    return badRequest('Metadata key is required')
  }

  const cleanKey = key.trim()
  const cleanValue = value !== undefined && value !== null ? String(value) : ''
  const now = Date.now()

  const db = drizzle(env.NIXLABS_DB)
  const existing = await db.select().from(platformMetadata).where(eq(platformMetadata.key, cleanKey)).get()

  if (existing) {
    await db
      .update(platformMetadata)
      .set({
        value: cleanValue,
        updatedBy: auth.user.playerId,
        updatedAt: now,
      })
      .where(eq(platformMetadata.key, cleanKey))
  } else {
    await db.insert(platformMetadata).values({
      key: cleanKey,
      value: cleanValue,
      updatedBy: auth.user.playerId,
      updatedAt: now,
    })
  }

  await writeAudit(db, {
    actorPlayerId: auth.user.playerId,
    action: 'platform.metadata_update',
    targetType: 'platform',
    targetId: cleanKey,
    reason: reason?.trim() || `Updated metadata key '${cleanKey}'`,
    metadata: {
      key: cleanKey,
      before: existing?.value ?? null,
      after: cleanValue,
    },
  })

  return jsonResponse(200, {
    ok: true,
    key: cleanKey,
    value: cleanValue,
  })
}

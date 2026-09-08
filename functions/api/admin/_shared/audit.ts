import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { auditLog } from '../../../../src/db/schema'

export interface AuditEntry {
  readonly actorPlayerId: string
  readonly action: string
  readonly targetType: 'user' | 'game' | 'platform'
  readonly targetId?: string | null | undefined
  readonly reason?: string | null | undefined
  readonly metadata?: Record<string, unknown> | null | undefined
}

/**
 * Appends an immutable audit entry for administrative mutations.
 */
export async function writeAudit(
  db: DrizzleD1Database,
  entry: AuditEntry,
): Promise<void> {
  const metadataStr = entry.metadata ? JSON.stringify(entry.metadata) : null
  await db.insert(auditLog).values({
    actorPlayerId: entry.actorPlayerId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    reason: entry.reason ?? null,
    metadata: metadataStr,
    createdAt: Date.now(),
  })
}

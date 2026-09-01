/// <reference types="@cloudflare/workers-types" />

import type { PlayerRecord } from '../../../shared/stats-protocol'
import { mergePlayerRecords } from '../../../shared/player-record'
import { readPlayer, writeMergedPlayer, type PlayerRow } from './d1-players'

export async function findPlayerByFingerprint(
  db: D1Database,
  fingerprint: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT id FROM players WHERE fingerprint = ?1 ORDER BY last_seen DESC LIMIT 1')
    .bind(fingerprint)
    .first<Pick<PlayerRow, 'id'>>()
  return row?.id ?? null
}

/**
 * Merges the caller's anonymous row into the row that owns the code.
 * If the source row is already the target, it is a no-op.
 */
export async function claimSyncCode(
  db: D1Database,
  syncCode: string,
  sourcePlayerId: string | null,
  _now?: number,
): Promise<PlayerRecord | null> {
  const targetRow = await db
    .prepare('SELECT id FROM players WHERE sync_code = ?1')
    .bind(syncCode)
    .first<Pick<PlayerRow, 'id'>>()
  if (targetRow === null) {
    return null
  }
  const target = await readPlayer(db, targetRow.id)
  if (target === null) {
    return null
  }
  if (sourcePlayerId === null || sourcePlayerId === target.id) {
    return target
  }
  const source = await readPlayer(db, sourcePlayerId)
  if (source === null) {
    return target
  }
  const merged = mergePlayerRecords(target, source)
  await writeMergedPlayer(db, merged)
  return merged
}

/**
 * D1 data access layer for the achievement system.
 * Only this file knows about the database schema for achievements.
 */

import { drizzle } from 'drizzle-orm/d1'
import { eq, sql } from 'drizzle-orm'
import { playerAchievements, playerDailyActivity } from '../../../src/db/schema'
import type { AchievementId, PlayerAchievementState } from '../../../shared/achievements-protocol'

export type AchievementDb = ReturnType<typeof drizzle>

/** Fetch every achievement row for a player. Returns empty array if none exist. */
export async function loadPlayerAchievements(
  db: AchievementDb,
  playerId: string,
): Promise<readonly PlayerAchievementState[]> {
  const rows = await db
    .select()
    .from(playerAchievements)
    .where(eq(playerAchievements.playerId, playerId))
    .all()

  return rows.map((row) => ({
    id: row.id as AchievementId,
    progress: row.progress,
    unlockedAt: row.unlockedAt ?? null,
  }))
}

/**
 * Upsert a single achievement row.
 *
 * - Always bumps `progress` to `max(existing, newProgress)`.
 * - Sets `unlocked_at` only when not already set.
 */
export async function upsertAchievement(
  db: AchievementDb,
  playerId: string,
  id: AchievementId,
  progress: number,
  unlockedAt: number | null,
): Promise<void> {
  await db
    .insert(playerAchievements)
    .values({
      playerId,
      id,
      progress,
      unlockedAt,
    })
    .onConflictDoUpdate({
      target: [playerAchievements.playerId, playerAchievements.id],
      set: {
        // Always take the higher progress value
        progress: sql`MAX(${playerAchievements.progress}, excluded.progress)`,
        // Only set unlocked_at if it is still NULL (trigger also guards this)
        unlockedAt: sql`COALESCE(${playerAchievements.unlockedAt}, excluded.unlocked_at)`,
      },
    })
}

/** Record or increment today's run count for a player and return streak length. */
export async function recordDailyActivity(
  db: AchievementDb,
  playerId: string,
  utcDay: string,
): Promise<number> {
  // Upsert today's row
  await db
    .insert(playerDailyActivity)
    .values({ playerId, utcDay, runCount: 1 })
    .onConflictDoUpdate({
      target: [playerDailyActivity.playerId, playerDailyActivity.utcDay],
      set: {
        runCount: sql`${playerDailyActivity.runCount} + 1`,
      },
    })

  // Fetch recent rows ordered descending to count streak
  const rows = await db
    .select({ utcDay: playerDailyActivity.utcDay })
    .from(playerDailyActivity)
    .where(eq(playerDailyActivity.playerId, playerId))
    .orderBy(sql`${playerDailyActivity.utcDay} DESC`)
    .limit(30)
    .all()

  return computeStreak(rows.map((r) => r.utcDay), utcDay)
}

/** Fetch recent active days for the 7-day punch card. */
export async function loadRecentDays(
  db: AchievementDb,
  playerId: string,
  limit = 7,
): Promise<readonly string[]> {
  const rows = await db
    .select({ utcDay: playerDailyActivity.utcDay })
    .from(playerDailyActivity)
    .where(eq(playerDailyActivity.playerId, playerId))
    .orderBy(sql`${playerDailyActivity.utcDay} DESC`)
    .limit(limit)
    .all()

  return rows.map((r) => r.utcDay)
}

/**
 * Count how many consecutive calendar days (ending on `today`) are present in
 * the sorted-descending `days` array.
 */
function computeStreak(days: readonly string[], today: string): number {
  if (days.length === 0) return 0

  let streak = 0
  let expected = today

  for (const day of days) {
    if (day === expected) {
      streak += 1
      expected = previousDay(expected)
    } else {
      break
    }
  }

  return streak
}

function previousDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

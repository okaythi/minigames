/**
 * Achievement evaluator: given a player's current stat snapshot, computes
 * which platform-level achievements should be unlocked or have progress bumped.
 *
 * This runs server-side so the client cannot fake platform achievements.
 * Game-specific achievements (bounce counts, rally lengths, etc.) are
 * validated client-side and sent as explicit unlock events.
 */

import type { AchievementId } from '../../../shared/achievements-protocol'
import type { PlayerAchievementState } from '../../../shared/achievements-protocol'
import { hasFlag, UserFlags } from '../../../shared/flags'

export interface PlayerStatSnapshot {
  readonly totalCandy: number
  readonly totalPlays: number
  readonly streakDays: number
  readonly legacyUser: boolean
  readonly developer: boolean
  readonly flags?: number

  readonly hasPfp: boolean
  readonly hasNickname: boolean
  readonly arcadeRatingPercent: number // e.g. 3 means "Top 3%"
  readonly gamesPlayedSlugs: readonly string[]
  readonly allGameSlugs: readonly string[]
}

export interface AchievementUpdate {
  readonly id: AchievementId
  readonly progress: number
  readonly shouldUnlock: boolean
}

/** All game slugs that must be played for Grand Tour. */
const ALL_GAME_SLUGS = ['avoid-the-spikes', 'pong', 'fl-tron-3'] as const

/**
 * Derive platform achievement updates from a player's current stats.
 * Only emits entries where something changed from `existing`.
 */
export function evaluatePlatformAchievements(
  stats: PlayerStatSnapshot,
  existing: readonly PlayerAchievementState[],
): readonly AchievementUpdate[] {
  const existingMap = new Map<AchievementId, PlayerAchievementState>()
  for (const a of existing) {
    existingMap.set(a.id, a)
  }

  const updates: AchievementUpdate[] = []

  const emit = (
    id: AchievementId,
    progress: number,
    threshold: number | null,
  ): void => {
    const prev = existingMap.get(id)
    const alreadyUnlocked = prev?.unlockedAt !== null && prev?.unlockedAt !== undefined
    if (alreadyUnlocked) return

    const shouldUnlock = threshold === null ? false : progress >= threshold
    const prevProgress = prev?.progress ?? 0

    if (shouldUnlock || progress > prevProgress) {
      updates.push({ id, progress, shouldUnlock })
    }
  }

  // ── Candy Vault ──────────────────────────────────────────────────────────
  emit('candy_sweet_tooth', Math.min(stats.totalCandy, 10), 10)
  emit('candy_hoarder', Math.min(stats.totalCandy, 100), 100)
  emit('candy_sugar_maniac', Math.min(stats.totalCandy, 500), 500)
  emit('candy_confectionery_tycoon', Math.min(stats.totalCandy, 2000), 2000)

  // ── Arcade Devotion ──────────────────────────────────────────────────────
  emit('runs_first_quarter', Math.min(stats.totalPlays, 5), 5)
  emit('runs_arcade_regular', Math.min(stats.totalPlays, 50), 50)
  emit('runs_arcade_veteran', Math.min(stats.totalPlays, 200), 200)
  emit('runs_living_legend', Math.min(stats.totalPlays, 800), 800)

  // ── Daily Loops & Streaks ────────────────────────────────────────────────
  emit('streak_double_play', Math.min(stats.streakDays, 2), 2)
  emit('streak_workweek_warrior', Math.min(stats.streakDays, 5), 5)
  emit('streak_full_week_punch', Math.min(stats.streakDays, 7), 7)
  emit('streak_fortnight_fortitude', Math.min(stats.streakDays, 14), 14)

  // ── Identity & Customization ─────────────────────────────────────────────
  // identity_claimed is auto-awarded at registration — handled in auth endpoint.
  if (stats.hasPfp) {
    const prev = existingMap.get('identity_picture_perfect')
    if (!prev?.unlockedAt) {
      updates.push({ id: 'identity_picture_perfect', progress: 1, shouldUnlock: true })
    }
  }
  if (hasFlag(stats.flags, UserFlags.USER_PIONEER) || stats.legacyUser) {
    const prev = existingMap.get('identity_lab_pioneer')
    if (!prev?.unlockedAt) {
      updates.push({ id: 'identity_lab_pioneer', progress: 1, shouldUnlock: true })
    }
  }

  // ── Exploration & Shortcuts ──────────────────────────────────────────────
  const allPlayed = ALL_GAME_SLUGS.every((s) => stats.gamesPlayedSlugs.includes(s))
  if (allPlayed) {
    const prev = existingMap.get('explore_grand_tour')
    if (!prev?.unlockedAt) {
      updates.push({ id: 'explore_grand_tour', progress: 1, shouldUnlock: true })
    }
  }

  // ── Social: Top Bracket ──────────────────────────────────────────────────
  if (stats.arcadeRatingPercent <= 3) {
    const prev = existingMap.get('social_top_bracket')
    if (!prev?.unlockedAt) {
      updates.push({ id: 'social_top_bracket', progress: 1, shouldUnlock: true })
    }
  }

  return updates
}

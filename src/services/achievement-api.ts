/**
 * Client-side achievement API service.
 * Single responsibility: fetch and post to /api/achievements.
 * No UI logic — the components and hooks consume this.
 */

import type {
  AchievementId,
  PlayerAchievementState,
} from '../../shared/achievements-protocol'

/** Fetch the authenticated player's full achievement list from the server. */
export async function fetchAchievements(): Promise<readonly PlayerAchievementState[] | null> {
  const res = await fetch('/api/achievements')
  if (!res.ok) return null
  const data: unknown = await res.json()
  if (
    typeof data !== 'object' ||
    data === null ||
    !('achievements' in data) ||
    !Array.isArray((data as Record<string, unknown>)['achievements'])
  ) {
    return null
  }
  return (data as { achievements: readonly PlayerAchievementState[] }).achievements
}

export interface UnlockResult {
  readonly unlockedAt: number | null
  readonly alreadyUnlocked: boolean
}

/**
 * Notify the server that the player has earned an achievement.
 * @param id - The stable achievement identifier.
 * @param progress - Current progress value (for achievements with maxProgress).
 */
export async function unlockAchievement(
  id: AchievementId,
  progress = 0,
): Promise<UnlockResult> {
  const res = await fetch('/api/achievements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, progress }),
  })
  if (!res.ok) {
    return { unlockedAt: null, alreadyUnlocked: false }
  }
  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null) {
    return { unlockedAt: null, alreadyUnlocked: false }
  }
  const d = data as Record<string, unknown>
  return {
    unlockedAt: typeof d['unlockedAt'] === 'number' ? d['unlockedAt'] : null,
    alreadyUnlocked: d['alreadyUnlocked'] === true,
  }
}

/**
 * Bump progress for an achievement without unlocking it.
 * The server will unlock it when progress reaches the threshold.
 */
export async function reportProgress(
  id: AchievementId,
  progress: number,
): Promise<void> {
  await fetch('/api/achievements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, progress }),
  })
}

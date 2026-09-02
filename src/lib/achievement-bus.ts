/**
 * Achievement event bus.
 *
 * Game engines emit strongly-typed events here. The bus handles:
 *  1. Deduplication (never calls the API for an already-unlocked achievement)
 *  2. Queuing (fires-and-forgets; the game loop never awaits network IO)
 *  3. Notifying subscribers (toast system picks these up)
 *
 * The bus is a singleton per browser session, instantiated once in main.tsx
 * and accessed via `getAchievementBus()`.
 */

import { ACHIEVEMENT_DEFS } from '../../shared/achievement-defs'
import { unlockAchievement, reportProgress } from '../services/achievement-api'
import type { AchievementId, PlayerAchievementState } from '../../shared/achievements-protocol'

export interface AchievementUnlockNotification {
  readonly id: AchievementId
  readonly name: string
  readonly icon: string
  readonly description: string
}

type UnlockListener = (notification: AchievementUnlockNotification) => void

export class AchievementBus {
  /** Local mirror of what is already unlocked (avoids redundant API calls). */
  private readonly unlocked = new Set<AchievementId>()
  /** In-flight request guard (prevent racing double-submits for same id). */
  private readonly inFlight = new Set<AchievementId>()
  private readonly listeners: UnlockListener[] = []

  /** Seed the unlocked set from the server state on page load. */
  seed(states: readonly PlayerAchievementState[]): void {
    for (const s of states) {
      if (s.unlockedAt !== null) {
        this.unlocked.add(s.id)
      }
    }
  }

  /**
   * Signal that an achievement has been earned.
   * Safe to call from a synchronous game loop — network IO is fire-and-forget.
   */
  unlock(id: AchievementId, progress = 0): void {
    if (this.unlocked.has(id) || this.inFlight.has(id)) return
    this.inFlight.add(id)

    unlockAchievement(id, progress).then((result) => {
      this.inFlight.delete(id)
      if (result.alreadyUnlocked) {
        this.unlocked.add(id)
        return
      }
      if (result.unlockedAt !== null) {
        this.unlocked.add(id)
        this.notify(id)
      }
    }).catch(() => {
      this.inFlight.delete(id)
    })
  }

  /**
   * Signal progress without unlocking. Server will unlock when threshold is hit.
   * Fire-and-forget, safe to call from the game loop.
   */
  progress(id: AchievementId, value: number): void {
    if (this.unlocked.has(id) || this.inFlight.has(id)) return
    // Non-blocking
    reportProgress(id, value).catch(() => {/* ignore */})
  }

  /** Subscribe to unlock notifications (for the toast component). */
  onUnlock(listener: UnlockListener): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  isUnlocked(id: AchievementId): boolean {
    return this.unlocked.has(id)
  }

  private notify(id: AchievementId): void {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === id)
    if (!def) return
    const notification: AchievementUnlockNotification = {
      id,
      name: def.name,
      icon: def.icon,
      description: def.description,
    }
    for (const listener of this.listeners) {
      listener(notification)
    }
  }
}

let bus: AchievementBus | null = null

export function getAchievementBus(): AchievementBus {
  if (!bus) bus = new AchievementBus()
  return bus
}

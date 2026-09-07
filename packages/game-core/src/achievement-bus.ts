/**
 * Lightweight Achievement Bus contract and accessor for games.
 * 
 * Standalone games emit events through getAchievementBus(). When mounted in
 * the Nixlabs Arcade platform, the platform injects its active D1/toast bus.
 * In standalone dev or headless tests, it falls back to a clean no-op bus.
 */

export interface AchievementUnlockNotification {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly description: string
}

export interface AchievementBus {
  unlock(id: string, progress?: number): void
  progress(id: string, value: number): void
  isUnlocked(id: string): boolean
  onUnlock?(listener: (notification: AchievementUnlockNotification) => void): () => void
}

let activeBus: AchievementBus | null = null

export function setAchievementBus(bus: AchievementBus): void {
  activeBus = bus
}

export function getAchievementBus(): AchievementBus {
  if (!activeBus) {
    return {
      unlock: () => {},
      progress: () => {},
      isUnlocked: () => false,
    }
  }
  return activeBus
}

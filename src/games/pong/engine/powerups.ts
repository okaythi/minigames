import type { PongState, ActivePowerup } from './types'
import { POWERUP_DURATIONS } from './config'

export function activatePowerupState(state: PongState, slotIndex: number, isPlayer: boolean): boolean {
  const slots = isPlayer ? state.slots : state.aiSlots
  const type = slots[slotIndex]
  if (!type) return false

  slots[slotIndex] = null

  const target = isPlayer ? state.player : state.ai

  state.notifications.push({
    text: `${isPlayer ? 'Player' : 'AI'} used ${type.toUpperCase()}`,
    time: 2,
    y: isPlayer ? target.y - 30 : target.y + 30,
  })

  if (type === 'speed') {
    const duration = POWERUP_DURATIONS.speed[state.difficulty]
    target.activePowerups.push({ type: 'speed', timeRemaining: duration, duration })
  } else if (type === 'extension') {
    const duration = POWERUP_DURATIONS.extension[state.difficulty]
    target.activePowerups.push({ type: 'extension', timeRemaining: duration, duration })
  } else if (type === 'magnet') {
    if (isPlayer) state.playerMagnetActive = true
  } else if (type === 'glass-wall') {
    if (isPlayer) {
      state.playerGlassWallActive = true
      state.playerGlassWallTimeRemaining = POWERUP_DURATIONS['glass-wall'][state.difficulty]
    }
  } else if (type === 'fast-ball') {
    state.ball.speed *= 1.5
  }
  return true
}

export function updatePowerups(state: PongState, dt: number): void {
  const tick = (pList: ActivePowerup[]) => {
    for (let i = pList.length - 1; i >= 0; i--) {
      const p = pList[i]
      if (p) {
        p.timeRemaining -= dt
        if (p.timeRemaining <= 0) pList.splice(i, 1)
      }
    }
  }
  tick(state.player.activePowerups)
  tick(state.ai.activePowerups)

  if (state.playerGlassWallActive) {
    state.playerGlassWallTimeRemaining -= dt
    if (state.playerGlassWallTimeRemaining <= 0) {
      state.playerGlassWallTimeRemaining = 0
      state.playerGlassWallActive = false
      state.notifications.push({ text: 'GLASS WALL GONE', time: 1.5, y: state.player.y - 30 })
    }
  }
}

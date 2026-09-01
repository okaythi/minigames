import type { PongState } from './engine'
import { POWERUP_DURATIONS } from './config'

export function activatePowerupState(state: PongState, slotIndex: number, isPlayer: boolean): void {
  const slots = isPlayer ? state.slots : state.aiSlots
  const type = slots[slotIndex]
  if (!type) return

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
}

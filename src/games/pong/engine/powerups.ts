import type { PongState } from './engine'

export function activatePowerupState(state: PongState, slotIndex: number, isPlayer: boolean) {
  const slots = isPlayer ? state.slots : state.aiSlots
  const type = slots[slotIndex]
  if (!type) return

  slots[slotIndex] = null as any

  const target = isPlayer ? state.player : state.ai

  state.notifications.push({
    text: `${isPlayer ? 'Player' : 'AI'} used ${type.toUpperCase()}`,
    time: 2,
    y: isPlayer ? target.y - 30 : target.y + 30
  })

  if (type === 'speed') {
    target.activePowerups.push({ type: 'speed', timeRemaining: 5 })
  } else if (type === 'extension') {
    target.activePowerups.push({ type: 'extension', timeRemaining: 5 })
  } else if (type === 'magnet') {
    if (isPlayer) state.playerMagnetActive = true
  } else if (type === 'glass-wall') {
    if (isPlayer) state.playerGlassWallActive = true
  } else if (type === 'fast-ball') {
    state.ball.speed *= 1.5
  }
}

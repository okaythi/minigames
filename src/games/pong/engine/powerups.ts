import type { PongEngine } from './engine'

export function activatePowerup(engine: PongEngine, slotIndex: number, isPlayer: boolean) {
  const slots = isPlayer ? engine.state.slots : engine.state.aiSlots
  const type = slots[slotIndex]
  if (!type) return

  // Remove from slots
  slots[slotIndex] = null as any // consumed

  const target = isPlayer ? engine.state.player : engine.state.ai
  
  // Create animation/fx notification
  engine.state.notifications.push({
    text: `${isPlayer ? 'Player' : 'AI'} used ${type.toUpperCase()}`,
    time: 2,
    y: isPlayer ? target.y - 20 : target.y + 20
  })

  if (type === 'speed') {
    target.activePowerups.push({ type: 'speed', timeRemaining: 5 })
  } else if (type === 'extension') {
    target.activePowerups.push({ type: 'extension', timeRemaining: 5 })
  } else if (type === 'magnet') {
    if (isPlayer) engine.state.playerMagnetActive = true
  } else if (type === 'glass-wall') {
    if (isPlayer) engine.state.playerGlassWallActive = true
  } else if (type === 'fast-ball') {
    engine.state.ball.speed *= 1.5
  }
}

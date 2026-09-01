import { ARENA, AI_SPEED_FACTORS, extensionScale } from './config'
import type { PongState } from './types'

export function stepPhysics(
  state: PongState,
  pointerX: number,
  dt: number,
  onWallBounce: () => void,
): void {
  const s = state

  const currentW = s.player.w * extensionScale(s.player.activePowerups)
  const currentMaxV = s.player.maxV * (s.player.activePowerups.some((p) => p.type === 'speed') ? 2 : 1)

  const dx = pointerX - s.player.x
  const dist = Math.abs(dx)
  if (dist > 0) {
    const move = Math.sign(dx) * Math.min(dist, currentMaxV * dt)
    s.player.x += move
  }
  s.player.x = Math.max(currentW / 2, Math.min(ARENA.width - currentW / 2, s.player.x))

  const aiW = s.ai.w * extensionScale(s.ai.activePowerups)
  const aiBaseMaxV = s.player.maxV * AI_SPEED_FACTORS[s.difficulty]
  s.ai.maxV = aiBaseMaxV
  const aiMaxV = aiBaseMaxV * (s.ai.activePowerups.some((p) => p.type === 'speed') ? 2 : 1)
  if (s.ai.targetX !== undefined) {
    const adx = s.ai.targetX - s.ai.x
    const adist = Math.abs(adx)
    if (adist > 0) {
      s.ai.x += Math.sign(adx) * Math.min(adist, aiMaxV * dt)
    }
  }
  s.ai.x = Math.max(aiW / 2, Math.min(ARENA.width - aiW / 2, s.ai.x))

  if (s.ball.stuckToPlayer) {
    s.ball.stuckTime += dt
    s.ball.x = s.player.x
    s.ball.y = s.player.y - s.player.h / 2 - s.ball.radius
  } else {
    s.ball.x += s.ball.vx * dt
    s.ball.y += s.ball.vy * dt
  }

  if (s.ball.x - s.ball.radius <= 0) {
    s.ball.x = s.ball.radius
    s.ball.vx *= -1
    onWallBounce()
  } else if (s.ball.x + s.ball.radius >= ARENA.width) {
    s.ball.x = ARENA.width - s.ball.radius
    s.ball.vx *= -1
    onWallBounce()
  }

  for (let i = s.notifications.length - 1; i >= 0; i--) {
    const n = s.notifications[i]
    if (n) {
      n.time -= dt
      if (n.time <= 0) s.notifications.splice(i, 1)
    }
  }
}

import { ARENA, extensionScale } from './config'
import type { PongState } from './types'

export function updateAI(state: PongState, dt: number, activatePowerupCb: (idx: number) => void): void {
  const s = state
  if (s.aiReactionTimer > 0) {
    s.aiReactionTimer = Math.max(0, s.aiReactionTimer - dt)
  }

  if (s.ball.vy > 0) {
    s.ai.targetX = ARENA.width / 2
    return
  }

  const aiW = s.ai.w * extensionScale(s.ai.activePowerups)
  const R = aiW / 2

  if (s.difficulty === 'easy') {
    s.ai.targetX = s.ball.x
    return
  }

  if (s.difficulty === 'normal' && s.aiReactionTimer > 0) {
    s.ai.targetX = s.ball.x
    return
  }

  const t = (s.ai.y + s.ai.h / 2 - (s.ball.y - s.ball.radius)) / s.ball.vy
  if (t < 0) return

  if (s.difficulty === 'normal') {
    // 1 & 2: Wall-bounce blindness (linear trajectory) + persistent random error offset
    const x_linear = s.ball.x + s.ball.vx * t
    const x_clamped = Math.max(s.ball.radius, Math.min(ARENA.width - s.ball.radius, x_linear))
    s.ai.targetX = x_clamped + s.aiErrorOffset
  } else {
    // Hard & very-hard: Full multi-bounce prediction with intentional edge aiming
    const x_u = s.ball.x + s.ball.vx * t
    const W = ARENA.width - s.ball.radius * 2
    const xu_shifted = x_u - s.ball.radius
    const mod = ((xu_shifted % (2 * W)) + 2 * W) % (2 * W)
    let x_target_shifted = mod
    if (mod > W) {
      x_target_shifted = 2 * W - mod
    }
    const x_target = x_target_shifted + s.ball.radius

    const delta = 2
    const epsilon = s.player.x > ARENA.width / 2 ? R - delta : -(R - delta)
    s.ai.targetX = x_target + epsilon
  }

  const t_a = t
  const D = Math.abs(s.ai.targetX - s.ai.x)
  const aiMaxV = s.ai.maxV * (s.ai.activePowerups.some((p) => p.type === 'speed') ? 2 : 1)
  if (D > aiMaxV * t_a) {
    const speedIdx = s.aiSlots.findIndex((x) => x === 'speed')
    const extIdx = s.aiSlots.findIndex((x) => x === 'extension')
    if (speedIdx !== -1) {
      activatePowerupCb(speedIdx)
    } else if (extIdx !== -1) {
      const dX = D - aiMaxV * t_a
      if (dX <= R * 1.5 - R) {
        activatePowerupCb(extIdx)
      }
    }
  }
}

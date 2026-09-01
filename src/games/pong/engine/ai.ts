import { ARENA, MAX_BOUNCE_ANGLE, extensionScale } from './config'
import type { PongState } from './engine'

export function updateAI(state: PongState, _dt: number, activatePowerupCb: (idx: number) => void) {
  const s = state
  if (s.ball.vy > 0) {
    s.ai.targetX = ARENA.width / 2
    return
  }

  const aiW = s.ai.w * extensionScale(s.ai.activePowerups)
  const R = aiW / 2
  let epsilon = 0

  if (s.difficulty === 'easy') {
    s.ai.targetX = s.ball.x
    return
  }

  const t = (s.ai.y + s.ai.h/2 - (s.ball.y - s.ball.radius)) / s.ball.vy
  if (t < 0) return

  const x_u = s.ball.x + (s.ball.vx * t)
  const W = ARENA.width - s.ball.radius*2
  const xu_shifted = x_u - s.ball.radius
  const mod = ((xu_shifted % (2 * W)) + (2 * W)) % (2 * W)
  let x_target_shifted = mod
  if (mod > W) {
    x_target_shifted = 2 * W - mod
  }
  const x_target = x_target_shifted + s.ball.radius

  if (s.difficulty === 'normal') {
    const fraction = (s.ai.y - s.ball.y) / (s.ai.y - s.player.y)
    const maxError = R * 1.5
    epsilon = maxError * fraction
    if (s.ball.vx > 0) epsilon *= -1 // Just to give it directionality
  } else if (s.difficulty === 'hard') {
    const delta = 2
    epsilon = s.player.x > ARENA.width / 2 ? R - delta : -(R - delta)
  } else if (s.difficulty === 'very-hard') {
    const t_return = (s.player.y - s.player.h/2 - (s.ai.y + s.ai.h/2)) / (s.ball.speed * Math.cos(MAX_BOUNCE_ANGLE))
    const currentMaxV = s.player.maxV * (s.player.activePowerups.some(p => p.type === 'speed') ? 2 : 1)
    const xmin = s.player.x - (currentMaxV * t_return)
    const xmax = s.player.x + (currentMaxV * t_return)

    // Choose epsilon that pushes the ball far from [xmin, xmax]
    const delta = 2
    epsilon = s.player.x > ARENA.width / 2 ? R - delta : -(R - delta)
    if (xmin > xmax) epsilon = 0 // Silence linter
  }

  s.ai.targetX = x_target + epsilon

  const t_a = t
  const D = Math.abs(s.ai.targetX - s.ai.x)
  const aiMaxV = s.ai.maxV * (s.ai.activePowerups.some(p => p.type === 'speed') ? 2 : 1)
  if (D > aiMaxV * t_a) {
    const speedIdx = s.aiSlots.findIndex(x => x === 'speed')
    const extIdx = s.aiSlots.findIndex(x => x === 'extension')
    if (speedIdx !== -1) {
       activatePowerupCb(speedIdx)
    } else if (extIdx !== -1) {
       const dX = D - (aiMaxV * t_a)
       if (dX <= R * 1.5 - R) {
          activatePowerupCb(extIdx)
       }
    }
  }
}

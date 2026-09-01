import { ARENA, JUICE } from '../engine/config'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { clamp01 } from '../../../lib/math'
import { PickupField } from '../engine/pickups'
import { particleAlpha } from '../engine/particles'
import { roundRectPath } from './draw-utils'
import type { AvoidSession } from '../engine/session'
import type { Particle, Pickup } from '../engine/types'

/** Pickups, particles and the arena-wide flashes. */

export function drawPickups(
  context: CanvasRenderingContext2D,
  session: AvoidSession,
  time: number,
): void {
  for (const pickup of session.pickups.list()) {
    const visibility = PickupField.visibility(pickup)
    if (visibility <= 0.01) {
      continue
    }
    context.save()
    // pos already carries the bob - see PickupField.update.
    context.translate(pickup.pos.x, pickup.pos.y)
    context.globalAlpha = visibility
    const spin = Math.sin(time * 2.1 + pickup.phase) * 0.35
    context.rotate(spin)
    drawCandy(context, pickup)
    context.restore()
  }
}

function drawCandy(context: CanvasRenderingContext2D, pickup: Pickup): void {
  const isGem = pickup.kind === 'gem'
  // Glow ring first, so the collectible reads against the grid.
  context.beginPath()
  context.arc(0, 0, 14, 0, Math.PI * 2)
  context.fillStyle = withAlpha(isGem ? PALETTE.green : PALETTE.orangeBright, 0.16)
  context.fill()

  if (isGem) {
    context.beginPath()
    context.moveTo(0, -9)
    context.lineTo(8, 0)
    context.lineTo(0, 9)
    context.lineTo(-8, 0)
    context.closePath()
    context.fillStyle = PALETTE.green
    context.fill()
    context.lineWidth = 1.5
    context.strokeStyle = PALETTE.greenDeep
    context.stroke()
    context.beginPath()
    context.moveTo(-3.6, -3.4)
    context.lineTo(3.6, -3.4)
    context.strokeStyle = withAlpha(PALETTE.paper, 0.8)
    context.lineWidth = 1.2
    context.stroke()
    return
  }

  roundRectPath(context, -7, -5.4, 14, 10.8, 4)
  context.fillStyle = PALETTE.orangeBright
  context.fill()
  context.lineWidth = 1.5
  context.strokeStyle = PALETTE.orangeDeep
  context.stroke()
  // Wrapper twists.
  context.beginPath()
  context.moveTo(-7, -4)
  context.lineTo(-12, -7)
  context.lineTo(-11, 0)
  context.lineTo(-12, 7)
  context.lineTo(-7, 4)
  context.moveTo(7, -4)
  context.lineTo(12, -7)
  context.lineTo(11, 0)
  context.lineTo(12, 7)
  context.lineTo(7, 4)
  context.closePath()
  context.fillStyle = PALETTE.orange
  context.fill()
  context.stroke()
}

export function drawParticles(
  context: CanvasRenderingContext2D,
  session: AvoidSession,
): void {
  const items: readonly Particle[] = session.feedback.particles.list()
  for (const particle of items) {
    const alpha = particleAlpha(particle)
    if (alpha <= 0.01) {
      continue
    }
    context.save()
    context.translate(particle.pos.x, particle.pos.y)
    context.globalAlpha = alpha
    if (particle.shape === 'ring') {
      context.beginPath()
      context.arc(0, 0, particle.size * (2.6 - alpha * 1.4), 0, Math.PI * 2)
      context.strokeStyle = particle.color
      context.lineWidth = 1.5
      context.stroke()
    } else if (particle.shape === 'shard') {
      context.rotate(particle.rotation)
      context.beginPath()
      context.moveTo(particle.size, 0)
      context.lineTo(-particle.size * 0.7, particle.size * 0.62)
      context.lineTo(-particle.size * 0.7, -particle.size * 0.62)
      context.closePath()
      context.fillStyle = particle.color
      context.fill()
    } else {
      const speed = Math.hypot(particle.vel.x, particle.vel.y)
      const stretch = clamp01(speed / 420)
      context.rotate(Math.atan2(particle.vel.y, particle.vel.x))
      context.beginPath()
      context.ellipse(0, 0, particle.size * (0.8 + stretch * 1.8), particle.size * 0.55, 0, 0, Math.PI * 2)
      context.fillStyle = particle.color
      context.fill()
    }
    context.restore()
  }
}

/** Arena-wide flashes: death tint and the "new personal best" bloom. */
export function drawArenaFlash(context: CanvasRenderingContext2D, session: AvoidSession): void {
  if (session.feedback.deathFlash > 0.001) {
    const energy = clamp01(session.feedback.deathFlash / JUICE.flashOnDeath)
    context.fillStyle = withAlpha(PALETTE.red, energy * 0.22)
    context.fillRect(0, 0, ARENA.width, ARENA.height)
  }
}

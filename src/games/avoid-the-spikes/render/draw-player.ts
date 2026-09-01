import { PLAYER } from '../engine/config'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { clamp01 } from '../../../lib/math'
import { facingAngle } from '../engine/player'
import type { AvoidSession } from '../engine/session'
import type { PlayerState } from '../engine/types'

/**
 * The pod: a teardrop that points where it is actually going, squashes on
 * contact, and drags a short trail so speed stays readable at 3x.
 */

export function drawPlayer(context: CanvasRenderingContext2D, session: AvoidSession): void {
  const player = session.player
  drawTrail(context, player, session)

  context.save()
  context.translate(player.pos.x, player.pos.y)
  context.rotate(facingAngle(player))
  const squash = clamp01(player.squash)
  context.scale(1 - squash * 0.26, 1 + squash * 0.2)
  if (!player.alive) {
    context.globalAlpha = 0.32
  }

  const body = new Path2D()
  body.moveTo(15, 0)
  body.bezierCurveTo(9, -10.5, -8, -12.5, -12, -6)
  body.bezierCurveTo(-15, -1.5, -15, 1.5, -12, 6)
  body.bezierCurveTo(-8, 12.5, 9, 10.5, 15, 0)
  body.closePath()

  const gradient = context.createLinearGradient(-12, -12, 12, 12)
  gradient.addColorStop(0, PALETTE.orangeBright)
  gradient.addColorStop(0.55, PALETTE.orange)
  gradient.addColorStop(1, PALETTE.orangeDeep)
  context.fillStyle = gradient
  context.shadowColor = withAlpha(PALETTE.orange, 0.45)
  context.shadowBlur = 12
  context.shadowOffsetY = 2
  context.fill(body)
  context.shadowColor = 'transparent'
  context.shadowBlur = 0
  context.shadowOffsetY = 0

  context.lineWidth = 1.6
  context.strokeStyle = PALETTE.ink
  context.stroke(body)

  // Dorsal fin - the one detail that makes rotation legible.
  context.beginPath()
  context.moveTo(-2, -9)
  context.lineTo(2, -15.5)
  context.lineTo(6, -8)
  context.closePath()
  context.fillStyle = PALETTE.orangeDeep
  context.fill()
  context.stroke()

  // Eye looks where the pod is going.
  context.beginPath()
  context.arc(6.5, -2.4, 4.4, 0, Math.PI * 2)
  context.fillStyle = PALETTE.card
  context.fill()
  context.lineWidth = 1.2
  context.stroke()
  context.beginPath()
  context.arc(7.8, -2.2, 1.9, 0, Math.PI * 2)
  context.fillStyle = PALETTE.ink
  context.fill()

  context.restore()
}

function drawTrail(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  session: AvoidSession,
): void {
  const alive = session.status === 'running'
  player.trail.forEach((point, index) => {
    const t = 1 - index / Math.max(1, player.trail.length)
    const alpha = (alive ? 0.28 : 0.12) * t * (1 - clamp01(point.age / 0.34))
    if (alpha <= 0.01) {
      return
    }
    context.beginPath()
    context.arc(point.x, point.y, PLAYER.halfWidth * (0.24 + t * 0.5), 0, Math.PI * 2)
    context.fillStyle = withAlpha(PALETTE.orange, alpha)
    context.fill()
  })
}

/** The "waiting for the first flap" pulse, drawn in the arena not the DOM. */
export function drawReadyCue(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  time: number,
): void {
  const pulse = 0.5 + Math.sin(time * 3.4) * 0.5
  context.save()
  context.translate(player.pos.x, player.pos.y)
  context.beginPath()
  context.arc(0, 0, 18 + pulse * 7, 0, Math.PI * 2)
  context.strokeStyle = withAlpha(PALETTE.orange, 0.5 - pulse * 0.3)
  context.lineWidth = 2
  context.stroke()
  context.beginPath()
  context.moveTo(12, -22)
  context.lineTo(30, -22)
  context.strokeStyle = withAlpha(PALETTE.graphite, 0.5)
  context.lineWidth = 2
  context.stroke()
  context.beginPath()
  context.moveTo(25, -27)
  context.lineTo(31, -22)
  context.lineTo(25, -17)
  context.stroke()
  context.restore()
}

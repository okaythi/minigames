import { ARENA, HAZARDS } from '../engine/config'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { easeOutCubic } from '../../../lib/easing'
import { spikeTriangle } from '../engine/geometry'
import { moverTriangle } from '../engine/movers'
import { pathTriangle } from './draw-utils'
import type { AvoidSession } from '../engine/session'
import type { Spike, WallSide } from '../engine/types'

/**
 * Three colours, three meanings - the whole point of the visual language:
 *
 *  graphite = permanent (ceiling + floor teeth, always lethal)
 *  orange   = the wall you are aiming at, freshly sprouted
 *  red      = free-floating movers
 */

export function drawSpikes(context: CanvasRenderingContext2D, session: AvoidSession): void {
  context.save()

  for (const spike of session.boundary.list()) {
    pathTriangle(context, spikeTriangle(spike, 1), 0.02)
    context.fillStyle = PALETTE.graphite
    context.fill()
  }

  // A base line makes the permanent rows read as one solid band, not teeth.
  context.fillStyle = PALETTE.ink
  context.fillRect(0, 0, ARENA.width, 4)
  context.fillRect(0, ARENA.height - 4, ARENA.width, 4)

  drawWallRow(context, session, 'left')
  drawWallRow(context, session, 'right')

  for (const mover of session.movers.list()) {
    const grow = easeOutCubic(Math.min(1, mover.age / 0.28))
    if (grow <= 0.01) {
      continue
    }
    const triangle = moverTriangle(mover)
    context.save()
    context.shadowColor = withAlpha(PALETTE.red, 0.35)
    context.shadowBlur = 8
    pathTriangle(context, triangle, 0.04)
    context.fillStyle = PALETTE.red
    context.fill()
    context.restore()
    context.lineWidth = 1.4
    context.strokeStyle = withAlpha(PALETTE.redDeep, 0.9)
    pathTriangle(context, triangle, 0.04)
    context.stroke()
    // Inner facet so the mover reads as a solid object while spinning.
    pathTriangle(context, triangle, 0.34)
    context.fillStyle = withAlpha(PALETTE.paper, 0.22)
    context.fill()
  }

  context.restore()
}

function drawWallRow(
  context: CanvasRenderingContext2D,
  session: AvoidSession,
  side: WallSide,
): void {
  const spikes: readonly Spike[] = session.walls.spikes(side)
  for (const spike of spikes) {
    const { growth } = session.walls.growthOf(spike)
    if (growth <= 0.001) {
      continue
    }
    const clamped = Math.min(growth, 1)
    const triangle = spikeTriangle(spike, clamped)
    context.save()
    if (growth > 1.001) {
      context.shadowColor = withAlpha(PALETTE.orangeGlow, (growth - 1) * 5)
      context.shadowBlur = 14
    }
    pathTriangle(context, triangle, 0.05)
    const gradient = context.createLinearGradient(
      side === 'left' ? 0 : ARENA.width,
      spike.along - spike.base / 2,
      side === 'left' ? spike.depth : ARENA.width - spike.depth,
      spike.along + spike.base / 2,
    )
    gradient.addColorStop(0, PALETTE.orange)
    gradient.addColorStop(1, withAlpha(PALETTE.orangeBright, 0.92))
    context.fillStyle = gradient
    context.fill()
    context.restore()

    context.lineWidth = 1.2
    context.strokeStyle = withAlpha(PALETTE.orangeDeep, 0.85)
    pathTriangle(context, triangle, 0.05)
    context.stroke()
  }

  // Sprouting rows get a hairline down the wall so you can read the gaps even
  // while the teeth are still popping out.
  if (spikes.length > 0 && spikes[0] !== undefined && spikes[0].age < HAZARDS.sproutDuration * 3) {
    context.strokeStyle = withAlpha(PALETTE.orange, 0.35)
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(side === 'left' ? 2 : ARENA.width - 2, ARENA.ceilingDepth)
    context.lineTo(side === 'left' ? 2 : ARENA.width - 2, ARENA.height - ARENA.floorDepth)
    context.stroke()
  }
}

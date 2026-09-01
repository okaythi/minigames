import { ARENA, JUICE } from '../engine/config'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath } from './draw-utils'
import type { AvoidSession } from '../engine/session'
import type { WallSide } from '../engine/types'

/**
 * The box itself: paper, hairline grid, and the two walls that flash whenever
 * the pod slaps into them.
 */

const GRID = 40

export function drawArena(context: CanvasRenderingContext2D, session: AvoidSession): void {
  context.save()
  roundRectPath(context, 0, 0, ARENA.width, ARENA.height, 12)
  context.fillStyle = PALETTE.card
  context.fill()
  context.clip()

  // Faint lab-notebook grid.
  context.lineWidth = 1
  context.strokeStyle = withAlpha(PALETTE.graphite, 0.055)
  context.beginPath()
  for (let x = GRID; x < ARENA.width; x += GRID) {
    context.moveTo(x, 0)
    context.lineTo(x, ARENA.height)
  }
  for (let y = GRID; y < ARENA.height; y += GRID) {
    context.moveTo(0, y)
    context.lineTo(ARENA.width, y)
  }
  context.stroke()

  // Centre band hint: where the candy and the movers live.
  context.fillStyle = withAlpha(PALETTE.orange, 0.028)
  context.fillRect(
    ARENA.width * 0.28,
    ARENA.ceilingDepth,
    ARENA.width * 0.44,
    ARENA.height - ARENA.ceilingDepth - ARENA.floorDepth,
  )

  drawWallFlash(context, session, 'left')
  drawWallFlash(context, session, 'right')

  context.restore()

  context.lineWidth = 2
  context.strokeStyle = PALETTE.graphite
  roundRectPath(context, 0, 0, ARENA.width, ARENA.height, 12)
  context.stroke()
}

function drawWallFlash(
  context: CanvasRenderingContext2D,
  session: AvoidSession,
  side: WallSide,
): void {
  const energy = session.feedback.flash[side] / JUICE.wallFlash
  if (energy <= 0.001) {
    return
  }
  const gradient = context.createLinearGradient(side === 'left' ? 0 : ARENA.width, 0, side === 'left' ? 46 : ARENA.width - 46, 0)
  gradient.addColorStop(0, withAlpha(PALETTE.orange, 0.42 * energy))
  gradient.addColorStop(1, withAlpha(PALETTE.orange, 0))
  context.fillStyle = gradient
  context.fillRect(
    side === 'left' ? 0 : ARENA.width - 46,
    0,
    46,
    ARENA.height,
  )
  context.strokeStyle = withAlpha(PALETTE.orange, Math.min(1, energy))
  context.lineWidth = 3 + energy * 3
  context.beginPath()
  context.moveTo(side === 'left' ? 1 : ARENA.width - 1, ARENA.ceilingDepth)
  context.lineTo(side === 'left' ? 1 : ARENA.width - 1, ARENA.height - ARENA.floorDepth)
  context.stroke()
}

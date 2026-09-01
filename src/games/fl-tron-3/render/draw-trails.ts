import { PALETTE } from '../../../theme/palette'
import type { CycleState, Point } from '../engine/types'

export function drawCycleTrails(
  ctx: CanvasRenderingContext2D,
  p1: CycleState,
  ai: CycleState,
  _time: number,
): void {
  drawSingleTrail(ctx, p1.trail, PALETTE.blue, '#94c2ff', p1.isTurbo)
  drawSingleTrail(ctx, ai.trail, PALETTE.orange, '#ffd79c', ai.isTurbo)
}

function drawSingleTrail(
  ctx: CanvasRenderingContext2D,
  trail: readonly Point[],
  baseColor: string,
  turboColor: string,
  isTurbo: boolean,
): void {
  if (trail.length < 2) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Primary Solid Light Wall
  ctx.lineWidth = 7 // Matches RULES.trailWidth
  ctx.strokeStyle = isTurbo ? turboColor : baseColor
  renderPolyline(ctx, trail)
  ctx.stroke()

  ctx.restore()
}

function renderPolyline(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath()
  const first = points[0]
  if (!first) return
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < points.length; i += 1) {
    const pt = points[i]
    if (pt) {
      ctx.lineTo(pt.x, pt.y)
    }
  }
}

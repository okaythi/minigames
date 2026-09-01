import { PALETTE } from '../../../theme/palette'
import type { CycleState, Point, TrailSegment } from '../engine/types'

export function drawCycleTrails(
  ctx: CanvasRenderingContext2D,
  p1: CycleState,
  ai: CycleState,
  _time: number,
): void {
  drawSingleTrail(ctx, p1.trail, PALETTE.blue, '#94c2ff')
  drawSingleTrail(ctx, ai.trail, PALETTE.orange, '#ffd79c')
}

function drawSingleTrail(
  ctx: CanvasRenderingContext2D,
  trail: readonly TrailSegment[],
  baseColor: string,
  turboColor: string,
): void {
  if (trail.length === 0) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Primary Solid Light Wall
  ctx.lineWidth = 7 // Matches RULES.trailWidth

  for (const seg of trail) {
    if (seg.points.length < 2) continue
    ctx.strokeStyle = seg.isTurbo ? turboColor : baseColor
    renderPolyline(ctx, seg.points)
    ctx.stroke()
  }

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

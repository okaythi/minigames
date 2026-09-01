import type { Triangle } from '../engine/types'

/** Canvas primitives shared by the layers. */

export function pathTriangle(context: CanvasRenderingContext2D, triangle: Triangle, inset = 0): void {
  const { a, b, c } = triangle
  if (inset > 0) {
    // Pull each vertex toward the centroid so adjacent teeth get a hairline gap.
    const cx = (a.x + b.x + c.x) / 3
    const cy = (a.y + b.y + c.y) / 3
    const pull = (point: { x: number; y: number }) => ({
      x: point.x + (cx - point.x) * inset,
      y: point.y + (cy - point.y) * inset,
    })
    const pa = pull(a)
    const pb = pull(b)
    const pc = pull(c)
    context.beginPath()
    context.moveTo(pa.x, pa.y)
    context.lineTo(pb.x, pb.y)
    context.lineTo(pc.x, pc.y)
    context.closePath()
    return
  }
  context.beginPath()
  context.moveTo(a.x, a.y)
  context.lineTo(b.x, b.y)
  context.lineTo(c.x, c.y)
  context.closePath()
}

export function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

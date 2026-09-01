import type { Triangle } from '../engine/types'
export { roundRectPath } from '../../../lib/canvas'

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

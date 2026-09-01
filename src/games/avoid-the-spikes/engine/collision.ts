import type { Rect, Triangle, Vec2 } from './types'

/**
 * Separating axis test for an axis-aligned rect against a triangle.
 *
 * Deliberately exact rather than "bounding box close enough": a player that
 * grazes the tip of a spike must survive it, or the game reads as cheating.
 */

type Axis = Readonly<Vec2>

interface Projection {
  readonly min: number
  readonly max: number
}

const projectPoint = (axis: Axis, point: Vec2): number => axis.x * point.x + axis.y * point.y

const projectPoints = (axis: Axis, points: readonly Vec2[]): Projection => {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const point of points) {
    const value = projectPoint(axis, point)
    if (value < min) {
      min = value
    }
    if (value > max) {
      max = value
    }
  }
  return { min, max }
}

const overlaps = (a: Projection, b: Projection): boolean => a.min <= b.max && b.min <= a.max

const rectCorners = (rect: Rect): readonly Vec2[] => [
  { x: rect.x, y: rect.y },
  { x: rect.x + rect.width, y: rect.y },
  { x: rect.x + rect.width, y: rect.y + rect.height },
  { x: rect.x, y: rect.y + rect.height },
]

const triangleAxes = (triangle: Triangle): readonly Axis[] => {
  const edges: Vec2[] = [
    { x: triangle.b.x - triangle.a.x, y: triangle.b.y - triangle.a.y },
    { x: triangle.c.x - triangle.b.x, y: triangle.c.y - triangle.b.y },
    { x: triangle.a.x - triangle.c.x, y: triangle.a.y - triangle.c.y },
  ]
  // Perpendicular of each edge.
  return edges.map((edge) => ({ x: -edge.y, y: edge.x }))
}

export function rectIntersectsTriangle(rect: Rect, triangle: Triangle): boolean {
  const corners = rectCorners(rect)
  const points: readonly Vec2[] = [triangle.a, triangle.b, triangle.c]
  const axes: readonly Axis[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, ...triangleAxes(triangle)]

  for (const axis of axes) {
    if (!overlaps(projectPoints(axis, corners), projectPoints(axis, points))) {
      return false
    }
  }
  return true
}

/** Cheap rejection pass before the SAT work. */
export const triangleBoundsHit = (rect: Rect, triangle: Triangle, padding = 0): boolean => {
  const minX = Math.min(triangle.a.x, triangle.b.x, triangle.c.x) - padding
  const maxX = Math.max(triangle.a.x, triangle.b.x, triangle.c.x) + padding
  const minY = Math.min(triangle.a.y, triangle.b.y, triangle.c.y) - padding
  const maxY = Math.max(triangle.a.y, triangle.b.y, triangle.c.y) + padding
  return (
    rect.x < maxX && rect.x + rect.width > minX && rect.y < maxY && rect.y + rect.height > minY
  )
}

export const pointInCircle = (point: Vec2, center: Vec2, radius: number): boolean => {
  const dx = point.x - center.x
  const dy = point.y - center.y
  return dx * dx + dy * dy <= radius * radius
}

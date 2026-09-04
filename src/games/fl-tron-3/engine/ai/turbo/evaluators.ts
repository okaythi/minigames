import { DIRECTION_VECTORS } from '../../cycle'
import type { OccupancyGrid } from '../../grid'
import type { CycleState } from '../../types'

export function computeGeometricCutoffScore(ai: CycleState, p1: CycleState, grid: OccupancyGrid): number {
  const aiVec = DIRECTION_VECTORS[ai.dir]
  const p1Vec = DIRECTION_VECTORS[p1.dir]

  const isPerpendicular = Math.abs(aiVec.x * p1Vec.x + aiVec.y * p1Vec.y) === 0
  const dx = p1.col - ai.col
  const dy = p1.row - ai.row

  if (isPerpendicular) {
    let aiDist = 0
    let p1Dist = 0

    if (aiVec.x !== 0) {
      if (Math.sign(dx) === Math.sign(aiVec.x) && Math.sign(dy) === -Math.sign(p1Vec.y)) {
        aiDist = Math.abs(dx)
        p1Dist = Math.abs(dy)
      }
    } else {
      if (Math.sign(dy) === Math.sign(aiVec.y) && Math.sign(dx) === -Math.sign(p1Vec.x)) {
        aiDist = Math.abs(dy)
        p1Dist = Math.abs(dx)
      }
    }

    if (aiDist > 0 && p1Dist > 0 && aiDist < 35 && p1Dist < 35) {
      const intersectCol = aiVec.x !== 0 ? p1.col : ai.col
      const intersectRow = aiVec.y !== 0 ? p1.row : ai.row

      if (grid.isFree(intersectCol, intersectRow)) {
        // Check exit viability at and beyond the intersection point
        const exitCol = intersectCol + aiVec.x
        const exitRow = intersectRow + aiVec.y
        const hasForwardExit = grid.isFree(exitCol, exitRow)
        const hasSideExits =
          grid.isFree(intersectCol - aiVec.y, intersectRow - aiVec.x) ||
          grid.isFree(intersectCol + aiVec.y, intersectRow + aiVec.x)

        if (hasForwardExit || hasSideExits) {
          const normalSpeedWins = aiDist < p1Dist
          const turboSpeedWins = aiDist / 1.8 < p1Dist - 0.5

          if (!normalSpeedWins && turboSpeedWins) {
            return 90
          }
          if (normalSpeedWins && aiDist > 4 && p1Dist < 16) {
            return 55
          }
        }
      }
    }
  } else {
    const isSameHeading = aiVec.x === p1Vec.x && aiVec.y === p1Vec.y
    if (isSameHeading) {
      const isDirectlyBehind =
        (aiVec.x !== 0 && Math.sign(dx) === Math.sign(aiVec.x) && ai.row === p1.row) ||
        (aiVec.y !== 0 && Math.sign(dy) === Math.sign(aiVec.y) && ai.col === p1.col)
      const dist = Math.abs(dx) + Math.abs(dy)
      if (isDirectlyBehind && dist >= 8 && dist < 24) {
        // Ensure player has runway ahead so AI doesn't slam into player's immediate corner turn
        const p1Vec = DIRECTION_VECTORS[p1.dir]
        let p1Runway = 0
        while (p1Runway < 8) {
          const pc = p1.col + p1Vec.x * (p1Runway + 1)
          const pr = p1.row + p1Vec.y * (p1Runway + 1)
          if (!grid.isFree(pc, pr)) break
          p1Runway += 1
        }
        if (p1Runway >= 5) {
          return 70
        }
      }
    }
  }

  return 0
}

export function computeTerritoryGainScore(
  ai: CycleState,
  p1: CycleState,
  grid: OccupancyGrid,
  depth: number,
): number {
  const curVec = DIRECTION_VECTORS[ai.dir]
  const nextCol = ai.col + curVec.x * 2
  const nextRow = ai.row + curVec.y * 2

  if (!grid.isFree(nextCol, nextRow)) return 0

  const baseline = grid.voronoiTerritory(p1.col, p1.row, ai.col, ai.row, depth)
  const projected = grid.voronoiTerritory(p1.col, p1.row, nextCol, nextRow, depth)

  const deltaAi = projected.aiArea - baseline.aiArea
  const deltaP1 = baseline.p1Area - projected.p1Area

  const gain = deltaAi * 1.5 + deltaP1 * 1.2
  return Math.max(0, Math.min(100, gain * 3.5))
}

export function computePinchEscapeScore(ai: CycleState, grid: OccupancyGrid): number {
  const vec = DIRECTION_VECTORS[ai.dir]
  const forwardCol = ai.col + vec.x
  const forwardRow = ai.row + vec.y
  if (!grid.isFree(forwardCol, forwardRow)) return 0

  const chamber = grid.floodFillArea(forwardCol, forwardRow, 100)
  if (chamber >= 45) return 0

  let runway = 0
  while (runway < 20) {
    const nc = ai.col + vec.x * (runway + 1)
    const nr = ai.row + vec.y * (runway + 1)
    if (!grid.isFree(nc, nr)) break
    runway += 1
  }

  return runway >= 6 ? 85 : 0
}

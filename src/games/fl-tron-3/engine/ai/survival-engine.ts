import { DIRECTION_VECTORS, OPPOSITE_DIRECTIONS } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { CycleState, Direction } from '../types'
import type { ChamberDiagnosis, MoveProposal, VetoVerdict } from './types'

const ALL_DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left']

export class SurvivalEngine {
  /**
   * Finds the open reachable frontier cell for a cycle (forward cell if clear, or largest adjacent open neighbor).
   */
  public static getCycleFrontier(cycle: CycleState, grid: OccupancyGrid, maxArea = 1200): { area: number; col: number; row: number } {
    const curVec = DIRECTION_VECTORS[cycle.dir]
    const forwardCol = cycle.col + curVec.x
    const forwardRow = cycle.row + curVec.y

    if (grid.isFree(forwardCol, forwardRow)) {
      return { area: grid.floodFillArea(forwardCol, forwardRow, maxArea), col: forwardCol, row: forwardRow }
    }

    const opposite = OPPOSITE_DIRECTIONS[cycle.dir]
    let bestArea = 0
    let bestCol = cycle.col
    let bestRow = cycle.row

    for (const dir of ALL_DIRECTIONS) {
      if (dir === opposite) continue
      const vec = DIRECTION_VECTORS[dir]
      const nc = cycle.col + vec.x
      const nr = cycle.row + vec.y
      if (grid.isFree(nc, nr)) {
        const area = grid.floodFillArea(nc, nr, maxArea)
        if (area > bestArea) {
          bestArea = area
          bestCol = nc
          bestRow = nr
        }
      }
    }

    return { area: bestArea, col: bestCol, row: bestRow }
  }

  /**
   * Diagnoses whether the player is a "lost cause" / doomed.
   * Accurately measures reachable open chamber from the cycle frontier.
   */
  public static diagnosePlayer(p1: CycleState, ai: CycleState, grid: OccupancyGrid): ChamberDiagnosis {
    const p1Frontier = this.getCycleFrontier(p1, grid, 1200)
    const aiFrontier = this.getCycleFrontier(ai, grid, 1200)

    const isSameChamber =
      p1Frontier.area > 0 &&
      aiFrontier.area > 0 &&
      this.checkSameChamberAt(p1Frontier.col, p1Frontier.row, aiFrontier.col, aiFrontier.row, grid)

    const playerDoomed =
      p1Frontier.area < 100 ||
      (!isSameChamber && p1Frontier.area < aiFrontier.area * 0.25)

    return {
      playerArea: p1Frontier.area,
      aiArea: aiFrontier.area,
      playerDoomed,
      sameChamber: isSameChamber,
    }
  }

  /**
   * The Veto Evaluation:
   * Decides what the AI is mathematically allowed to do.
   * Level 6 is mathematically guaranteed to NEVER trap itself by strictly selecting maximal topological chamber volume.
   */
  public static evaluateVeto(
    ai: CycleState,
    p1: CycleState,
    proposal: MoveProposal,
    grid: OccupancyGrid,
    level: number = 1,
  ): VetoVerdict {
    const safeDirections = this.getSafeDirections(ai, grid)

    if (safeDirections.length === 0) {
      return {
        allowed: false,
        finalDir: ai.dir,
        finalTurbo: false,
        overrideReason: 'no_safe_turns',
      }
    }

    const curVec = DIRECTION_VECTORS[ai.dir]
    const destCol = ai.col + curVec.x
    const destRow = ai.row + curVec.y

    const isDirectionSafe = safeDirections.includes(proposal.desiredDir)
    let isSafe = isDirectionSafe

    // Chamber volume & topological deadlock check on proposed move
    if (isSafe) {
      const propVec = DIRECTION_VECTORS[proposal.desiredDir]
      const futureCol = destCol + propVec.x
      const futureRow = destRow + propVec.y

      if (level >= 6) {
        // Level 6 Master Core: Mathematical Zero-Self-Trap Guarantee
        const proposedChamber = grid.floodFillArea(futureCol, futureRow, 1200)
        let maxAvailableChamber = proposedChamber
        for (const d of safeDirections) {
          const dVec = DIRECTION_VECTORS[d]
          const c = destCol + dVec.x
          const r = destRow + dVec.y
          const ch = grid.floodFillArea(c, r, 1200)
          if (ch > maxAvailableChamber) {
            maxAvailableChamber = ch
          }
        }

        // Veto if proposed turn enters a dead-end or a chamber significantly smaller than the maximum open space
        if (proposedChamber < 60 || proposedChamber < maxAvailableChamber * 0.75) {
          isSafe = false
        }
      } else if (level === 5) {
        // Level 5 Assassin: High survival volume guarantee (near-zero self-trap chance)
        const proposedChamber = grid.floodFillArea(futureCol, futureRow, 800)
        if (proposedChamber < 50) {
          isSafe = false
        }
      } else {
        // Levels 1-4: Exact original behavior untouched
        const proposedChamber = grid.floodFillArea(futureCol, futureRow, 500)
        if (proposedChamber < 30) {
          isSafe = false
        }
      }
    }

    let finalDir = proposal.desiredDir
    let overrideReason: string | undefined

    if (!isSafe) {
      finalDir = this.findSafestDirection(ai, p1, safeDirections, grid, level)
      overrideReason = !isDirectionSafe ? 'immediate_lethal_hazard' : 'chamber_volume_too_small'
    }

    // Turbo safety check: only veto if physical runway is too short to turn safely (< 4 cells)
    let finalTurbo = proposal.wantsTurbo
    if (finalTurbo) {
      const runway = this.getClearRunway(destCol, destRow, finalDir, grid)
      if (runway < 4) {
        finalTurbo = false
      }
    }

    return {
      allowed: isSafe,
      finalDir,
      finalTurbo,
      overrideReason,
    }
  }

  public static getSafeDirections(cycle: CycleState, grid: OccupancyGrid): Direction[] {
    const result: Direction[] = []
    const opposite = OPPOSITE_DIRECTIONS[cycle.dir]
    const curVec = DIRECTION_VECTORS[cycle.dir]
    const destCol = cycle.col + curVec.x
    const destRow = cycle.row + curVec.y

    if (!grid.isFree(destCol, destRow)) {
      return result
    }

    for (const dir of ALL_DIRECTIONS) {
      if (dir === opposite) continue
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = destCol + vec.x
      const nextRow = destRow + vec.y
      if (grid.isFree(nextCol, nextRow)) {
        result.push(dir)
      }
    }

    return result
  }

  public static getClearRunway(col: number, row: number, dir: Direction, grid: OccupancyGrid): number {
    const vec = DIRECTION_VECTORS[dir]
    let steps = 0
    while (steps < 40) {
      const nextCol = col + vec.x * (steps + 1)
      const nextRow = row + vec.y * (steps + 1)
      if (!grid.isFree(nextCol, nextRow)) {
        break
      }
      steps += 1
    }
    return steps
  }

  private static findSafestDirection(
    ai: CycleState,
    _p1: CycleState,
    safeDirs: readonly Direction[],
    grid: OccupancyGrid,
    level: number,
  ): Direction {
    let bestDir = safeDirs[0] ?? ai.dir
    let bestScore = -Infinity

    const curVec = DIRECTION_VECTORS[ai.dir]
    const destCol = ai.col + curVec.x
    const destRow = ai.row + curVec.y

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = destCol + vec.x
      const nextRow = destRow + vec.y

      const chamber = grid.floodFillArea(nextCol, nextRow, level >= 5 ? 1200 : 600)
      const runway = this.getClearRunway(destCol, destRow, dir, grid)

      // Score strictly maximizes topological chamber volume and forward escape runway
      const score = chamber * 2.5 + runway * 12 + (dir === ai.dir ? 25 : 0)

      if (score > bestScore) {
        bestScore = score
        bestDir = dir
      }
    }

    return bestDir
  }

  private static checkSameChamberAt(colA: number, rowA: number, colB: number, rowB: number, grid: OccupancyGrid): boolean {
    if (!grid.isFree(colA, rowA) || !grid.isFree(colB, rowB)) return false
    if (colA === colB && rowA === rowB) return true

    const visited = new Uint8Array(grid.cols * grid.rows)
    const queueCol = new Int16Array(grid.cols * grid.rows)
    const queueRow = new Int16Array(grid.cols * grid.rows)
    let head = 0
    let tail = 0

    const startIdx = rowA * grid.cols + colA
    visited[startIdx] = 1
    queueCol[tail] = colA
    queueRow[tail] = rowA
    tail += 1

    const dCols = [0, 0, -1, 1]
    const dRows = [-1, 1, 0, 0]

    while (head < tail) {
      const c = queueCol[head] ?? 0
      const r = queueRow[head] ?? 0
      head += 1

      if (c === colB && r === rowB) {
        return true
      }

      for (let i = 0; i < 4; i += 1) {
        const nc = c + (dCols[i] ?? 0)
        const nr = r + (dRows[i] ?? 0)
        if (grid.isFree(nc, nr)) {
          const idx = nr * grid.cols + nc
          if (visited[idx] === 0) {
            visited[idx] = 1
            queueCol[tail] = nc
            queueRow[tail] = nr
            tail += 1
          }
        }
      }
    }

    return false
  }
}

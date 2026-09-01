import { DIRECTION_VECTORS, OPPOSITE_DIRECTIONS } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { CycleState, Direction } from '../types'
import type { ChamberDiagnosis, MoveProposal, VetoVerdict } from './types'

const ALL_DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left']

export class SurvivalEngine {
  /**
   * Diagnoses whether the player is a "lost cause" / doomed.
   * If the player's available flood fill volume is tiny (< 100 cells),
   * or if the player is sealed inside an isolated box, playerDoomed becomes true.
   */
  public static diagnosePlayer(p1: CycleState, ai: CycleState, grid: OccupancyGrid): ChamberDiagnosis {
    const p1Area = grid.floodFillArea(p1.col, p1.row, 1200)
    const aiArea = grid.floodFillArea(ai.col, ai.row, 1200)

    // Check if player and AI are in the same open partition
    const isSameChamber = this.checkSameChamber(p1, ai, grid)

    const playerDoomed = p1Area < 100 || (!isSameChamber && p1Area < aiArea * 0.35)

    return {
      playerArea: p1Area,
      aiArea,
      playerDoomed,
      sameChamber: isSameChamber,
    }
  }

  /**
   * The Veto Evaluation:
   * Decides what the AI is mathematically allowed to do.
   * If a proposed move leads into a wall, a dead end, or a fatal pinch,
   * the Survival Engine vetoes the proposal and overrides it with the safest alternative.
   */
  public static evaluateVeto(
    ai: CycleState,
    proposal: MoveProposal,
    grid: OccupancyGrid,
  ): VetoVerdict {
    const safeDirections = this.getSafeDirections(ai, grid)

    if (safeDirections.length === 0) {
      // Complete trap, no escape possible
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

    // 2. Chamber volume check on proposed move
    let proposedChamberArea = 0
    if (isSafe) {
      const propVec = DIRECTION_VECTORS[proposal.desiredDir]
      const futureCol = destCol + propVec.x
      const futureRow = destRow + propVec.y
      proposedChamberArea = grid.floodFillArea(futureCol, futureRow, 500)
      // If the resulting volume is below a critical survival threshold (e.g. < 30 cells), veto!
      if (proposedChamberArea < 30) {
        isSafe = false
      }
    }

    let finalDir = proposal.desiredDir
    let overrideReason: string | undefined

    if (!isSafe) {
      // VETO TRIGGERED: Find the safest alternative turn with maximum open chamber volume
      finalDir = this.findSafestDirection(ai, safeDirections, grid)
      overrideReason = !isDirectionSafe ? 'immediate_lethal_hazard' : 'chamber_volume_too_small'
    }

    // 3. Turbo safety check: do not turbo straight into a wall without clear runway
    let finalTurbo = proposal.wantsTurbo
    if (finalTurbo) {
      const runway = this.getClearRunway(destCol, destRow, finalDir, grid)
      if (runway < 6) {
        finalTurbo = false // Veto turbo into tight space
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

    // If the immediate destination cell is already blocked, no turns from it can save the cycle
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
    safeDirs: readonly Direction[],
    grid: OccupancyGrid,
  ): Direction {
    let bestDir = safeDirs[0] ?? ai.dir
    let bestScore = -1

    const curVec = DIRECTION_VECTORS[ai.dir]
    const destCol = ai.col + curVec.x
    const destRow = ai.row + curVec.y

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = destCol + vec.x
      const nextRow = destRow + vec.y
      const chamber = grid.floodFillArea(nextCol, nextRow, 600)
      const runway = this.getClearRunway(destCol, destRow, dir, grid)
      const score = chamber * 2 + runway * 10 + (dir === ai.dir ? 25 : 0)

      if (score > bestScore) {
        bestScore = score
        bestDir = dir
      }
    }

    return bestDir
  }

  private static checkSameChamber(p1: CycleState, ai: CycleState, grid: OccupancyGrid): boolean {
    if (!grid.isFree(p1.col, p1.row) || !grid.isFree(ai.col, ai.row)) return false

    const visited = new Uint8Array(grid.cols * grid.rows)
    const queueCol = new Int16Array(800)
    const queueRow = new Int16Array(800)
    let head = 0
    let tail = 0

    const startIdx = p1.row * grid.cols + p1.col
    visited[startIdx] = 1
    queueCol[tail] = p1.col
    queueRow[tail] = p1.row
    tail += 1

    const dCols = [0, 0, -1, 1]
    const dRows = [-1, 1, 0, 0]

    while (head < tail) {
      const c = queueCol[head] ?? 0
      const r = queueRow[head] ?? 0
      head += 1

      if (c === ai.col && r === ai.row) {
        return true
      }

      for (let i = 0; i < 4; i += 1) {
        const nc = c + (dCols[i] ?? 0)
        const nr = r + (dRows[i] ?? 0)
        if (grid.isFree(nc, nr)) {
          const idx = nr * grid.cols + nc
          if (visited[idx] === 0) {
            visited[idx] = 1
            if (tail < 800) {
              queueCol[tail] = nc
              queueRow[tail] = nr
              tail += 1
            }
          }
        }
      }
    }

    return false
  }
}

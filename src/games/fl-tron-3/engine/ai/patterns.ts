import { DIRECTION_VECTORS } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { CycleState, Direction } from '../types'

export interface PatternState {
  macroQueue: Direction[]
  macroIndex: number
  lawnmowerTurnDirection: 'left' | 'right'
  lawnmowerStep: number
  stairStepCounter: number
  /** Tracks which relative side (left/right of heading) the last staircase macro used.
   *  The next macro always uses the opposite side, creating adjacent "glued" staircases. */
  lastStairSide: 'left' | 'right' | null
  stairDirA: Direction | null
  stairDirB: Direction | null
  stairRemainingSteps: number
}

export function createInitialPatternState(): PatternState {
  return {
    macroQueue: [],
    macroIndex: 0,
    lawnmowerTurnDirection: 'right',
    lawnmowerStep: 0,
    stairStepCounter: 0,
    lastStairSide: null,
    stairDirA: null,
    stairDirB: null,
    stairRemainingSteps: 0,
  }
}

export class AIPatterns {
  /**
   * Generates a Lawnmower Space-Filling move.
   * Hugs its own trail: drives straight until 1 cell away from an obstacle/wall,
   * turns 90°, takes 1 step, and turns 90° again to run parallel in reverse.
   */
  public static generateLawnmowerMove(
    ai: CycleState,
    grid: OccupancyGrid,
    pattern: PatternState,
  ): Direction {
    const curVec = DIRECTION_VECTORS[ai.dir]
    const destCol = ai.col + curVec.x
    const destRow = ai.row + curVec.y
    const nextCol2 = destCol + curVec.x
    const nextRow2 = destRow + curVec.y

    const isDirectlyBlocked = !grid.isFree(destCol, destRow)
    const isOneCellAway = !grid.isFree(nextCol2, nextRow2)

    if (isDirectlyBlocked || isOneCellAway) {
      // Time to turn! Determine best orthogonal side (left or right relative to heading)
      const { leftDir, rightDir } = this.getOrthogonalDirections(ai.dir)

      const leftSafe = this.isDirectionClear(ai, leftDir, grid)
      const rightSafe = this.isDirectionClear(ai, rightDir, grid)

      let chosenTurn: Direction
      if (leftSafe && rightSafe) {
        chosenTurn = pattern.lawnmowerTurnDirection === 'left' ? leftDir : rightDir
      } else if (leftSafe) {
        chosenTurn = leftDir
        pattern.lawnmowerTurnDirection = 'left'
      } else if (rightSafe) {
        chosenTurn = rightDir
        pattern.lawnmowerTurnDirection = 'right'
      } else {
        chosenTurn = ai.dir
      }

      return chosenTurn
    }

    return ai.dir
  }

  /**
   * Generates next move in a machine-precise 1-cell step diagonal staircase macro.
   * Alternates directions every single cell: [dirA, dirB, dirA, dirB...]
   * Resulting trail is a minimally narrow, flawless 45° micro-diagonal.
   */
  public static generateStaircaseStep(
    ai: CycleState,
    grid: OccupancyGrid,
    pattern: PatternState,
    isThick = false,
    preferredTurnDir?: Direction,
  ): Direction {
    // 1. Initialize new staircase sequence if not active or finished
    const needsInit =
      pattern.stairDirA === null ||
      pattern.stairDirB === null ||
      pattern.stairRemainingSteps <= 0 ||
      (ai.dir !== pattern.stairDirA && ai.dir !== pattern.stairDirB)

    if (needsInit) {
      const { leftDir, rightDir } = this.getOrthogonalDirections(ai.dir)

      let turnA: Direction
      if (preferredTurnDir) {
        turnA = preferredTurnDir
        pattern.lastStairSide = preferredTurnDir === leftDir ? 'left' : 'right'
      } else {
        // Glued-staircase: alternate sides between macro runs for space-filling adjacent stairs
        const nextSide =
          pattern.lastStairSide === 'left'
            ? 'right'
            : pattern.lastStairSide === 'right'
              ? 'left'
              : Math.random() < 0.5
                ? 'left'
                : 'right'
        turnA = nextSide === 'left' ? leftDir : rightDir
        pattern.lastStairSide = nextSide
      }

      pattern.stairDirA = turnA
      pattern.stairDirB = ai.dir
      pattern.stairRemainingSteps = isThick ? 16 : 12
    }

    const turnA = pattern.stairDirA!
    const turnB = pattern.stairDirB!

    // In a 1-cell staircase, if currently moving in turnB, next desired turn is turnA.
    // If currently moving in turnA, next desired turn is turnB.
    const nextDir = ai.dir === turnB ? turnA : turnB

    // 2. Lookahead Safety Check: Verify that stepping in nextDir doesn't trap the AI
    const curVec = DIRECTION_VECTORS[ai.dir]
    const destCol = ai.col + curVec.x
    const destRow = ai.row + curVec.y
    const nextVec = DIRECTION_VECTORS[nextDir]
    const stepCol = destCol + nextVec.x
    const stepRow = destRow + nextVec.y

    const isStepFree = grid.isFree(stepCol, stepRow)
    const chamber = isStepFree ? grid.floodFillArea(stepCol, stepRow, 250) : 0

    // If next stair step is blocked or enters a dangerously small chamber, ABORT staircase immediately!
    if (!isStepFree || chamber < 35) {
      pattern.stairDirA = null
      pattern.stairDirB = null
      pattern.stairRemainingSteps = 0
      return ai.dir
    }

    pattern.stairRemainingSteps -= 1
    return nextDir
  }

  public static getOrthogonalDirections(dir: Direction): { leftDir: Direction; rightDir: Direction } {
    switch (dir) {
      case 'up':
        return { leftDir: 'left', rightDir: 'right' }
      case 'down':
        return { leftDir: 'right', rightDir: 'left' }
      case 'left':
        return { leftDir: 'down', rightDir: 'up' }
      case 'right':
        return { leftDir: 'up', rightDir: 'down' }
    }
  }

  private static isDirectionClear(cycle: CycleState, dir: Direction, grid: OccupancyGrid): boolean {
    const curVec = DIRECTION_VECTORS[cycle.dir]
    const destCol = cycle.col + curVec.x
    const destRow = cycle.row + curVec.y
    const vec = DIRECTION_VECTORS[dir]
    const nextCol = destCol + vec.x
    const nextRow = destRow + vec.y
    return grid.isFree(nextCol, nextRow)
  }
}

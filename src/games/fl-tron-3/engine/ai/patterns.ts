import { DIRECTION_VECTORS } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { CycleState, Direction } from '../types'

export type ActiveMacroType = 'none' | 'staircase' | 'lawnmower'

export interface PatternState {
  activePattern: ActiveMacroType
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
  isThick: boolean
}

export function createInitialPatternState(): PatternState {
  return {
    activePattern: 'none',
    macroQueue: [],
    macroIndex: 0,
    lawnmowerTurnDirection: 'right',
    lawnmowerStep: 0,
    stairStepCounter: 0,
    lastStairSide: null,
    stairDirA: null,
    stairDirB: null,
    stairRemainingSteps: 0,
    isThick: false,
  }
}

export class AIPatterns {
  public static isStaircaseActive(pattern: PatternState): boolean {
    return pattern.activePattern === 'staircase' && pattern.stairRemainingSteps > 0
  }

  public static isMacroActive(pattern: PatternState): boolean {
    return pattern.activePattern !== 'none'
  }

  /**
   * Initializes a new staircase macro sequence with a specified step length, thick/thin style, and preferred turn.
   */
  public static initStaircase(
    ai: CycleState,
    pattern: PatternState,
    totalSteps: number,
    isThick = false,
    preferredTurnDir?: Direction,
  ): void {
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

    pattern.activePattern = 'staircase'
    pattern.stairDirA = turnA
    pattern.stairDirB = ai.dir
    pattern.stairRemainingSteps = Math.min(60, Math.max(2, totalSteps))
    pattern.stairStepCounter = 0
    pattern.isThick = isThick
  }

  /**
   * Safely resets active staircase state.
   */
  public static resetStaircase(pattern: PatternState): void {
    pattern.activePattern = 'none'
    pattern.stairDirA = null
    pattern.stairDirB = null
    pattern.stairRemainingSteps = 0
    pattern.stairStepCounter = 0
    pattern.isThick = false
  }

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
   * Generates next move in a machine-precise diagonal staircase macro.
   * Alternates directions every 1 cell (or 2 cells for thick stairs).
   * Verifies safety at every step and aborts safely if blocked or entering a tight chamber.
   */
  public static generateStaircaseStep(
    ai: CycleState,
    grid: OccupancyGrid,
    pattern: PatternState,
    isThick = false,
    preferredTurnDir?: Direction,
    requestedSteps = 12,
  ): Direction {
    // 1. Initialize new staircase sequence if not active or steps finished
    const needsInit =
      pattern.activePattern !== 'staircase' ||
      pattern.stairDirA === null ||
      pattern.stairDirB === null ||
      pattern.stairRemainingSteps <= 0 ||
      (ai.dir !== pattern.stairDirA && ai.dir !== pattern.stairDirB)

    if (needsInit) {
      this.initStaircase(ai, pattern, requestedSteps, isThick, preferredTurnDir)
    }

    const turnA = pattern.stairDirA!
    const turnB = pattern.stairDirB!
    const thick = pattern.isThick

    let nextDir: Direction
    if (thick) {
      // 2-cell thick staircase: step 2 cells in turnA, then 2 cells in turnB
      if (pattern.stairStepCounter === 0) {
        pattern.stairStepCounter = 1
        nextDir = turnA
      } else if (ai.dir === turnA) {
        if (pattern.stairStepCounter < 2) {
          pattern.stairStepCounter += 1
          nextDir = turnA
        } else {
          pattern.stairStepCounter = 1
          nextDir = turnB
        }
      } else if (ai.dir === turnB) {
        if (pattern.stairStepCounter < 2) {
          pattern.stairStepCounter += 1
          nextDir = turnB
        } else {
          pattern.stairStepCounter = 1
          nextDir = turnA
        }
      } else {
        pattern.stairStepCounter = 1
        nextDir = turnA
      }
    } else {
      // 1-cell micro-staircase: strictly alternate every single cell
      nextDir = ai.dir === turnB ? turnA : turnB
    }

    // 2. Lookahead Safety Check: Verify that stepping in nextDir doesn't trap or crash the AI
    const curVec = DIRECTION_VECTORS[ai.dir]
    const destCol = ai.col + curVec.x
    const destRow = ai.row + curVec.y
    const nextVec = DIRECTION_VECTORS[nextDir]
    const stepCol = destCol + nextVec.x
    const stepRow = destRow + nextVec.y

    const isDestFree = grid.isFree(destCol, destRow)
    const isStepFree = grid.isFree(stepCol, stepRow)
    const chamber = isStepFree ? grid.floodFillArea(stepCol, stepRow, 250) : 0

    // If next stair step is blocked or enters a dangerously small chamber, ABORT staircase safely!
    if (!isDestFree || !isStepFree || chamber < 35) {
      this.resetStaircase(pattern)
      return ai.dir
    }

    pattern.stairRemainingSteps -= 1
    if (pattern.stairRemainingSteps <= 0) {
      this.resetStaircase(pattern)
    }

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

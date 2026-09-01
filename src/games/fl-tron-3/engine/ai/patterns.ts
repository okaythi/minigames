import { DIRECTION_VECTORS } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { CycleState, Direction } from '../types'

export interface PatternState {
  macroQueue: Direction[]
  macroIndex: number
  lawnmowerTurnDirection: 'left' | 'right'
  lawnmowerStep: number
  stairStepCounter: number
}

export function createInitialPatternState(): PatternState {
  return {
    macroQueue: [],
    macroIndex: 0,
    lawnmowerTurnDirection: 'right',
    lawnmowerStep: 0,
    stairStepCounter: 0,
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
    const vec = DIRECTION_VECTORS[ai.dir]
    const nextCol1 = ai.col + vec.x
    const nextRow1 = ai.row + vec.y
    const nextCol2 = ai.col + vec.x * 2
    const nextRow2 = ai.row + vec.y * 2

    const isDirectlyBlocked = !grid.isFree(nextCol1, nextRow1)
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
   * Generates next move in a Staircase macro.
   * Alternates directions [Turn 90°, step, Turn -90°, step]
   */
  public static generateStaircaseStep(
    ai: CycleState,
    pattern: PatternState,
    isThick = false,
  ): Direction {
    if (pattern.macroQueue.length === 0 || pattern.macroIndex >= pattern.macroQueue.length) {
      // Build new staircase macro sequence
      const { leftDir, rightDir } = this.getOrthogonalDirections(ai.dir)
      const turnA = Math.random() < 0.5 ? leftDir : rightDir
      const turnB = ai.dir

      const stepsPerLeg = isThick ? 2 : 1
      const queue: Direction[] = []

      for (let s = 0; s < 6; s += 1) {
        for (let i = 0; i < stepsPerLeg; i += 1) {
          queue.push(turnA)
        }
        for (let i = 0; i < stepsPerLeg; i += 1) {
          queue.push(turnB)
        }
      }

      pattern.macroQueue = queue
      pattern.macroIndex = 0
    }

    const nextDir = pattern.macroQueue[pattern.macroIndex] ?? ai.dir
    pattern.macroIndex += 1
    return nextDir
  }

  private static getOrthogonalDirections(dir: Direction): { leftDir: Direction; rightDir: Direction } {
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
    const vec = DIRECTION_VECTORS[dir]
    const nextCol = cycle.col + vec.x
    const nextRow = cycle.row + vec.y
    return grid.isFree(nextCol, nextRow)
  }
}

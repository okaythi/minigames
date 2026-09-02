import { AI_CONFIGS } from '../config'
import { DIRECTION_VECTORS } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { AILevelConfig, CycleState, DifficultyLevel, Direction } from '../types'
import { AIPatterns, createInitialPatternState, type PatternState } from './patterns'
import { SurvivalEngine } from './survival-engine'
import type { AIIntent, MoveProposal } from './types'

export type AIMood = 'aggressive' | 'having_fun' | 'passing_time'

export class PersonalityEngine {
  private mood: AIMood = 'aggressive'
  private patternState: PatternState = createInitialPatternState()
  private playerDoomed = false
  private diagnosisTimer = 0
  private funCooldownTimer = 0
  /** Counts time since last turbo opportunity check for the Level 5 8s timer. */
  private level5TurboTimer = 0
  private level5TurboWantsTrigger = false

  public constructor(private readonly level: DifficultyLevel) {}

  public get currentMood(): AIMood {
    return this.mood
  }

  public get isPlayerDoomed(): boolean {
    return this.playerDoomed
  }

  public proposeMove(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    dt: number,
  ): MoveProposal {
    const config = AI_CONFIGS[this.level]

    // 1. Periodically diagnose whether the player is doomed (Level 3 onwards)
    if (config.level >= 3) {
      this.diagnosisTimer += dt
      if (this.diagnosisTimer > 0.12) {
        this.diagnosisTimer = 0
        const diagnosis = SurvivalEngine.diagnosePlayer(p1, ai, grid)
        this.playerDoomed = diagnosis.playerDoomed
      }
    }

    // Advance Level 5 8-second cutoff turbo interval
    if (config.level === 5) {
      this.level5TurboTimer += dt
      if (this.level5TurboTimer >= 8.0) {
        this.level5TurboTimer = 0
        if (Math.random() < 0.40) {
          this.level5TurboWantsTrigger = true
        }
      }
    }

    if (this.funCooldownTimer > 0) {
      this.funCooldownTimer -= dt
    }

    const distToPlayer = Math.hypot(ai.col - p1.col, ai.row - p1.row)

    // 2. Personality State Machine
    if (this.playerDoomed && config.level >= 4) {
      // THE "PASSING TIME" STATE: Player is a lost cause, run out the clock with lawnmower or thick stairs
      this.mood = 'passing_time'
      const useLawnmower = Math.random() < 0.75
      if (useLawnmower) {
        const dir = AIPatterns.generateLawnmowerMove(ai, grid, this.patternState)
        return { desiredDir: dir, wantsTurbo: false, intent: 'lawnmower' }
      } else {
        const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, true)
        return { desiredDir: dir, wantsTurbo: false, intent: 'thick_stairs' }
      }
    }

    // 3. "HAVING FUN" STATE: Level-specific staircase / lawnmower patterns
    // (Level 5 is excluded: prime directive is relentless tailing)
    if (config.enjoysStairs && this.funCooldownTimer <= 0) {
      if (config.level === 3) {
        // Level 3 LOVES stairs in open space: always machine-precise 1-cell step.
        // Glued-staircase technique automatically mirrors on the adjacent edge.
        // Needs adequate open chamber (> 320 cells) and safe distance to avoid self-trapping.
        if (distToPlayer > 10) {
          const aiChamber = grid.floodFillArea(ai.col, ai.row, 1200)
          if (aiChamber > 320 && Math.random() < config.stairProbability) {
            this.mood = 'having_fun'
            const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, false)
            if (dir === ai.dir && this.patternState.stairDirA === null) {
              // Staircase aborted or no safe path, cooldown to exit region safely
              this.funCooldownTimer = 1.2
              this.mood = 'aggressive'
            } else {
              return { desiredDir: dir, wantsTurbo: false, intent: 'staircase' }
            }
          }
        }
      } else if (config.level === 4) {
        // Level 4: Stairs aimed toward the player as an approach shortcut.
        // Turbo fires only when mid-range (18–38 cells) and at least 1 spare turbo remains.
        if (distToPlayer > 18) {
          const aiChamber = grid.floodFillArea(ai.col, ai.row, 1200)
          if (aiChamber > 500 && Math.random() < config.stairProbability) {
            this.mood = 'having_fun'
            const { leftDir, rightDir } = AIPatterns.getOrthogonalDirections(ai.dir)
            const preferredDir = this.pickDirTowardTarget(ai, p1, leftDir, rightDir)
            const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, false, preferredDir)
            // Turbo only when actually closing in on the player AND a spare turbo is kept in reserve
            const isApproach = distToPlayer < 38
            const wantsTurbo =
              isApproach &&
              !ai.isTurbo &&
              ai.turboCooldown === 0 &&
              ai.turbosLeft > 1 &&
              Math.random() < 0.12
            return { desiredDir: dir, wantsTurbo, intent: 'staircase' }
          }
        }
      } else if (config.level !== 5 && distToPlayer > 26) {
        // Levels 1, 2, 6: original broad-space staircase logic
        const aiChamber = grid.floodFillArea(ai.col, ai.row, 1200)
        if (aiChamber > 900 && Math.random() < config.stairProbability) {
          this.mood = 'having_fun'
          const isThick = Math.random() < 0.4
          const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, isThick)
          const wantsTurbo = config.level >= 6 && Math.random() < 0.25
          return { desiredDir: dir, wantsTurbo, intent: isThick ? 'thick_stairs' : 'staircase' }
        }
      }
    }

    // 4. Default: THE AGGRESSIVE / TACTICAL STATE
    this.mood = 'aggressive'
    return this.evaluateTacticalMove(ai, p1, grid, config)
  }

  private evaluateTacticalMove(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    config: AILevelConfig,
  ): MoveProposal {
    const safeDirections = SurvivalEngine.getSafeDirections(ai, grid)
    let chosenDir = ai.dir
    let intent: AIIntent = 'chase'

    if (config.level === 4) {
      // Level 4: Voronoi Territory Control
      chosenDir = this.evaluateVoronoiMove(ai, p1, grid, safeDirections)
      intent = 'voronoi'
    } else if (config.level === 5) {
      // Level 5: Assassin Obsessive Tailing & Cutoff
      chosenDir = this.evaluateAssassinTailingMove(ai, p1, grid, safeDirections)
      intent = 'chase'
    } else if (config.level >= 6) {
      // Level 6: Minimax & Predictive Corridor Constriction
      chosenDir = this.evaluateMinimaxMove(ai, p1, grid, safeDirections, config.lookaheadSteps)
      intent = 'chase'
    } else if (config.level === 3) {
      // Level 3: Hunter aggressive pursuit
      chosenDir = this.evaluateHunterMove(ai, p1, grid, safeDirections)
      intent = 'chase'
    } else {
      // Level 1 & 2: Simple lookahead / space filling
      chosenDir = this.evaluateSimpleMove(ai, grid, safeDirections)
      intent = 'wander'
    }

    const wantsTurbo = this.evaluateTurboIntent(ai, p1, grid, config)

    return {
      desiredDir: chosenDir,
      wantsTurbo,
      intent,
    }
  }

  private evaluateVoronoiMove(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    safeDirs: readonly Direction[],
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

      const territory = grid.voronoiTerritory(p1.col, p1.row, nextCol, nextRow, 500)
      const chamber = grid.floodFillArea(nextCol, nextRow, 400)
      if (chamber < 30) continue

      const score = territory.aiArea * 2.2 - territory.p1Area * 0.9 + (dir === ai.dir ? 15 : 0)
      if (score > bestScore) {
        bestScore = score
        bestDir = dir
      }
    }

    return bestDir
  }

  private evaluateMinimaxMove(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    safeDirs: readonly Direction[],
    depth: number,
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

      const territory = grid.voronoiTerritory(p1.col, p1.row, nextCol, nextRow, depth * 35)
      const chamber = grid.floodFillArea(nextCol, nextRow, 600)
      if (chamber < 35) continue

      const p1Vec = DIRECTION_VECTORS[p1.dir]
      const p1LeadCol = p1.col + p1Vec.x * 5
      const p1LeadRow = p1.row + p1Vec.y * 5
      const distToFlank = Math.hypot(nextCol - p1LeadCol, nextRow - p1LeadRow)

      const flankScore = distToFlank < 14 ? 40 : 0
      const score = territory.aiArea * 2.5 - territory.p1Area * 1.0 + flankScore + (dir === ai.dir ? 20 : 0)

      if (score > bestScore) {
        bestScore = score
        bestDir = dir
      }
    }

    return bestDir
  }

  private evaluateAssassinTailingMove(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    safeDirs: readonly Direction[],
  ): Direction {
    let bestDir = safeDirs[0] ?? ai.dir
    let bestScore = -Infinity

    const curVec = DIRECTION_VECTORS[ai.dir]
    const destCol = ai.col + curVec.x
    const destRow = ai.row + curVec.y

    const p1Vec = DIRECTION_VECTORS[p1.dir]
    const p1LeadCol = p1.col + p1Vec.x * 4
    const p1LeadRow = p1.row + p1Vec.y * 4

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = destCol + vec.x
      const nextRow = destRow + vec.y

      const chamber = grid.floodFillArea(nextCol, nextRow, 600)
      if (chamber < 30) continue

      // Tailing distance to player's current tail/position
      const distToPlayer = Math.hypot(nextCol - p1.col, nextRow - p1.row)
      // Cutoff distance to player's projected head
      const distToLead = Math.hypot(nextCol - p1LeadCol, nextRow - p1LeadRow)

      const territory = grid.voronoiTerritory(p1.col, p1.row, nextCol, nextRow, 400)

      // Assassin prime directive: tail and cut off player relentlessly
      const score =
        territory.aiArea * 1.8 -
        territory.p1Area * 0.8 -
        distToPlayer * 4.0 -
        distToLead * 3.0 +
        (dir === ai.dir ? 12 : 0)

      if (score > bestScore) {
        bestScore = score
        bestDir = dir
      }
    }

    return bestDir
  }

  private evaluateHunterMove(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    safeDirs: readonly Direction[],
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
      const chamber = grid.floodFillArea(nextCol, nextRow, 600)
      if (chamber < 35) continue

      const p1Vec = DIRECTION_VECTORS[p1.dir]
      const p1FutureCol = p1.col + p1Vec.x * 4
      const p1FutureRow = p1.row + p1Vec.y * 4
      const dist = Math.hypot(nextCol - p1FutureCol, nextRow - p1FutureRow)

      // Emphasize spacious survival volume while aggressively cutting towards player's future position
      const score = chamber * 2.8 - dist * 2.2 + (dir === ai.dir ? 15 : 0)
      if (score > bestScore) {
        bestScore = score
        bestDir = dir
      }
    }

    return bestDir
  }

  private evaluateSimpleMove(
    ai: CycleState,
    grid: OccupancyGrid,
    safeDirs: readonly Direction[],
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
      const chamber = grid.floodFillArea(nextCol, nextRow, 300)
      // Momentum bonus to avoid erratic zigzagging into own trail
      const score = chamber + (dir === ai.dir ? 30 : 0)
      if (score > bestScore) {
        bestScore = score
        bestDir = dir
      }
    }

    return bestDir
  }

  private evaluateTurboIntent(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    config: AILevelConfig,
  ): boolean {
    if (!config.offensiveTurbo || ai.isTurbo || ai.turboCooldown > 0) return false
    if (!config.infiniteTurbos && ai.turbosLeft <= 0) return false

    // Level 5 Assassin Turbo Directive (6 Turbos total):
    // 1. React immediately when player boosts (counter-boost consuming 1 turbo)!
    // 2. 40% chance every 8s specifically to close off the player
    // 3. Pinch escape
    if (config.level === 5) {
      if (p1.isTurbo) return true

      if (this.level5TurboWantsTrigger) {
        this.level5TurboWantsTrigger = false
        const runway = SurvivalEngine.getClearRunway(ai.col, ai.row, ai.dir, grid)
        if (runway >= 4) return true
      }

      if (this.isEscapeNeeded(ai, grid)) return true

      return false
    }

    const dist = Math.hypot(ai.col - p1.col, ai.row - p1.row)

    // Essential defensive/offensive moves (Level 4, 6)
    if (this.isEscapeNeeded(ai, grid)) return true // Escape pinch
    if (this.isOvertakePossible(ai, p1)) return true // Overtake cutoff

    // Level 6 Master Core tactics
    if (config.level >= 6) {
      if (p1.isTurbo && dist < 35) return true // Counter-turbo
      if (this.isCorridorClosing(p1, grid, dist)) return true // Box closure
      if (dist > 20 && dist < 45 && SurvivalEngine.getClearRunway(ai.col, ai.row, ai.dir, grid) > 16) return true // Speedrun straightaway
    }

    return false
  }

  /**
   * Returns whichever of leftDir/rightDir takes a step closer to the target cycle.
   * Used by Level 4 to steer staircase macro turns toward the player.
   */
  private pickDirTowardTarget(
    ai: CycleState,
    target: CycleState,
    leftDir: Direction,
    rightDir: Direction,
  ): Direction {
    const leftVec = DIRECTION_VECTORS[leftDir]
    const rightVec = DIRECTION_VECTORS[rightDir]
    const distLeft = Math.hypot(ai.col + leftVec.x - target.col, ai.row + leftVec.y - target.row)
    const distRight = Math.hypot(ai.col + rightVec.x - target.col, ai.row + rightVec.y - target.row)
    return distLeft <= distRight ? leftDir : rightDir
  }

  private isOvertakePossible(ai: CycleState, p1: CycleState): boolean {
    const aiVec = DIRECTION_VECTORS[ai.dir]
    const p1Vec = DIRECTION_VECTORS[p1.dir]
    const isPerp = Math.abs(aiVec.x * p1Vec.x + aiVec.y * p1Vec.y) === 0
    if (isPerp) {
      const dist = Math.hypot(p1.col - ai.col, p1.row - ai.row)
      return dist > 6 && dist < 22
    }
    return false
  }

  private isCorridorClosing(p1: CycleState, grid: OccupancyGrid, dist: number): boolean {
    const p1Chamber = grid.floodFillArea(p1.col, p1.row, 120)
    return p1Chamber < 70 && dist < 18
  }

  private isEscapeNeeded(ai: CycleState, grid: OccupancyGrid): boolean {
    const chamber = grid.floodFillArea(ai.col, ai.row, 90)
    return chamber < 40
  }
}

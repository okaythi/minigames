import { AI_CONFIGS } from '../config'
import { DIRECTION_VECTORS } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { AILevelConfig, CycleState, DifficultyLevel, Direction } from '../types'
import { AIPatterns, createInitialPatternState, type PatternState } from './patterns'
import { SurvivalEngine } from './survival-engine'
import { TurboBrain } from './turbo'
import type { AIIntent, MoveProposal } from './types'

export type AIMood = 'aggressive' | 'having_fun' | 'passing_time'

export class PersonalityEngine {
  private mood: AIMood = 'aggressive'
  private patternState: PatternState = createInitialPatternState()
  private playerDoomed = false
  private diagnosisTimer = 0
  private funCooldownTimer = 0
  private elapsedTime = 0
  public readonly turboBrain: TurboBrain

  public constructor(private readonly level: DifficultyLevel) {
    this.turboBrain = new TurboBrain(AI_CONFIGS[level].turboConfig)
  }

  public get currentMood(): AIMood {
    return this.mood
  }

  public get isPlayerDoomed(): boolean {
    return this.playerDoomed
  }

  public abortPattern(): void {
    AIPatterns.resetStaircase(this.patternState)
    this.patternState.activePattern = 'none'
    this.funCooldownTimer = 1.5
    this.mood = 'aggressive'
  }

  public proposeMove(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    dt: number,
  ): MoveProposal {
    const config = AI_CONFIGS[this.level]
    this.elapsedTime += dt
    this.turboBrain.update(p1, ai, dt)

    // 1. Periodically diagnose whether the player is doomed (Level 3 onwards)
    if (config.level >= 3) {
      this.diagnosisTimer += dt
      if (this.diagnosisTimer > 0.12) {
        this.diagnosisTimer = 0
        const diagnosis = SurvivalEngine.diagnosePlayer(p1, ai, grid)
        this.playerDoomed = diagnosis.playerDoomed
      }
    }

    if (this.funCooldownTimer > 0) {
      this.funCooldownTimer -= dt
    }

    const distToPlayer = Math.hypot(ai.col - p1.col, ai.row - p1.row)

    // 2. Personality State Machine: Passing Time (Level 6 AI passes time if player is doomed)
    if (this.playerDoomed && config.level >= 6) {
      this.mood = 'passing_time'
      if (!AIPatterns.isMacroActive(this.patternState)) {
        this.patternState.activePattern = 'staircase'
        AIPatterns.initStaircase(ai, this.patternState, 20, true)
      }

      const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, true)
      return { desiredDir: dir, wantsTurbo: false, intent: 'thick_stairs' }
    }

    // 3. Ongoing Active Macro Commitment (Levels 1-4 only)
    if (AIPatterns.isStaircaseActive(this.patternState)) {
      const isThick = this.patternState.isThick
      const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, isThick)

      if (!AIPatterns.isStaircaseActive(this.patternState)) {
        this.funCooldownTimer = 2.0
        this.mood = 'aggressive'
        return this.evaluateTacticalMove(ai, p1, grid, config)
      }

      this.mood = 'having_fun'
      const wantsTurbo = this.turboBrain.evaluateIntent(ai, p1, grid)

      return {
        desiredDir: dir,
        wantsTurbo,
        intent: isThick ? 'thick_stairs' : 'staircase',
      }
    }

    // 4. "HAVING FUN" / APPROACH STATE: Only for lower levels (Levels 1-3).
    // Levels 5 and 6 are strictly tactical predators that never waste time on decorative stairs.
    if (config.level < 4 && config.enjoysStairs && this.funCooldownTimer <= 0 && !AIPatterns.isMacroActive(this.patternState)) {
      if (config.level === 3) {
        if (distToPlayer > 8) {
          const aiChamber = grid.floodFillArea(ai.col, ai.row, 1200)
          if (aiChamber > 320 && Math.random() < config.stairProbability) {
            this.mood = 'having_fun'
            const steps = Math.min(32, Math.max(10, Math.floor(Math.sqrt(aiChamber) * 0.8)))
            const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, false, undefined, steps)
            if (AIPatterns.isStaircaseActive(this.patternState)) {
              return { desiredDir: dir, wantsTurbo: false, intent: 'staircase' }
            }
          }
        }
      } else if (distToPlayer > 24) {
        const aiChamber = grid.floodFillArea(ai.col, ai.row, 1200)
        if (aiChamber > 700 && Math.random() < config.stairProbability) {
          this.mood = 'having_fun'
          const isThick = Math.random() < 0.35
          const steps = Math.min(40, Math.max(10, Math.floor(Math.sqrt(aiChamber) * 0.7)))
          const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, isThick, undefined, steps)
          if (AIPatterns.isStaircaseActive(this.patternState)) {
            return { desiredDir: dir, wantsTurbo: false, intent: isThick ? 'thick_stairs' : 'staircase' }
          }
        }
      }
    }

    // 5. Default: THE AGGRESSIVE / TACTICAL STATE
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
      // Level 6: Master Core Territory Domination & Lead Intercept
      chosenDir = this.evaluateMasterCoreMove(ai, p1, grid, safeDirections)
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

    const wantsTurbo = this.turboBrain.evaluateIntent(ai, p1, grid)

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

  private evaluateMasterCoreMove(
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
    const p1LeadCol = Math.max(1, Math.min(grid.cols - 2, p1.col + p1Vec.x * 5))
    const p1LeadRow = Math.max(1, Math.min(grid.rows - 2, p1.row + p1Vec.y * 5))

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = destCol + vec.x
      const nextRow = destRow + vec.y

      const territory = grid.voronoiTerritory(p1.col, p1.row, nextCol, nextRow, 600)
      const distToLead = Math.hypot(nextCol - p1LeadCol, nextRow - p1LeadRow)
      const distToPlayer = Math.hypot(nextCol - p1.col, nextRow - p1.row)

      const cutoffBonus = distToLead < 14 ? (14 - distToLead) * 6.0 : 0
      const momentumBonus = dir === ai.dir ? 25 : 0

      // Master Core: supreme territory dominance + trajectory intercept + smooth momentum
      const score =
        territory.aiArea * 3.2 -
        territory.p1Area * 1.8 -
        distToLead * 2.2 -
        distToPlayer * 0.4 +
        cutoffBonus +
        momentumBonus

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
    const p1FutureCol = p1.col + p1Vec.x * 4
    const p1FutureRow = p1.row + p1Vec.y * 4

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = destCol + vec.x
      const nextRow = destRow + vec.y

      const territory = grid.voronoiTerritory(p1.col, p1.row, nextCol, nextRow, 500)
      const distToIntercept = Math.hypot(nextCol - p1FutureCol, nextRow - p1FutureRow)
      
      const alignmentScore = (vec.x === p1Vec.x && vec.y === p1Vec.y) ? 20 : 0
      
      let behindScore = 0
      if (p1Vec.x !== 0) {
         if (nextRow === p1.row && Math.sign(p1.col - nextCol) === Math.sign(p1Vec.x)) {
            behindScore = 40
         }
      } else {
         if (nextCol === p1.col && Math.sign(p1.row - nextRow) === Math.sign(p1Vec.y)) {
            behindScore = 40
         }
      }

      // Assassin: Relentless tailing and future-intercept.
      // Again, zero chamber scoring because SurvivalEngine already vetoed suicidal moves.
      const score =
        territory.aiArea * 2.5 -
        territory.p1Area * 1.5 -
        distToIntercept * 3.0 +
        alignmentScore +
        behindScore +
        (dir === ai.dir ? 15 : 0)

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
}

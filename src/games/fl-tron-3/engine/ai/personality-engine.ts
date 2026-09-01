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
        const dir = AIPatterns.generateStaircaseStep(ai, this.patternState, true)
        return { desiredDir: dir, wantsTurbo: false, intent: 'thick_stairs' }
      }
    }

    // 3. Check THE "HAVING FUN" STATE: Trigger staircase when space is massive (> 40% grid) and player is far
    if (config.enjoysStairs && this.funCooldownTimer <= 0 && distToPlayer > 26) {
      const aiChamber = grid.floodFillArea(ai.col, ai.row, 1200)
      const isMassiveSpace = aiChamber > 900 // huge open space

      if (isMassiveSpace && Math.random() < config.stairProbability) {
        this.mood = 'having_fun'
        const isThick = Math.random() < 0.4
        const dir = AIPatterns.generateStaircaseStep(ai, this.patternState, isThick)
        const wantsTurbo = config.level >= 5 && Math.random() < 0.25 // capable of stair-stepping at turbo speed!
        return {
          desiredDir: dir,
          wantsTurbo,
          intent: isThick ? 'thick_stairs' : 'staircase',
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
    } else if (config.level >= 5) {
      // Level 5 & 6: Minimax & Predictive Corridor Constriction
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

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = ai.col + vec.x
      const nextRow = ai.row + vec.y

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

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = ai.col + vec.x
      const nextRow = ai.row + vec.y

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

  private evaluateHunterMove(
    ai: CycleState,
    p1: CycleState,
    grid: OccupancyGrid,
    safeDirs: readonly Direction[],
  ): Direction {
    let bestDir = safeDirs[0] ?? ai.dir
    let bestScore = -Infinity

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = ai.col + vec.x
      const nextRow = ai.row + vec.y
      const chamber = grid.floodFillArea(nextCol, nextRow, 600)
      if (chamber < 30) continue

      const p1Vec = DIRECTION_VECTORS[p1.dir]
      const p1FutureCol = p1.col + p1Vec.x * 4
      const p1FutureRow = p1.row + p1Vec.y * 4
      const dist = Math.hypot(nextCol - p1FutureCol, nextRow - p1FutureRow)

      const score = chamber * 1.5 - dist * 3.0
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

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = ai.col + vec.x
      const nextRow = ai.row + vec.y
      const chamber = grid.floodFillArea(nextCol, nextRow, 300)
      if (chamber > bestScore) {
        bestScore = chamber
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

    const dist = Math.hypot(ai.col - p1.col, ai.row - p1.row)

    // 10+ Tactical Turbo Decision Calculations (Level 5 & 6)
    if (p1.isTurbo && dist < 35) return true // Counter-turbo
    if (this.isOvertakePossible(ai, p1)) return true // Overtake cutoff
    if (this.isCorridorClosing(p1, grid, dist)) return true // Box closure
    if (this.isEscapeNeeded(ai, grid)) return true // Escape pinch
    if (dist > 20 && dist < 45 && SurvivalEngine.getClearRunway(ai.col, ai.row, ai.dir, grid) > 16) return true // Speedrun straightaway

    return false
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

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
  private elapsedTime = 0
  private turboHistory: number[] = []
  private wasTurboLastFrame = false

  public constructor(private readonly level: DifficultyLevel) {}

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

    if (ai.isTurbo && !this.wasTurboLastFrame) {
      this.turboHistory.push(this.elapsedTime)
    }
    this.wasTurboLastFrame = ai.isTurbo

    // Filter out turbos older than 7.2s
    this.turboHistory = this.turboHistory.filter(t => this.elapsedTime - t <= 7.2)

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

    // 2. Personality State Machine: Passing Time (Level 6 AI passes time if player is doomed)
    if (this.playerDoomed && config.level >= 6) {
      this.mood = 'passing_time'
      if (!AIPatterns.isMacroActive(this.patternState)) {
        const useLawnmower = Math.random() < 0.65
        this.patternState.activePattern = useLawnmower ? 'lawnmower' : 'staircase'
        if (!useLawnmower) {
          AIPatterns.initStaircase(ai, this.patternState, 30, true)
        }
      }

      if (this.patternState.activePattern === 'lawnmower') {
        const dir = AIPatterns.generateLawnmowerMove(ai, grid, this.patternState)
        return { desiredDir: dir, wantsTurbo: false, intent: 'lawnmower' }
      } else {
        const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, true)
        return { desiredDir: dir, wantsTurbo: false, intent: 'thick_stairs' }
      }
    }

    // 3. Ongoing Active Macro Commitment
    // If a staircase macro is currently executing, commit to continuing it step-by-step!
    if (AIPatterns.isStaircaseActive(this.patternState)) {
      const isThick = this.patternState.isThick
      const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, isThick)

      if (!AIPatterns.isStaircaseActive(this.patternState)) {
        // Staircase finished or aborted safely
        this.funCooldownTimer = 2.0
        this.mood = 'aggressive'
        return this.evaluateTacticalMove(ai, p1, grid, config)
      }

      this.mood = 'having_fun'
      const isApproach = config.level === 4 && distToPlayer < 38 && distToPlayer > 8
      const wantsTurbo =
        isApproach &&
        !ai.isTurbo &&
        ai.turboCooldown === 0 &&
        ai.turbosLeft > 1 &&
        Math.random() < 0.2

      return {
        desiredDir: dir,
        wantsTurbo,
        intent: isThick ? 'thick_stairs' : 'staircase',
      }
    }

    // 4. "HAVING FUN" / APPROACH STATE: Initiate new staircase if conditions are met
    // (Level 5 is excluded: prime directive is relentless tailing)
    if (config.enjoysStairs && this.funCooldownTimer <= 0 && !AIPatterns.isMacroActive(this.patternState)) {
      if (config.level === 3) {
        // Level 3 LOVES stairs in open space: always machine-precise 1-cell step.
        // Glued-staircase technique automatically mirrors on the adjacent edge.
        // Needs adequate open chamber (> 320 cells) and safe distance.
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
      } else if (config.level === 4) {
        // Level 4: Stairs aimed toward the player as an approach shortcut or intercept.
        // Deterministic decision: diagonal route cuts towards player position (never more than 60 steps)
        if (distToPlayer > 12) {
          const aiChamber = grid.floodFillArea(ai.col, ai.row, 1200)
          if (aiChamber > 400 && Math.random() < config.stairProbability) {
            const { leftDir, rightDir } = AIPatterns.getOrthogonalDirections(ai.dir)
            const preferredDir = this.pickDirTowardTarget(ai, p1, leftDir, rightDir)
            const manhattanDist = Math.abs(ai.col - p1.col) + Math.abs(ai.row - p1.row)
            const steps = Math.min(60, Math.max(8, manhattanDist))

            this.mood = 'having_fun'
            const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, false, preferredDir, steps)
            if (AIPatterns.isStaircaseActive(this.patternState)) {
              const isApproach = distToPlayer < 38
              const wantsTurbo =
                isApproach &&
                !ai.isTurbo &&
                ai.turboCooldown === 0 &&
                ai.turbosLeft > 1 &&
                Math.random() < 0.25
              return { desiredDir: dir, wantsTurbo, intent: 'staircase' }
            }
          }
        }
      } else if (config.level !== 5 && distToPlayer > 24) {
        // Levels 1, 2, 6: original broad-space staircase logic
        const aiChamber = grid.floodFillArea(ai.col, ai.row, 1200)
        if (aiChamber > 700 && Math.random() < config.stairProbability) {
          this.mood = 'having_fun'
          const isThick = Math.random() < 0.35
          const steps = Math.min(40, Math.max(10, Math.floor(Math.sqrt(aiChamber) * 0.7)))
          const dir = AIPatterns.generateStaircaseStep(ai, grid, this.patternState, isThick, undefined, steps)
          if (AIPatterns.isStaircaseActive(this.patternState)) {
            const wantsTurbo = config.level >= 6 && Math.random() < 0.25
            return { desiredDir: dir, wantsTurbo, intent: isThick ? 'thick_stairs' : 'staircase' }
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

    for (const dir of safeDirs) {
      const vec = DIRECTION_VECTORS[dir]
      const nextCol = destCol + vec.x
      const nextRow = destRow + vec.y

      const chamber = grid.floodFillArea(nextCol, nextRow, 600)
      if (chamber < 30) continue

      const distToPlayer = Math.hypot(nextCol - p1.col, nextRow - p1.row)
      
      const alignmentScore = (vec.x === p1Vec.x && vec.y === p1Vec.y) ? 20 : 0
      
      let behindScore = 0
      if (p1Vec.x !== 0) {
         if (nextRow === p1.row && Math.sign(p1.col - nextCol) === Math.sign(p1Vec.x)) {
            behindScore = 30
         }
      } else {
         if (nextCol === p1.col && Math.sign(p1.row - nextRow) === Math.sign(p1Vec.y)) {
            behindScore = 30
         }
      }

      const territory = grid.voronoiTerritory(p1.col, p1.row, nextCol, nextRow, 400)

      // Assassin prime directive: tail and cut off player relentlessly
      const score =
        territory.aiArea * 1.5 -
        distToPlayer * 5.0 +
        alignmentScore +
        behindScore +
        (dir === ai.dir ? 10 : 0)

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

    if (this.turboHistory.length >= 3) return false // Rate limit

    if (config.level === 5) {
      if (p1.isTurbo) return true

      if (this.level5TurboWantsTrigger) {
        if (this.isTacticalCutoff(ai, p1)) {
          this.level5TurboWantsTrigger = false
          return true
        }
      }

      if (this.isEscapeNeeded(ai, grid)) return true
      return false
    }

    const dist = Math.hypot(ai.col - p1.col, ai.row - p1.row)

    if (this.isEscapeNeeded(ai, grid)) return true 
    if (this.isTacticalCutoff(ai, p1)) return true

    if (config.level >= 6) {
      if (p1.isTurbo && dist < 35) return true
      if (this.isCorridorClosing(p1, grid, dist)) return true
      if (dist > 20 && dist < 45 && SurvivalEngine.getClearRunway(ai.col, ai.row, ai.dir, grid) > 16) return true
    }

    return false
  }

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

  private isTacticalCutoff(ai: CycleState, p1: CycleState): boolean {
    const aiVec = DIRECTION_VECTORS[ai.dir]
    const p1Vec = DIRECTION_VECTORS[p1.dir]
    
    const isPerp = Math.abs(aiVec.x * p1Vec.x + aiVec.y * p1Vec.y) === 0
    const dx = p1.col - ai.col
    const dy = p1.row - ai.row
    
    if (isPerp) {
      let aiDistToIntersect = 0
      let p1DistToIntersect = 0
      
      if (aiVec.x !== 0) {
        if (Math.sign(dx) === Math.sign(aiVec.x) && Math.sign(dy) === Math.sign(p1Vec.y)) {
           aiDistToIntersect = Math.abs(dx)
           p1DistToIntersect = Math.abs(dy)
        }
      } else {
        if (Math.sign(dy) === Math.sign(aiVec.y) && Math.sign(dx) === Math.sign(p1Vec.x)) {
           aiDistToIntersect = Math.abs(dy)
           p1DistToIntersect = Math.abs(dx)
        }
      }
      
      if (aiDistToIntersect > 0 && p1DistToIntersect > 0) {
         if (aiDistToIntersect > p1DistToIntersect && (aiDistToIntersect / 1.8) < p1DistToIntersect) return true
         if (aiDistToIntersect <= p1DistToIntersect && aiDistToIntersect > 3 && p1DistToIntersect < 20) return true
      }
    } else {
      const sameDir = aiVec.x === p1Vec.x && aiVec.y === p1Vec.y
      if (sameDir) {
         const isBehind = (aiVec.x !== 0 && Math.sign(dx) === Math.sign(aiVec.x)) || 
                          (aiVec.y !== 0 && Math.sign(dy) === Math.sign(aiVec.y))
         const dist = Math.abs(dx) + Math.abs(dy)
         if (isBehind && dist > 5 && dist < 25) return true
      }
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

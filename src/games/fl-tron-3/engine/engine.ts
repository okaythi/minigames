import type { Store } from '../../../lib/observable-store'
import type { GameRuntimeDeps } from '../../template/types'
import type { GameSnapshot } from '../../template/snapshot'
import { AI_CONFIGS, RULES } from './config'
import { createCycle, queueDirection, triggerCycleCrash, triggerCycleTurbo, updateCycleTimers, DIRECTION_VECTORS, OPPOSITE_DIRECTIONS } from './cycle'
import { OCCUPANCY, OccupancyGrid, type OccupancyType } from './grid'
import { AIController } from './ai'
import type { TronAudioEngine } from './audio/audio-engine'
import type { CycleState, DifficultyLevel, Particle, TronState } from './types'
import { createInitialTronState } from '../state'
import { toGameSnapshot } from '../view-model'
import type { TronAchievementTracker } from '../achievement-tracker'

export class TronEngine {
  public state: TronState
  public grid: OccupancyGrid
  private aiController: AIController
  private accumulator = 0
  private isPaused = false
  public isStarted = false
  private achievements: TronAchievementTracker | null
  private roundElapsedSeconds = 0
  private lastP1TurnTime = 0
  private lastP1TurboTime = 0
  private aiCrashedIntoP1Trail = false

  public constructor(
    public readonly deps: { readonly current: GameRuntimeDeps },
    private readonly store: Store<GameSnapshot>,
    private readonly audio: TronAudioEngine,
    achievements: TronAchievementTracker | null = null,
  ) {
    this.achievements = achievements
    this.state = createInitialTronState(1, 'campaign')
    this.grid = new OccupancyGrid()
    this.aiController = new AIController(1)
    this.publish()
  }

  public publish(): void {
    this.store.set(toGameSnapshot(this.state, this.deps.current.best, this.audio.isMuted, this.isStarted))
  }

  public start(): void {
    this.isStarted = true
    if (this.state.phase === 'menu') {
      this.startCampaign()
    } else if (this.state.phase === 'intermission') {
      this.advanceFromIntermission()
    } else if (this.state.phase === 'game_over' || this.state.phase === 'victory') {
      this.restart()
    }
  }

  public startCampaign(): void {
    this.isStarted = true
    this.audio.unlock()
    this.audio.play('ui')
    this.deps.current.beginRun()
    this.achievements?.onCampaignStart()
    this.state.level = 1
    this.state.p1RoundWins = 0
    this.state.aiRoundWins = 0
    this.state.roundNumber = 1
    this.state.elapsedRunSeconds = 0
    this.aiController = new AIController(1)
    this.setupRound()
  }

  public advanceFromIntermission(): void {
    if (this.state.level < RULES.totalLevels) {
      this.audio.unlock()
      this.audio.play('ui')
      this.state.level = (this.state.level + 1) as DifficultyLevel
      this.state.p1RoundWins = 0
      this.state.aiRoundWins = 0
      this.state.roundNumber = 1
      this.aiController = new AIController(this.state.level)
      this.setupRound()
    } else {
      this.state.phase = 'victory'
      const finalScore = Math.floor(1000000 - this.state.elapsedRunSeconds * 1000)
      this.deps.current.finishRun(finalScore)
      this.achievements?.onCampaignComplete(this.state.elapsedRunSeconds)
      this.publish()
    }
  }

  public restart(): void {
    this.audio.stopBikeHum()
    this.startCampaign()
  }

  public pause(): void {
    if (this.state.phase === 'playing' || this.state.phase === 'countdown') {
      this.isPaused = true
      this.audio.stopBikeHum()
    }
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false
      if (this.state.phase === 'playing') {
        this.audio.startBikeHum()
      }
    }
  }

  public toggleMute(): void {
    this.audio.toggleMuted()
    this.publish()
  }

  public dispose(): void {
    this.audio.stopBikeHum()
  }

  public handleInput(key: string, isDown: boolean): void {
    if (!isDown) return

    // Before clicking Start on the HTML overlay, ignore all key inputs
    if (!this.isStarted) {
      return
    }

    if (key === 'p' || key === 'P' || key === 'Escape') {
      if (this.isPaused) this.resume()
      else this.pause()
      return
    }

    if (key === 'm' || key === 'M') {
      this.toggleMute()
      return
    }

    if (this.state.phase === 'menu') {
      if (key === 'Enter' || key === ' ') {
        this.startCampaign()
      }
      return
    }

    if (this.state.phase === 'intermission') {
      if (key === 'Enter' || key === ' ') {
        this.advanceFromIntermission()
      }
      return
    }

    if (this.state.phase === 'victory' || this.state.phase === 'game_over') {
      if (key === 'Enter' || key === ' ') {
        this.restart()
      }
      return
    }

    if (this.state.phase === 'playing' && !this.isPaused) {
      if (key === 'ArrowUp' || key === 'w' || key === 'W') {
        queueDirection(this.state.p1, 'up')
        this.audio.play('turn')
      } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
        queueDirection(this.state.p1, 'down')
        this.audio.play('turn')
      } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        queueDirection(this.state.p1, 'left')
        this.audio.play('turn')
      } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        queueDirection(this.state.p1, 'right')
        this.audio.play('turn')
      } else if (key === ' ') {
        const boosted = triggerCycleTurbo(this.state.p1, false)
        if (boosted) {
          this.lastP1TurboTime = performance.now() / 1000
          this.audio.play('turbo')
          this.achievements?.onTurboActivated()
          this.publish()
        }
      }
    }
  }

  public update(rawDt: number): void {
    if (this.isPaused) return

    const effectiveDt = Math.min(Math.max(rawDt, 0), 0.05)

    this.updateParticles(effectiveDt)

    if (!this.isStarted) {
      this.publish()
      return
    }

    updateCycleTimers(this.state.p1, effectiveDt)
    updateCycleTimers(this.state.ai, effectiveDt)

    if (this.state.phase === 'countdown') {
      this.updateCountdown(effectiveDt)
    } else if (this.state.phase === 'playing') {
      this.updatePlaying(effectiveDt)
    } else if (this.state.phase === 'round_over') {
      this.updateRoundOver(effectiveDt)
    }

    this.publish()
  }

  private setupRound(): void {
    this.roundElapsedSeconds = 0
    this.lastP1TurboTime = 0
    this.aiCrashedIntoP1Trail = false
    this.achievements?.onRoundStart(this.state.level)
    this.grid.reset()
    const p1Col = 20
    const p1Row = 75
    const aiCol = 60
    const aiRow = 30

    const aiConfig = AI_CONFIGS[this.state.level]
    this.state.p1 = createCycle('p1', p1Col, p1Row, 'up', RULES.playerTurbosPerRound)
    this.state.ai = createCycle('ai', aiCol, aiRow, 'down', aiConfig.maxTurbos)

    this.grid.set(p1Col, p1Row, OCCUPANCY.p1Trail)
    this.grid.set(aiCol, aiRow, OCCUPANCY.aiTrail)

    this.state.phase = 'countdown'
    this.state.countdownTimer = 2.4
    this.state.roundWinner = null
    this.state.bannerText = `ROUND ${this.state.roundNumber}`
    this.state.bannerSubtext = `First to 3 wins (Current: ${this.state.p1RoundWins} - ${this.state.aiRoundWins})`
    this.audio.stopBikeHum()
    this.audio.play('countdown')
    this.publish()
  }

  private updateCountdown(dt: number): void {
    const prevTimer = this.state.countdownTimer
    this.state.countdownTimer -= dt

    if (prevTimer > 1.6 && this.state.countdownTimer <= 1.6) {
      this.audio.play('countdown')
    } else if (prevTimer > 0.8 && this.state.countdownTimer <= 0.8) {
      this.audio.play('countdown')
    }

    if (this.state.countdownTimer <= 0) {
      this.state.phase = 'playing'
      this.state.bannerText = null
      this.state.bannerSubtext = null
      this.audio.startBikeHum()
    }
  }

  private updatePlaying(dt: number): void {
    this.state.elapsedRunSeconds += dt
    this.roundElapsedSeconds += dt

    // Update bike hum modulation based on turbo states
    const anyTurbo = this.state.p1.isTurbo || this.state.ai.isTurbo
    this.audio.updateBikeHumSpeed(anyTurbo)

    // Update AI Decisions
    this.aiController.update(dt, this.state.ai, this.state.p1, this.grid)

    // Step physics with fixed step accumulator
    const stepTime = 1 / 120
    this.accumulator += dt
    let steps = 0
    while (this.accumulator >= stepTime && steps < 8) {
      this.accumulator -= stepTime
      steps += 1
      this.stepPhysics(stepTime)
      if (this.state.phase !== 'playing') break
    }
    if (steps >= 8) {
      this.accumulator = 0
    }
  }

  private stepPhysics(dt: number): void {
    const now = performance.now() / 1000
    const p1Speed = RULES.baseCycleSpeed * (this.state.p1.isTurbo ? RULES.turboSpeedMultiplier : 1.0)
    const aiSpeed = RULES.baseCycleSpeed * (this.state.ai.isTurbo ? RULES.turboSpeedMultiplier : 1.0)

    let p1Crashed = this.advanceCycle(this.state.p1, p1Speed * dt, OCCUPANCY.p1Trail, now)
    let aiCrashed = this.advanceCycle(this.state.ai, aiSpeed * dt, OCCUPANCY.aiTrail, now)

    // Head-on collision check: if both cycles ended up in the same grid cell
    if (this.state.p1.col === this.state.ai.col && this.state.p1.row === this.state.ai.row) {
      p1Crashed = true
      aiCrashed = true
    }

    if (p1Crashed || aiCrashed) {
      this.handleRoundEnd(p1Crashed, aiCrashed)
    }
  }

  private advanceCycle(
    cycle: CycleState,
    dist: number,
    occupancyType: OccupancyType,
    now: number,
  ): boolean {
    if (!cycle.alive) return false

    const currentSeg = cycle.trail[cycle.trail.length - 1]
    let remainingDist = dist
    let safetySteps = 0

    while (remainingDist > 0.0001 && safetySteps++ < 16) {
      const vec = DIRECTION_VECTORS[cycle.dir]
      const targetCol = cycle.col + vec.x
      const targetRow = cycle.row + vec.y
      const targetCenter = OccupancyGrid.gridToWorld(targetCol, targetRow)

      // Distance from current position to target cell center along current movement axis
      const distToCenter = Math.abs(vec.x !== 0 ? targetCenter.x - cycle.x : targetCenter.y - cycle.y)

      if (remainingDist < distToCenter) {
        // Advance within current cell towards target center
        cycle.x += vec.x * remainingDist
        cycle.y += vec.y * remainingDist
        remainingDist = 0

        // Synchronize tip of active trail segment
        if (currentSeg && currentSeg.points.length > 0) {
          currentSeg.points[currentSeg.points.length - 1] = { x: cycle.x, y: cycle.y }
        }
      } else {
        // Cycle reaches the exact center of target cell!
        cycle.x = targetCenter.x
        cycle.y = targetCenter.y
        remainingDist -= distToCenter

        // Synchronize tip of active trail segment to target center
        if (currentSeg && currentSeg.points.length > 0) {
          currentSeg.points[currentSeg.points.length - 1] = { x: targetCenter.x, y: targetCenter.y }
        }

        // Collision Check upon entering target cell:
        if (!this.grid.isFree(targetCol, targetRow)) {
          cycle.col = targetCol
          cycle.row = targetRow
          if (cycle.id === 'ai') {
            const hitCell = this.grid.get(targetCol, targetRow)
            if (hitCell === OCCUPANCY.p1Trail) {
              this.aiCrashedIntoP1Trail = true
            }
          }
          return true // Collided with boundary, enemy trail, or own trail!
        }

        // Mark previous cell in occupancy grid as committed trail
        this.grid.set(cycle.col, cycle.row, occupancyType)
        cycle.col = targetCol
        cycle.row = targetRow

        // Check P1 perimeter touch
        if (cycle.id === 'p1') {
          if (cycle.col <= 1 || cycle.col >= this.grid.cols - 2 || cycle.row <= 1 || cycle.row >= this.grid.rows - 2) {
            this.achievements?.onPerimeterTouch()
          }
        }

        // One Turn Per Cell Entry:
        // Filter expired inputs first (TTL 1.2s)
        const validInputs = cycle.inputBuffer.filter((entry) => entry.expiresAt > now)
        let remainingBuffer = validInputs

        while (remainingBuffer.length > 0) {
          const first = remainingBuffer[0]
          remainingBuffer = remainingBuffer.slice(1)
          if (!first) continue

          const nextDir = first.dir
          if (nextDir === cycle.dir) {
            // Redundant direction, discard and continue checking
            continue
          }
          if (nextDir === OPPOSITE_DIRECTIONS[cycle.dir]) {
            // 180° reverse direction, invalid, discard
            continue
          }

          // Valid 90° turn found!
          cycle.dir = nextDir

          if (cycle.id === 'p1') {
            if (this.lastP1TurnTime > 0 && now - this.lastP1TurnTime <= 0.2) {
              this.achievements?.onHairpinDouble()
            }
            this.lastP1TurnTime = now
          }

          // Add a corner waypoint at exact grid cell center for seamless visual fill
          if (currentSeg) {
            currentSeg.points.push({ x: cycle.x, y: cycle.y })
          }

          // Stop: strictly ONE turn command executed per cell entered!
          break
        }

        cycle.inputBuffer = remainingBuffer
      }
    }

    return false
  }

  private handleRoundEnd(p1Crashed: boolean, aiCrashed: boolean): void {
    this.audio.stopBikeHum()
    this.audio.play('crash')

    let p1Shards: Particle[] = []
    let aiShards: Particle[] = []

    if (p1Crashed) p1Shards = triggerCycleCrash(this.state.p1, this.grid)
    if (aiCrashed) aiShards = triggerCycleCrash(this.state.ai, this.grid)

    this.state.particles.push(...p1Shards, ...aiShards)

    if (p1Crashed && aiCrashed) {
      this.state.roundWinner = 'tie'
      this.state.bannerText = 'DOUBLE CRASH · TIE'
      this.achievements?.onRoundLost()
    } else if (p1Crashed) {
      this.state.roundWinner = 'ai'
      this.state.aiRoundWins += 1
      this.state.bannerText = `${AI_CONFIGS[this.state.level].name.toUpperCase()} WINS ROUND`
      this.audio.play('round_loss')
      this.achievements?.onRoundLost()
    } else {
      this.state.roundWinner = 'p1'
      this.state.p1RoundWins += 1
      this.state.bannerText = 'PLAYER 1 WINS ROUND'
      this.audio.play('round_win')
      const now = performance.now() / 1000
      const p1Boosted = this.state.p1.isTurbo || (this.lastP1TurboTime > 0 && now - this.lastP1TurboTime <= 2.5)
      if (this.aiCrashedIntoP1Trail && p1Boosted) {
        this.achievements?.onTurboCut()
      }
      this.achievements?.onRoundWon(this.roundElapsedSeconds)
    }

    this.state.phase = 'round_over'
    this.state.phaseTimer = 2.0
    this.publish()
  }

  private updateRoundOver(dt: number): void {
    this.state.phaseTimer -= dt
    if (this.state.phaseTimer <= 0) {
      if (this.state.p1RoundWins >= RULES.roundsToWinLevel) {
        // Player won the level!
        this.achievements?.onLevelDefeated(this.state.level)
        if (this.state.level >= RULES.totalLevels) {
          this.state.phase = 'victory'
          this.audio.play('level_clear')
          const finalScore = Math.floor(1000000 - this.state.elapsedRunSeconds * 1000)
          this.deps.current.finishRun(finalScore)
          this.achievements?.onCampaignComplete(this.state.elapsedRunSeconds)
        } else {
          this.state.phase = 'intermission'
          this.audio.play('level_clear')
        }
      } else if (this.state.aiRoundWins >= RULES.roundsToWinLevel) {
        // AI won the match
        this.state.phase = 'game_over'
        this.deps.current.finishRun(this.state.level)
      } else {
        // Next round in the same level
        this.state.roundNumber += 1
        this.setupRound()
      }
    }
  }

  private updateParticles(dt: number): void {
    const updated: Particle[] = []
    for (const p of this.state.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life += dt
      p.alpha = Math.max(0, 1 - p.life / p.maxLife)
      if (p.rotation !== undefined && p.vRot !== undefined) {
        p.rotation += p.vRot * dt
      }
      if (p.life < p.maxLife) {
        updated.push(p)
      }
    }
    this.state.particles = updated
  }
}

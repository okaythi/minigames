import type { Store } from '../../../lib/observable-store'
import type { GameRuntimeDeps } from '../../template/types'
import type { GameSnapshot } from '../../template/snapshot'
import { AI_CONFIGS, FRAMERATE_CONFIG, RULES } from './config'
import { createCycle, queueDirection, triggerCycleCrash, triggerCycleTurbo, updateCycleTimers, DIRECTION_VECTORS } from './cycle'
import { OCCUPANCY, OccupancyGrid, type OccupancyType } from './grid'
import { AIController } from './ai'
import type { TronAudioEngine } from './audio/audio-engine'
import type { CycleState, DifficultyLevel, Particle, TronState } from './types'
import { createInitialTronState } from '../state'
import { toGameSnapshot } from '../view-model'

export class TronEngine {
  public state: TronState
  public grid: OccupancyGrid
  private aiController: AIController
  private accumulator = 0
  private isPaused = false

  public constructor(
    public readonly deps: { readonly current: GameRuntimeDeps },
    private readonly store: Store<GameSnapshot>,
    private readonly audio: TronAudioEngine,
  ) {
    this.state = createInitialTronState(1, 'campaign')
    this.grid = new OccupancyGrid()
    this.aiController = new AIController(1)
    this.publish()
  }

  public publish(): void {
    this.store.set(toGameSnapshot(this.state, this.deps.current.best, this.audio.isMuted))
  }

  public start(): void {
    if (this.state.phase === 'menu') {
      this.startCampaign()
    } else if (this.state.phase === 'intermission') {
      this.advanceFromIntermission()
    } else if (this.state.phase === 'game_over' || this.state.phase === 'victory') {
      this.restart()
    }
  }

  public startCampaign(): void {
    this.audio.unlock()
    this.audio.play('ui')
    this.deps.current.beginRun()
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
      this.deps.current.finishRun(this.state.level)
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
      if (key === 'ArrowUp') {
        queueDirection(this.state.p1, 'up')
        this.audio.play('turn')
      } else if (key === 'ArrowDown') {
        queueDirection(this.state.p1, 'down')
        this.audio.play('turn')
      } else if (key === 'ArrowLeft') {
        queueDirection(this.state.p1, 'left')
        this.audio.play('turn')
      } else if (key === 'ArrowRight') {
        queueDirection(this.state.p1, 'right')
        this.audio.play('turn')
      } else if (key === ' ') {
        const boosted = triggerCycleTurbo(this.state.p1, false)
        if (boosted) {
          this.audio.play('turbo')
          this.publish()
        }
      }
    }
  }

  public update(rawDt: number): void {
    if (this.isPaused) return

    // Screen max FPS / low FPS calibration:
    // If screen FPS <= 61 (dt >= ~0.0163), target 58.5 FPS simulation step
    let effectiveDt = rawDt
    if (rawDt >= 1 / FRAMERATE_CONFIG.lowFpsThreshold) {
      effectiveDt = 1 / FRAMERATE_CONFIG.lowFpsTarget
    }
    effectiveDt = Math.min(effectiveDt, FRAMERATE_CONFIG.maxDt)

    this.updateParticles(effectiveDt)
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

    // Update bike hum modulation based on turbo states
    const anyTurbo = this.state.p1.isTurbo || this.state.ai.isTurbo
    this.audio.updateBikeHumSpeed(anyTurbo)

    // Update AI Decisions
    this.aiController.update(dt, this.state.ai, this.state.p1, this.grid)

    // Step physics with fixed step accumulator
    const stepTime = 1 / 120
    this.accumulator += dt
    let steps = 0
    while (this.accumulator >= stepTime && steps < 5) {
      this.accumulator -= stepTime
      steps += 1
      this.stepPhysics(stepTime)
      if (this.state.phase !== 'playing') break
    }
  }

  private stepPhysics(dt: number): void {
    const p1Speed = RULES.baseCycleSpeed * (this.state.p1.isTurbo ? RULES.turboSpeedMultiplier : 1.0)
    const aiSpeed = RULES.baseCycleSpeed * (this.state.ai.isTurbo ? RULES.turboSpeedMultiplier : 1.0)

    const p1Crashed = this.advanceCycle(this.state.p1, p1Speed * dt, OCCUPANCY.p1Trail)
    const aiCrashed = this.advanceCycle(this.state.ai, aiSpeed * dt, OCCUPANCY.aiTrail)

    if (p1Crashed || aiCrashed) {
      this.handleRoundEnd(p1Crashed, aiCrashed)
    }
  }

  private advanceCycle(cycle: CycleState, dist: number, occupancyType: OccupancyType): boolean {
    if (!cycle.alive) return false

    // Consume input buffer on turn alignment
    if (cycle.inputBuffer.length > 0) {
      const nextDir = cycle.inputBuffer[0]
      if (nextDir) {
        cycle.dir = nextDir
        cycle.inputBuffer = cycle.inputBuffer.slice(1)
        cycle.trail.push({ x: cycle.x, y: cycle.y })
      }
    }

    const vec = DIRECTION_VECTORS[cycle.dir]
    cycle.x += vec.x * dist
    cycle.y += vec.y * dist

    // Keep tip of trail synchronized
    if (cycle.trail.length > 0) {
      cycle.trail[cycle.trail.length - 1] = { x: cycle.x, y: cycle.y }
    }

    const gridCoord = OccupancyGrid.worldToGrid(cycle.x, cycle.y)
    if (gridCoord.col !== cycle.col || gridCoord.row !== cycle.row) {
      // Check collision on entry into new grid cell
      if (!this.grid.isFree(gridCoord.col, gridCoord.row)) {
        return true // collision!
      }

      // Mark previous grid cell
      this.grid.set(cycle.col, cycle.row, occupancyType)
      cycle.col = gridCoord.col
      cycle.row = gridCoord.row
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
    } else if (p1Crashed) {
      this.state.roundWinner = 'ai'
      this.state.aiRoundWins += 1
      this.state.bannerText = `${AI_CONFIGS[this.state.level].name.toUpperCase()} WINS ROUND`
      this.audio.play('round_loss')
    } else {
      this.state.roundWinner = 'p1'
      this.state.p1RoundWins += 1
      this.state.bannerText = 'PLAYER 1 WINS ROUND'
      this.audio.play('round_win')
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
        if (this.state.level >= RULES.totalLevels) {
          this.state.phase = 'victory'
          this.audio.play('level_clear')
          this.deps.current.finishRun(this.state.level)
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

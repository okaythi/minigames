import { SurvivalEngine } from '../survival-engine'
import type { OccupancyGrid } from '../../grid'
import type { CycleState } from '../../types'
import { computeGeometricCutoffScore, computePinchEscapeScore, computeTerritoryGainScore } from './evaluators'
import { OnlinePlayerTracker } from './online-learner'
import type { TurboConfig } from './types'

export class TurboBrain {
  public readonly tracker = new OnlinePlayerTracker()
  private timeSinceLastTurbo = 999
  private level5CutoffTimer = 0
  private level5WantsTrigger = false

  public constructor(public readonly config: TurboConfig) {}

  public update(player: CycleState, ai: CycleState, dt: number): void {
    this.timeSinceLastTurbo += dt
    this.tracker.update(player, ai)

    if (this.config.alwaysCounterPlayerTurbo) {
      this.level5CutoffTimer += dt
      if (this.level5CutoffTimer >= 8.0) {
        this.level5CutoffTimer = 0
        if (Math.random() < 0.45) {
          this.level5WantsTrigger = true
        }
      }
    }
  }

  public evaluateIntent(ai: CycleState, player: CycleState, grid: OccupancyGrid): boolean {
    if (!this.config.enabled || ai.isTurbo || ai.turboCooldown > 0) {
      return false
    }
    if (!this.config.infiniteTurbos && ai.turbosLeft <= 0) {
      return false
    }
    if (this.timeSinceLastTurbo < this.config.minCooldownSeconds) {
      return false
    }

    const runway = SurvivalEngine.getClearRunway(ai.col, ai.row, ai.dir, grid)
    if (runway < 6) {
      return false
    }

    // 1. Level 5 Assassin Special: Instant Counter-Boost on Player Turbo (By Design)
    if (this.config.alwaysCounterPlayerTurbo && player.isTurbo) {
      this.timeSinceLastTurbo = 0
      return true
    }

    // 2. Level 5 Assassin 8s Cutoff Pulse
    if (this.level5WantsTrigger) {
      const cutoff = computeGeometricCutoffScore(ai, player, grid)
      if (cutoff > 40) {
        this.level5WantsTrigger = false
        this.timeSinceLastTurbo = 0
        return true
      }
    }

    // 3. Emergency Pinch Escape
    const escapeScore = computePinchEscapeScore(ai, grid)
    if (escapeScore > 75) {
      this.timeSinceLastTurbo = 0
      return true
    }

    // 4. Expected Value (EV) Decision Engine
    const cutoffScore = computeGeometricCutoffScore(ai, player, grid)
    const territoryScore = computeTerritoryGainScore(ai, player, grid, this.config.lookaheadSteps)

    const maxT = Math.max(1, this.config.maxTurbos)
    const scarcityPenalty = this.config.infiniteTurbos
      ? 0
      : this.config.scarcityWeight * Math.pow((maxT - ai.turbosLeft) / maxT, 2) * 25

    const totalScore =
      this.config.cutoffWeight * cutoffScore +
      this.config.territoryWeight * territoryScore -
      scarcityPenalty

    if (totalScore >= this.config.activationThreshold) {
      this.timeSinceLastTurbo = 0
      return true
    }

    return false
  }

  public reset(): void {
    this.timeSinceLastTurbo = 999
    this.level5CutoffTimer = 0
    this.level5WantsTrigger = false
    this.tracker.reset()
  }
}

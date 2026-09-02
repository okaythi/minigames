/**
 * Pong — in-session achievement tracker.
 *
 * Tracks match statistics and calls the achievement bus when thresholds are
 * crossed. No coupling to React, DOM, or the Pong engine internals.
 */

import type { AchievementBus } from '../../lib/achievement-bus'
import type { Difficulty, PowerupType } from './engine/types'

interface MatchStats {
  difficulty: Difficulty
  maxRally: number
  aiScore: number
  playerScore: number
  powerupsActivated: number
  /** Track per-type to detect Tactical Triad (3 distinct types). */
  uniquePowerupTypes: Set<PowerupType>
  /** Whether a magnet catch-and-release was converted to a point. */
  magnetTrapScored: boolean
  /** Track speed boost activation time for turbo smash. */
  speedBoostActivatedAt: number | null
  allSlotsUsed: boolean
}

export class PongAchievementTracker {
  private match: MatchStats = this.freshMatch('normal')

  constructor(private readonly bus: AchievementBus) {}

  private freshMatch(difficulty: Difficulty): MatchStats {
    return {
      difficulty,
      maxRally: 0,
      aiScore: 0,
      playerScore: 0,
      powerupsActivated: 0,
      uniquePowerupTypes: new Set(),
      magnetTrapScored: false,
      speedBoostActivatedAt: null,
      allSlotsUsed: false,
    }
  }

  onMatchStart(difficulty: Difficulty): void {
    this.match = this.freshMatch(difficulty)

    // Kinematic Anomaly: the player selected secret boss
    if (difficulty === 'very-hard') {
      this.bus.unlock('pong_kinematic_anomaly')
    }
  }

  /** Call this on every paddle hit (player OR ai, combined = rally). */
  onPaddleHit(currentRally: number): void {
    if (currentRally > this.match.maxRally) {
      this.match.maxRally = currentRally
    }

    if (currentRally >= 5) this.bus.unlock('pong_rally_opener', currentRally)
    if (currentRally >= 15) this.bus.unlock('pong_paddle_ace', currentRally)
    if (currentRally >= 50) this.bus.unlock('pong_kinetic_maestro', currentRally)
    if (currentRally >= 100) this.bus.unlock('pong_infinite_volley', currentRally)
  }

  onPlayerScores(now: number): void {
    this.match.playerScore += 1

    // Turbo Smash: scored within 1.0s of speed boost activation
    if (
      this.match.speedBoostActivatedAt !== null &&
      now - this.match.speedBoostActivatedAt <= 1.0
    ) {
      this.bus.unlock('pong_turbo_smash')
      this.match.speedBoostActivatedAt = null
    }

    // Magnetic Trap: flag if ball was released from magnet → player scored
    if (this.match.magnetTrapScored) {
      this.bus.unlock('pong_magnetic_trap')
      this.match.magnetTrapScored = false
    }
  }

  onAiScores(): void {
    this.match.aiScore += 1
    this.match.magnetTrapScored = false
    this.match.speedBoostActivatedAt = null
  }

  /** Call this when a powerup is activated by the player. */
  onPowerupActivated(type: PowerupType, now: number): void {
    this.match.powerupsActivated += 1
    this.match.uniquePowerupTypes.add(type)

    if (type === 'speed') {
      this.match.speedBoostActivatedAt = now
    }

    if (type === 'magnet') {
      // Flag that next player score was via magnet
      this.match.magnetTrapScored = true
    }

    // Tactical Triad: 3 distinct powerup types in one match
    if (this.match.uniquePowerupTypes.size >= 3) {
      this.bus.unlock('pong_tactical_triad', this.match.uniquePowerupTypes.size)
    }

    // Max Loadout: all 5 powerup slots activated
    if (this.match.powerupsActivated >= 5) {
      this.bus.unlock('pong_max_loadout', this.match.powerupsActivated)
    }
  }

  /** Call when the Glass Wall blocks a guaranteed AI goal. */
  onGlassWallSave(): void {
    this.bus.unlock('pong_glass_savior')
  }

  /** Call when a powerup is purchased in the loadout screen. */
  onPowerupPurchased(): void {
    this.bus.unlock('pong_loaded_paddle')
  }

  /**
   * Call on match end.
   * @param playerWon whether the player won
   * @param difficulty the match difficulty
   * @param playerScore final player score
   * @param aiScore final AI score
   */
  onMatchEnd(playerWon: boolean, difficulty: Difficulty, _playerScore: number, aiScore: number): void {
    if (!playerWon) return

    // Difficulty progression
    if (difficulty === 'easy') this.bus.unlock('pong_novice_shifter')
    if (difficulty === 'normal') this.bus.unlock('pong_calculated_return')
    if (difficulty === 'hard') this.bus.unlock('pong_precision_veteran')
    if (difficulty === 'very-hard') {
      this.bus.unlock('pong_grandmasters_end')
      // Algorithm Slayer is 'very-hard' win (our secret boss difficulty)
      this.bus.unlock('pong_algorithm_slayer')
    }

    // Shutouts
    const isShutout = aiScore === 0
    if (aiScore <= 2) this.bus.unlock('pong_solid_defense')
    if (isShutout) {
      this.bus.unlock('pong_total_shutout')
      const isHardOrAbove = difficulty === 'hard' || difficulty === 'very-hard'
      if (isHardOrAbove) {
        this.bus.unlock('pong_flawless_hard')
      }
    }
  }
}

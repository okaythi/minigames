/**
 * FL Tron 3.0 — in-session achievement tracker.
 *
 * Tracks campaign progression, turbo usage, round outcomes, and timing
 * events to unlock the 20 Tron achievements.
 */

import type { AchievementBus } from '../../lib/achievement-bus'
import type { DifficultyLevel } from './engine/types'
import { RULES } from './engine/config'

interface CampaignStats {
  /** Highest level defeated so far in this campaign run. */
  highestLevelDefeated: number
  /** Total turbo activations across the whole campaign. */
  totalTurboActivations: number
  /** Whether the player has EVER used a turbo (for pure_kinetic tracking). */
  anyTurboUsed: boolean
  /** Lives lost across the whole campaign. */
  livesLost: number
  /** Whether current campaign run has lost a life. */
  deathlessRun: boolean
}

interface RoundStats {
  /** When the round started (performance.now() / 1000). */
  startedAt: number
  /** How many turbos were used this round. */
  turbosUsed: number
  /** Was this round won with 0 lives lost? */
  playerTouchedPerimeter: boolean
  /** Level being played. */
  level: DifficultyLevel
}

interface LevelStats {
  /** Round wins for player. */
  playerRoundWins: number
  /** Round wins for AI. */
  aiRoundWins: number
  /** Level. */
  level: DifficultyLevel
}

export class TronAchievementTracker {
  private campaign: CampaignStats = this.freshCampaign()
  private round: RoundStats = this.freshRound(1)
  private level: LevelStats = this.freshLevel(1)

  constructor(private readonly bus: AchievementBus) {}

  private freshCampaign(): CampaignStats {
    return {
      highestLevelDefeated: 0,
      totalTurboActivations: 0,
      anyTurboUsed: false,
      livesLost: 0,
      deathlessRun: true,
    }
  }

  private freshRound(level: DifficultyLevel): RoundStats {
    return {
      startedAt: performance.now() / 1000,
      turbosUsed: 0,
      playerTouchedPerimeter: false,
      level,
    }
  }

  private freshLevel(level: DifficultyLevel): LevelStats {
    return { playerRoundWins: 0, aiRoundWins: 0, level }
  }

  onCampaignStart(): void {
    this.campaign = this.freshCampaign()
    this.round = this.freshRound(1)
    this.level = this.freshLevel(1)
  }

  onRoundStart(level: DifficultyLevel): void {
    this.round = this.freshRound(level)
    if (this.level.level !== level) {
      this.level = this.freshLevel(level)
    }
  }

  /** Call when the player activates turbo (Spacebar). */
  onTurboActivated(): void {
    this.campaign.anyTurboUsed = true
    this.campaign.totalTurboActivations += 1
    this.round.turbosUsed += 1

    // Nitro Ignition: first turbo activation ever
    this.bus.unlock('tron_nitro_ignition')
  }

  /**
   * Call when the player cuts across an AI trail while boosting.
   * This is detected in the engine when a turbo-active cycle moves past AI
   * occupied cells without collision (the player passed through a corridor
   * the AI just vacated).
   */
  onTurboCut(): void {
    this.bus.unlock('tron_turbo_cut')
  }

  /** Call when the player's cycle nears a perimeter wall hazard. */
  onPerimeterNearMiss(): void {
    // No achievement for this, but used for Dominant Round tracking
  }

  /** Call when the player touches or grazes a perimeter boundary. */
  onPerimeterTouch(): void {
    this.round.playerTouchedPerimeter = true
  }

  /**
   * Call when the player wins a round.
   * @param elapsedSeconds seconds since the round started
   */
  onRoundWon(elapsedSeconds: number): void {
    this.level.playerRoundWins += 1

    // Dominant Round: won without touching perimeter
    if (!this.round.playerTouchedPerimeter) {
      this.bus.unlock('tron_dominant_round')
    }

    // Triple Burner: used all 3 turbos in a winning round
    if (this.round.turbosUsed >= RULES.playerTurbosPerRound) {
      this.bus.unlock('tron_triple_burner')
    }

    // 3-0 Clean Sweep: won all 3 rounds in a level
    if (this.level.playerRoundWins >= RULES.roundsToWinLevel && this.level.aiRoundWins === 0) {
      this.bus.unlock('tron_clean_sweep')
    }

    // Time Trial achievements
    if (elapsedSeconds < 3.0) {
      this.bus.unlock('tron_three_second_flash')
      this.bus.unlock('tron_five_second_blitz') // implicitly < 5s too
    } else if (elapsedSeconds < 5.0) {
      this.bus.unlock('tron_five_second_blitz')
    }
  }

  /** Call when the AI wins a round. */
  onRoundLost(): void {
    this.level.aiRoundWins += 1
    this.campaign.livesLost += 1
    this.campaign.deathlessRun = false
  }

  /** Call when a level (3-round match) is defeated by the player. */
  onLevelDefeated(level: DifficultyLevel): void {
    this.campaign.highestLevelDefeated = Math.max(this.campaign.highestLevelDefeated, level)

    // Campaign stage achievements
    if (level >= 1) this.bus.unlock('tron_grid_initiate')
    if (level >= 3) this.bus.unlock('tron_vector_hunter')
    if (level >= 5) this.bus.unlock('tron_tactical_nemesis')
  }

  /**
   * Call when the full 6-level campaign is completed.
   * @param totalSeconds total elapsed campaign time in seconds
   */
  onCampaignComplete(totalSeconds: number): void {
    this.bus.unlock('tron_master_core_overload')

    // Pure Kinetic: completed without using turbo
    if (!this.campaign.anyTurboUsed) {
      this.bus.unlock('tron_pure_kinetic')
    }

    // Immortal Cycle: completed without losing a life
    if (this.campaign.deathlessRun) {
      this.bus.unlock('tron_immortal_cycle')
    }

    // Master Speedrunner: under 180 seconds (3 minutes)
    if (totalSeconds < 180) {
      this.bus.unlock('tron_master_speedrunner')
    }
  }

  /** Call when the player forms a closed light box (4-wall enclosure). */
  onClosedGrid(): void {
    this.bus.unlock('tron_closed_grid')
  }

  /** Call when the player spirals around the AI and forces a trail crash. */
  onIronCoil(): void {
    this.bus.unlock('tron_iron_coil')
  }

  /**
   * Call when the player traps the AI in less than 15% of arena space.
   * @param aiOccupancyPercent 0..100
   */
  onAiTrapped(aiOccupancyPercent: number): void {
    if (aiOccupancyPercent <= 15) {
      this.bus.unlock('tron_claustrophobia')
    }
  }

  /** Call when two consecutive 90° turns happen within 150ms. */
  onHairpinDouble(): void {
    this.bus.unlock('tron_hairpin_double')
  }

  /** Call when the player navigates through a 1-tile-wide corridor. */
  onRazorCorridor(): void {
    this.bus.unlock('tron_razor_corridor')
  }
}

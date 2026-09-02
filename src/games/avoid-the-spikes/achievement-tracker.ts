/**
 * Avoid the Spikes! — in-session achievement tracker.
 *
 * Tracks per-run and lifetime metrics then calls the achievement bus when
 * thresholds are crossed. Zero coupling to React or DOM.
 */

import type { AchievementBus } from '../../lib/achievement-bus'
import type { AvoidRunResult } from './state'
import { ARENA } from './engine/config'

interface PerRunStats {
  bounces: number
  candyCollected: number
  /** Last bounce timestamp for quick-turnaround detection. */
  lastBounceAt: number | null
  /** Count of bounces after movers spawned (score >= 10). */
  bouncesWithMoversActive: number
  moversSpawned: boolean
  /** Graze count this run (near-miss spike contacts that didn't kill). */
  grazeCount: number
  /** True once the pod is within 10px of ceiling teeth. */
  nearCeiling: boolean
  /** True once the pod is within 10px of floor teeth. */
  nearFloor: boolean
  startedAt: number
  /** How many flaps were used on the last wall-to-wall crossing. */
  flapsCurrentCrossing: number
  /** Whether the previous crossing used exactly 1 flap. */
  prevCrossingOneFlap: boolean
}

interface LifetimeStats {
  totalCandyAvoid: number
  totalGrazes: number
}

const MOVERS_SPAWN_SCORE = 10
const QUICK_TURNAROUND_SECONDS = 1.8
const NEAR_BOUNDARY_THRESHOLD = 10 // px
const CEILING_DEPTH = 20 // matches config.ts ARENA.ceilingDepth
const FLOOR_DEPTH = 24  // matches config.ts ARENA.floorDepth

export class AvoidAchievementTracker {
  private run: PerRunStats = this.freshRun()
  private lifetime: LifetimeStats = { totalCandyAvoid: 0, totalGrazes: 0 }

  constructor(private readonly bus: AchievementBus) {}

  private freshRun(): PerRunStats {
    return {
      bounces: 0,
      candyCollected: 0,
      lastBounceAt: null,
      bouncesWithMoversActive: 0,
      moversSpawned: false,
      grazeCount: 0,
      nearCeiling: false,
      nearFloor: false,
      startedAt: performance.now() / 1000,
      flapsCurrentCrossing: 0,
      prevCrossingOneFlap: false,
    }
  }

  /** Call this when a new run begins. */
  onRunStarted(): void {
    this.run = this.freshRun()
  }

  /**
   * Call this on every wall bounce.
   * @param score - current score (number of bounces so far, after this one)
   * @param moversLive - number of active floating movers
   * @param now - current time in seconds
   */
  onBounce(score: number, moversLive: number, now: number): void {
    this.run.bounces = score

    // Wall Bounce Milestones
    if (score >= 10) this.bus.unlock('avoid_wall_tapper', score)
    if (score >= 20) this.bus.unlock('avoid_wall_bouncer', score)
    if (score >= 50) this.bus.unlock('avoid_spike_hopper', score)
    if (score >= 100) this.bus.unlock('avoid_century_flyer', score)

    // Quick Turnaround: 2 bounces within 1.8s
    if (this.run.lastBounceAt !== null) {
      const delta = now - this.run.lastBounceAt
      if (delta <= QUICK_TURNAROUND_SECONDS) {
        this.bus.unlock('avoid_flap_quick_turnaround')
      }
    }
    this.run.lastBounceAt = now

    // Moving Teeth: survive past bounce 10 with movers spawned
    if (score >= MOVERS_SPAWN_SCORE && moversLive > 0) {
      this.run.moversSpawned = true
      this.bus.unlock('avoid_mover_moving_teeth')
    }

    // Chaos Navigator: bounce 30+ with movers active
    if (score >= 30 && this.run.moversSpawned) {
      this.bus.unlock('avoid_mover_chaos_navigator')
    }

    // One-Tap Transit: reset crossing flap counter
    if (this.run.prevCrossingOneFlap) {
      this.bus.unlock('avoid_flap_one_tap')
    }
    this.run.prevCrossingOneFlap = this.run.flapsCurrentCrossing === 1
    this.run.flapsCurrentCrossing = 0
  }

  /** Call this when the player flaps. */
  onFlap(): void {
    this.run.flapsCurrentCrossing += 1
  }

  /**
   * Call this when the player enters a near-miss SAT graze (alive after
   * touching a spike tip hitbox but the full intersection test passed).
   */
  onGraze(playerY: number): void {
    this.run.grazeCount += 1
    this.lifetime.totalGrazes += 1

    // Razor Graze
    this.bus.unlock('avoid_graze_razor')

    // Danger Dancer: 3 grazes in one run
    if (this.run.grazeCount >= 3) {
      this.bus.unlock('avoid_graze_danger_dancer', this.run.grazeCount)
    }

    // Needle Threader: 5 grazes in one run
    if (this.run.grazeCount >= 5) {
      this.bus.unlock('avoid_graze_needle_threader', this.run.grazeCount)
    }

    // Edge of Oblivion: graze near ceiling or floor hazard band
    const nearTop = playerY < CEILING_DEPTH + 25
    const nearBottom = playerY > ARENA.height - FLOOR_DEPTH - 25
    if (nearTop || nearBottom) {
      this.bus.unlock('avoid_edge_oblivion')
    }

    // Veteran Grazer: 25 lifetime grazes
    if (this.lifetime.totalGrazes >= 25) {
      this.bus.unlock('avoid_flap_veteran_grazer', this.lifetime.totalGrazes)
    } else {
      this.bus.progress('avoid_flap_veteran_grazer', this.lifetime.totalGrazes)
    }
  }

  /**
   * Call this every frame to check boundary proximity.
   * @param playerY - player center Y in world coordinates
   */
  onFrame(playerY: number): void {
    // Ceiling Skimmer: player within 10px of ceiling teeth (bottom edge)
    const ceilingBound = CEILING_DEPTH + NEAR_BOUNDARY_THRESHOLD
    if (!this.run.nearCeiling && playerY <= ceilingBound) {
      this.run.nearCeiling = true
      this.bus.unlock('avoid_edge_ceiling_skimmer')
    }

    // Floor Sweeper: player within 10px of floor teeth (top edge)
    const floorBound = ARENA.height - FLOOR_DEPTH - NEAR_BOUNDARY_THRESHOLD
    if (!this.run.nearFloor && playerY >= floorBound) {
      this.run.nearFloor = true
      this.bus.unlock('avoid_edge_floor_sweeper')
    }
  }

  /**
   * Call this when a candy is collected in-run.
   * @param runCandyTotal - total candy collected in this run so far
   * @param lifetimeAvoidCandy - all-time candy from Avoid the Spikes
   */
  onCandy(runCandyTotal: number, lifetimeAvoidCandy: number): void {
    this.run.candyCollected = runCandyTotal
    this.lifetime.totalCandyAvoid = lifetimeAvoidCandy

    // Per-run candy achievements
    if (runCandyTotal >= 5) this.bus.unlock('avoid_candy_snack', runCandyTotal)
    if (runCandyTotal >= 15) this.bus.unlock('avoid_candy_mid_air', runCandyTotal)
    if (runCandyTotal >= 30) this.bus.unlock('avoid_candy_sweet_flight', runCandyTotal)

    // Lifetime candy in Avoid the Spikes
    if (lifetimeAvoidCandy >= 500) {
      this.bus.unlock('avoid_candy_gem_swarm', lifetimeAvoidCandy)
    } else {
      this.bus.progress('avoid_candy_gem_swarm', lifetimeAvoidCandy)
    }
  }

  /** Call this when a mover pass is dodged. */
  onMoverDodge(dodgesThisRun: number): void {
    if (dodgesThisRun >= 10) {
      this.bus.unlock('avoid_mover_slalom_pilot', dodgesThisRun)
    } else {
      this.bus.progress('avoid_mover_slalom_pilot', dodgesThisRun)
    }
  }

  /** Call this when the run ends (death). */
  onRunFinished(_result: AvoidRunResult): void {
    // Nothing to do here presently; the per-event hooks above cover everything.
    // Future: could report aggregate progress to server here.
  }
}

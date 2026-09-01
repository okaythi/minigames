import { ARENA, CANDY } from './config'
import { takeSpikeId } from './spike-factory'
import { pointInCircle } from './collision'
import type { Random } from '../../../lib/random'
import type { Pickup, PickupKind, Vec2 } from './types'

/**
 * Candy and gems drop into the middle of the screen - the one place the player
 * has to pass through anyway - so picking them up is a routing decision, not a
 * freebie. Collected pieces are banked to localStorage by the game shell.
 */

const KINDS: readonly PickupKind[] = ['candy', 'gem'] as const

export class PickupField {
  private pickups: Pickup[] = []
  private timer: number = CANDY.firstDelay
  private elapsed = 0

  public list(): readonly Pickup[] {
    return this.pickups
  }

  public update(
    dt: number,
    playerPos: Vec2,
    random: Random,
    onCollect: (pickup: Pickup) => void,
  ): void {
    this.elapsed += dt
    this.timer -= dt
    if (this.timer <= 0) {
      this.trySpawn(playerPos, random)
      this.timer = random.range(CANDY.interval.min, CANDY.interval.max)
    }

    const survivors: Pickup[] = []
    for (const pickup of this.pickups) {
      pickup.life -= dt
      // The bob is simulation, not decoration: the hitbox moves with the art.
      pickup.pos.y = pickup.baseY + PickupField.bobAt(pickup, this.elapsed)
      if (pickup.life <= 0) {
        // Expired: dropped silently, no penalty.
        continue
      }
      if (pointInCircle(playerPos, pickup.pos, CANDY.collectRadius)) {
        // Flag *and* remove in the same pass, or the collector fires twice.
        pickup.collected = true
        onCollect(pickup)
        continue
      }
      survivors.push(pickup)
    }
    this.pickups = survivors
  }

  private trySpawn(playerPos: Vec2, random: Random): void {
    if (this.pickups.length >= CANDY.maxAlive) {
      return
    }
    const x = random.range(ARENA.width * CANDY.band.from, ARENA.width * CANDY.band.to)
    const y = random.range(ARENA.height * CANDY.row.from, ARENA.height * CANDY.row.to)
    if (Math.hypot(x - playerPos.x, y - playerPos.y) < CANDY.collectRadius * 2) {
      // Never drop a pickup on top of the player: it would be collected before
      // it could be seen, which reads as a bug rather than a reward.
      return
    }
    this.pickups.push({
      id: takeSpikeId(),
      pos: { x, y },
      baseY: y,
      kind: random.pick(KINDS),
      phase: random.range(0, Math.PI * 2),
      ttl: CANDY.ttl,
      life: CANDY.ttl,
      collected: false,
    })
  }

  /** Vertical offset of a pickup at a given clock time. */
  public static bobAt(pickup: Pickup, elapsed: number): number {
    return Math.sin(elapsed * CANDY.bobSpeed + pickup.phase) * CANDY.bobAmplitude
  }

  /** 0..1 opacity curve: quick fade-in, long hold, quick fade-out at expiry. */
  public static visibility(pickup: Pickup): number {
    const elapsed = pickup.ttl - pickup.life
    if (elapsed < 0.25) {
      return elapsed / 0.25
    }
    if (pickup.life < CANDY.fadeOut) {
      return Math.max(0, pickup.life / CANDY.fadeOut)
    }
    return 1
  }

  public reset(): void {
    this.pickups = []
    this.timer = CANDY.firstDelay
    this.elapsed = 0
  }
}

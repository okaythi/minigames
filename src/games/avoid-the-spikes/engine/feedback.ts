import { JUICE } from './config'
import { ParticleSystem } from './particles'
import { HitStop, ScreenShake } from './screen-shake'
import type { Vec2, WallSide } from './types'

/**
 * Everything that makes a contact *feel* like something: shake, hit-stop, the
 * wall flash and the particle bursts.
 *
 * It is deliberately separate from the session. Rules decide what happened;
 * feedback decides how loudly. A game can be re-tuned here without touching a
 * single line of physics, and the renderer can read this layer without knowing
 * anything about scoring.
 */
export class Feedback {
  public readonly particles = new ParticleSystem()
  public readonly shake: ScreenShake
  public readonly hitStop = new HitStop()

  /** Decaying 0..0.22 per wall, read by the arena layer. */
  public readonly flash: Record<WallSide, number> = { left: 0, right: 0 }
  public deathFlash = 0

  public constructor(random: () => number) {
    this.shake = new ScreenShake(random, JUICE.shakeDecay)
  }

  /** A clean wall touch: short freeze, small kick, sparks along the normal. */
  public bounce(point: Vec2, normal: Vec2, side: WallSide, random: () => number): void {
    this.shake.kick(JUICE.shakeBounce)
    this.hitStop.freeze(JUICE.hitStopBounce)
    this.flash[side] = JUICE.wallFlash
    this.particles.bounceBurst(point, normal, random)
  }

  /** A crash: the longest freeze in the game, so the death reads as an event. */
  public death(point: Vec2, random: () => number): void {
    this.shake.kick(JUICE.shakeDeath)
    this.hitStop.freeze(JUICE.hitStopDeath)
    this.deathFlash = JUICE.flashOnDeath
    this.particles.deathBurst(point, random)
  }

  /** A pickup: barely a nudge, but the freeze makes it feel *taken*. */
  public collect(point: Vec2, random: () => number): void {
    this.shake.kick(JUICE.shakeCandy)
    this.hitStop.freeze(JUICE.hitStopCandy)
    this.particles.candyBurst(point, random)
  }

  /** A dissolved floating spike: shards and rings throw outward. */
  public clearMover(point: Vec2, random: () => number): void {
    this.particles.moverBurst(point, random)
  }

  public update(dt: number, random: () => number): void {
    this.particles.update(dt, random)
    const decay = Math.min(1, dt * 6)
    this.flash.left = Math.max(0, this.flash.left - decay * JUICE.wallFlash)
    this.flash.right = Math.max(0, this.flash.right - decay * JUICE.wallFlash)
    this.deathFlash = Math.max(0, this.deathFlash - dt * 1.6)
    this.shake.update(dt)
  }

  public reset(): void {
    this.particles.clear()
    this.shake.reset()
    this.hitStop.reset()
    this.flash.left = 0
    this.flash.right = 0
    this.deathFlash = 0
  }
}

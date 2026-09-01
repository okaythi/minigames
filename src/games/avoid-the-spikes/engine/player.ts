import { ARENA, PLAYER, PHYSICS } from './config'
import { clamp } from '../../../lib/math'
import { bounceSpeed } from './speed-curve'
import { wallLimitFor } from './geometry'
import type { PlayerState, Vec2, WallSide } from './types'

/**
 * The pod. This file owns flight; the session owns consequences (walls,
 * spikes, score). Two rules make the game: gravity is always pulling, and a
 * flap is an *impulse* (velocity is set, not added) so spam-clicking pins you
 * into the ceiling teeth instead of making you invincible.
 */

export const createPlayer = (): PlayerState => ({
  pos: { x: ARENA.width / 2, y: ARENA.height / 2 },
  vel: { x: 0, y: 0 },
  heading: 1,
  boost: 1,
  flapCooldown: 0,
  squash: 0,
  trail: [],
  trailTimer: 0,
  alive: true,
})

/** Park the pod on a wall with no velocity: the "ready" pose. */
export function attachToWall(player: PlayerState, side: WallSide): void {
  const limit = wallLimitFor(side, PLAYER.halfWidth)
  player.heading = side === 'left' ? 1 : -1
  player.pos = { x: limit, y: ARENA.height * 0.52 }
  player.vel = { x: 0, y: 0 }
  player.boost = 1
  player.squash = 0.35
  player.flapCooldown = 0
  player.trail = []
  player.alive = true
}

/** True when the input was accepted (cooldowns are part of the design). */
export function flap(player: PlayerState): boolean {
  if (player.flapCooldown > 0) {
    return false
  }
  player.vel.y = -PHYSICS.flapImpulse
  player.flapCooldown = PHYSICS.flapCooldown
  // The "and forward" half of the jump: a short over-cruise that relaxes back
  // to the computed cruise speed, so mashing nudges you across the gap.
  player.boost = PHYSICS.flapBoost
  player.squash = Math.min(1, player.squash + 0.5)
  return true
}

export interface WallContact {
  readonly side: WallSide
  readonly point: Vec2
}

/** Which wall the pod is currently touching, if any. */
export function contactWith(player: PlayerState): WallContact | null {
  const half = PLAYER.halfWidth
  if (player.pos.x <= half + 0.001) {
    return { side: 'left', point: { x: half, y: player.pos.y } }
  }
  const limit = ARENA.width - half
  if (player.pos.x >= limit - 0.001) {
    return { side: 'right', point: { x: limit, y: player.pos.y } }
  }
  return null
}

/** Reflect off a wall. The session has already decided it was a clean hit. */
export function bounce(player: PlayerState, side: WallSide, score: number): void {
  const limit = wallLimitFor(side, PLAYER.halfWidth)
  player.pos.x = limit
  player.vel.y *= PHYSICS.bounceVerticalRetention
  player.heading = side === 'left' ? 1 : -1
  player.boost = 1
  player.squash = 1
  // One clean, immediate acceleration so the very next crossing feels faster.
  player.vel.x = player.heading * bounceSpeed(score)
}

export function advance(player: PlayerState, dt: number, score: number): void {
  player.flapCooldown = Math.max(0, player.flapCooldown - dt)

  const gravity = player.vel.y < 0 ? PHYSICS.gravity * PHYSICS.riseGravityFactor : PHYSICS.gravity
  player.vel.y = Math.min(player.vel.y + gravity * dt, PHYSICS.maxFallSpeed)
  if (player.vel.y < PHYSICS.maxRiseSpeed) {
    player.vel.y = PHYSICS.maxRiseSpeed
  }

  // Boost relaxes exponentially back to cruise speed.
  player.boost = 1 + (player.boost - 1) * Math.exp(-PHYSICS.flapBoostDecay * dt)

  const speed = bounceSpeed(score) * player.boost
  player.vel.x = player.heading * speed
  player.pos.x = clamp(player.pos.x + player.vel.x * dt, PLAYER.halfWidth, ARENA.width - PLAYER.halfWidth)
  player.pos.y += player.vel.y * dt

  player.squash = Math.max(0, player.squash - 4.4 * dt)
}

/** Nose direction follows the velocity vector, mirrored by heading. */
export function facingAngle(player: PlayerState): number {
  const forward = Math.max(40, Math.abs(player.vel.x))
  const raw = Math.atan2(player.vel.y, forward)
  const tilted = clamp(raw, -0.95, 1.15)
  return player.heading === 1 ? tilted : Math.PI - tilted
}

export function advanceTrail(player: PlayerState, dt: number): void {
  player.trailTimer -= dt
  if (player.trailTimer <= 0) {
    player.trailTimer = PLAYER.trailInterval
    player.trail = [{ x: player.pos.x, y: player.pos.y, age: 0 }, ...player.trail].slice(
      0,
      PLAYER.trailSamples,
    )
  }
  player.trail = player.trail.map((point) => ({ ...point, age: point.age + dt }))
  player.trail = player.trail.filter((point) => point.age < 0.34)
}

import { ARENA, MOVERS } from './config'
import { takeSpikeId } from './spike-factory'
import { rectIntersectsTriangle, triangleBoundsHit } from './collision'
import { moverSpeed } from './speed-curve'
import type { Random } from '../../../lib/random'
import type { Mover, MoverAxis, Rect, Triangle, Vec2 } from './types'

/**
 * Floating centre spikes. They exist to punish spam-clicking: once the score
 * passes `MOVERS.unlockScore` you have to time the crossing, not just mash.
 */

const boundsFor = (axis: MoverAxis): Readonly<{ min: number; max: number }> =>
  axis === 'vertical'
    ? {
        min: ARENA.ceilingDepth + MOVERS.clearance,
        max: ARENA.height - ARENA.floorDepth - MOVERS.clearance,
      }
    : {
        // Horizontal movers never reach the walls, so they cannot hide a gap.
        min: 78,
        max: ARENA.width - 78,
      }

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

export function moverTriangle(mover: Mover): Triangle {
  const speed = Math.hypot(mover.vel.x, mover.vel.y) || 1
  const dir: Vec2 = { x: mover.vel.x / speed, y: mover.vel.y / speed }
  const perp: Vec2 = { x: -dir.y, y: dir.x }
  const half = mover.size * 0.52
  const back = mover.size * 0.42
  const front = mover.size * 0.62
  return {
    a: { x: mover.pos.x - dir.x * back + perp.x * half, y: mover.pos.y - dir.y * back + perp.y * half },
    b: { x: mover.pos.x - dir.x * back - perp.x * half, y: mover.pos.y - dir.y * back - perp.y * half },
    c: { x: mover.pos.x + dir.x * front, y: mover.pos.y + dir.y * front },
  }
}

export const desiredMoverCount = (score: number): number => {
  if (score < MOVERS.unlockScore) {
    return 0
  }
  return Math.min(MOVERS.maxCount, 1 + Math.floor((score - MOVERS.unlockScore) / MOVERS.onePerScore))
}

export class MoverField {
  private movers: Mover[] = []
  private attractor = { u: 0.1, v: 0.1 }

  public list(): readonly Mover[] {
    return this.movers
  }

  /** Brings the field up to (or down from) the count the score deserves. */
  public sync(score: number, playerPos: Vec2, random: Random): void {
    const target = desiredMoverCount(score)
    while (this.movers.length > target) {
      this.movers.pop()
    }
    while (this.movers.length < target) {
      const mover = this.spawn(playerPos, score, random)
      if (mover === null) {
        return
      }
      this.movers.push(mover)
    }
  }

  private spawn(playerPos: Vec2, score: number, random: Random): Mover | null {
    // Clifford strange attractor projection: deterministic non-linear orbits
    const a = -1.4 + 0.05 * Math.sin(score * 0.31)
    const b = 1.6 + 0.05 * Math.cos(score * 0.27)
    const c = 1.0
    const d = 0.7

    for (let attempt = 0; attempt < 8; attempt += 1) {
      this.attractor.u = Math.sin(a * this.attractor.v) + c * Math.cos(a * this.attractor.u)
      this.attractor.v = Math.cos(b * this.attractor.u) + d * Math.sin(b * this.attractor.v)

      // Normalize attractor phase [-2, 2] into [0, 1]
      const nx = (this.attractor.u + 2) / 4
      const ny = (this.attractor.v + 2) / 4

      const axis = (attempt % 2 === 0 ? nx > 0.5 : random.chance(0.5)) ? 'vertical' : 'horizontal'
      const bounds = boundsFor(axis)
      const speed = moverSpeed(score, MOVERS.baseSpeed, MOVERS.speedPerScore, MOVERS.maxSpeed)
      const jitter = random.range(-speed * 0.18, speed * 0.18)

      const along = bounds.min + (axis === 'vertical' ? ny : nx) * (bounds.max - bounds.min)
      const across =
        axis === 'vertical' ? 110 + nx * (ARENA.width - 220) : 120 + ny * (ARENA.height - 240)
      const pos: Vec2 = axis === 'vertical' ? { x: across, y: along } : { x: along, y: across }
      const direction = (axis === 'vertical' ? ny > 0.5 : nx > 0.5) ? 1 : -1

      if (distance(pos, playerPos) < MOVERS.spawnDistance) {
        continue
      }

      // Maintain minimum separation so trajectories never merge into an impenetrable wall
      const tooClose = this.movers.some((m) => distance(m.pos, pos) < 54)
      if (tooClose) {
        continue
      }

      const vel: Vec2 =
        axis === 'vertical'
          ? { x: 0, y: direction * (speed + jitter) }
          : { x: direction * (speed + jitter), y: 0 }

      return {
        id: takeSpikeId(),
        axis,
        pos,
        vel,
        size: MOVERS.size,
        min: bounds.min,
        max: bounds.max,
        age: 0,
      }
    }
    return null
  }

  public update(dt: number): void {
    // Harmonic phase coupling: movers sharing an axis gently repel in phase,
    // forming dynamic alternating gates rather than overlapping in clumps.
    for (let i = 0; i < this.movers.length; i += 1) {
      for (let j = i + 1; j < this.movers.length; j += 1) {
        const m1 = this.movers[i]
        const m2 = this.movers[j]
        if (m1 && m2 && m1.axis === m2.axis) {
          const delta = m1.axis === 'vertical' ? m1.pos.y - m2.pos.y : m1.pos.x - m2.pos.x
          if (Math.abs(delta) < 58) {
            const push = Math.sign(delta || 1) * 14 * dt
            if (m1.axis === 'vertical') {
              m1.pos.y += push
              m2.pos.y -= push
            } else {
              m1.pos.x += push
              m2.pos.x -= push
            }
          }
        }
      }
    }

    for (const mover of this.movers) {
      mover.age += dt
      mover.pos.x += mover.vel.x * dt
      mover.pos.y += mover.vel.y * dt

      const value = mover.axis === 'vertical' ? mover.pos.y : mover.pos.x
      if (value < mover.min) {
        if (mover.axis === 'vertical') {
          mover.pos.y = mover.min
          mover.vel.y = Math.abs(mover.vel.y)
        } else {
          mover.pos.x = mover.min
          mover.vel.x = Math.abs(mover.vel.x)
        }
      } else if (value > mover.max) {
        if (mover.axis === 'vertical') {
          mover.pos.y = mover.max
          mover.vel.y = -Math.abs(mover.vel.y)
        } else {
          mover.pos.x = mover.max
          mover.vel.x = -Math.abs(mover.vel.x)
        }
      }
    }
  }

  public hits(rect: Rect): Mover | null {
    for (const mover of this.movers) {
      const triangle = moverTriangle(mover)
      if (triangleBoundsHit(rect, triangle) && rectIntersectsTriangle(rect, triangle)) {
        return mover
      }
    }
    return null
  }

  public reset(): void {
    this.movers = []
    this.attractor = { u: 0.1, v: 0.1 }
  }

  public clear(): void {
    this.reset()
  }
}

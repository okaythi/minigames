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

const AXES: readonly MoverAxis[] = ['vertical', 'horizontal']

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
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const axis = random.pick(AXES)
      const bounds = boundsFor(axis)
      const speed = moverSpeed(score, MOVERS.baseSpeed, MOVERS.speedPerScore, MOVERS.maxSpeed)
      const jitter = random.range(-speed * 0.18, speed * 0.18)
      const along = random.range(bounds.min, bounds.max)
      const across = axis === 'vertical' ? random.range(110, ARENA.width - 110) : random.range(120, ARENA.height - 120)
      const pos: Vec2 = axis === 'vertical' ? { x: across, y: along } : { x: along, y: across }
      const direction = random.chance(0.5) ? 1 : -1

      if (distance(pos, playerPos) < MOVERS.spawnDistance) {
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
  }
}

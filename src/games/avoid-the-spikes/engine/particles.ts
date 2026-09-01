import { JUICE } from './config'
import { PALETTE } from '../../../theme/palette'
import { damp } from '../../../lib/math'
import type { Particle, ParticleShape, Vec2 } from './types'

/**
 * Pooled particles with a hard cap. Three named bursts cover every moment the
 * game needs to sell: wall contact, death, candy.
 */

const CAP = 240

interface BurstOptions {
  readonly origin: Vec2
  readonly count: number
  readonly speed: number
  readonly spread: number
  /** Direction the burst favours, in radians. */
  readonly heading: number
  readonly colors: readonly string[]
  readonly shapes: readonly ParticleShape[]
  readonly ttl: number
  readonly gravity: number
}

export class ParticleSystem {
  private readonly items: Particle[] = []
  private readonly gravity = new Map<Particle, number>()

  public list(): readonly Particle[] {
    return this.items
  }

  public emit(options: BurstOptions, random: () => number): void {
    const room = CAP - this.items.length
    const count = Math.min(options.count, Math.max(0, room))
    for (let index = 0; index < count; index += 1) {
      const angle = options.heading + (random() - 0.5) * options.spread
      const speed = options.speed * (0.45 + random() * 0.75)
      const particle: Particle = {
        pos: { x: options.origin.x, y: options.origin.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        age: 0,
        ttl: options.ttl * (0.7 + random() * 0.6),
        size: 2 + random() * 3.4,
        color: options.colors[Math.floor(random() * options.colors.length)] ?? PALETTE.orange,
        shape: options.shapes[Math.floor(random() * options.shapes.length)] ?? 'spark',
        rotation: random() * Math.PI,
        spin: (random() - 0.5) * 12,
        drag: 2.6 + random() * 1.4,
      }
      this.items.push(particle)
      this.gravity.set(particle, options.gravity)
    }
  }

  /** Sparks + shards thrown back out of the wall the player just hit. */
  public bounceBurst(point: Vec2, normal: Vec2, random: () => number): void {
    this.emit(
      {
        origin: point,
        count: JUICE.bounceSparks,
        speed: 240,
        spread: 1.5,
        heading: Math.atan2(normal.y, normal.x),
        colors: [PALETTE.orange, PALETTE.orangeBright, PALETTE.paper, PALETTE.orangeGlow],
        shapes: ['spark', 'shard'],
        ttl: 0.42,
        gravity: 620,
      },
      random,
    )
  }

  public deathBurst(point: Vec2, random: () => number): void {
    this.emit(
      {
        origin: point,
        count: JUICE.deathSparks,
        speed: 330,
        spread: Math.PI * 2,
        heading: 0,
        colors: [PALETTE.red, PALETTE.orange, PALETTE.graphite, PALETTE.orangeBright],
        shapes: ['shard', 'spark', 'ring'],
        ttl: 0.66,
        gravity: 900,
      },
      random,
    )
  }

  public candyBurst(point: Vec2, random: () => number): void {
    this.emit(
      {
        origin: point,
        count: JUICE.candySparks,
        speed: 150,
        spread: Math.PI * 2,
        heading: 0,
        colors: [PALETTE.orangeBright, PALETTE.green, PALETTE.paper, PALETTE.orangeGlow],
        shapes: ['spark', 'ring'],
        ttl: 0.5,
        gravity: -120,
      },
      random,
    )
  }

  public update(dt: number, random: () => number): void {
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      const particle = this.items[index]
      if (particle === undefined) {
        continue
      }
      particle.age += dt
      if (particle.age >= particle.ttl) {
        this.items.splice(index, 1)
        this.gravity.delete(particle)
        continue
      }
      const pull = this.gravity.get(particle) ?? 0
      particle.vel.y += pull * dt
      particle.vel.x = damp(particle.vel.x, 0, 0.02, dt)
      particle.vel.y = damp(particle.vel.y, pull * 0.15, 0.08, dt)
      particle.pos.x += particle.vel.x * dt
      particle.pos.y += particle.vel.y * dt
      particle.rotation += particle.spin * dt
      // Tiny per-frame wobble keeps shards from looking like sprites.
      particle.size += (random() - 0.5) * 0.05
    }
  }

  public clear(): void {
    this.items.length = 0
    this.gravity.clear()
  }

  public get live(): number {
    return this.items.length
  }
}

export const particleAlpha = (particle: Particle): number =>
  Math.max(0, 1 - particle.age / particle.ttl)

import { damp } from '../../../lib/math'
import type { Vec2 } from './types'

/**
 * Screen shake with a smoothed random walk: raw per-frame jitter would look
 * like a broken LCD, exponential decay toward a new target looks like impact.
 */
export class ScreenShake {
  private magnitude = 0
  private target: Vec2 = { x: 0, y: 0 }
  private current: Vec2 = { x: 0, y: 0 }

  public constructor(
    private readonly random: () => number,
    private readonly decay: number,
  ) {}

  public kick(strength: number): void {
    // Overlapping kicks add up, but never past a sane ceiling.
    this.magnitude = Math.min(this.magnitude + strength, 22)
  }

  public update(dt: number): void {
    this.magnitude = damp(this.magnitude, 0, 0.0001, dt * (this.decay / 26))
    if (this.magnitude < 0.02) {
      this.magnitude = 0
      this.current = { x: 0, y: 0 }
      this.target = { x: 0, y: 0 }
      return
    }
    // Pick a new target roughly every other frame.
    if (this.random() < 0.42) {
      this.target = {
        x: (this.random() * 2 - 1) * this.magnitude,
        y: (this.random() * 2 - 1) * this.magnitude * 0.7,
      }
    }
    this.current = {
      x: damp(this.current.x, this.target.x, 0.0002, dt),
      y: damp(this.current.y, this.target.y, 0.0002, dt),
    }
  }

  public get offset(): Vec2 {
    return this.current
  }

  public get energy(): number {
    return this.magnitude
  }

  public reset(): void {
    this.magnitude = 0
    this.current = { x: 0, y: 0 }
    this.target = { x: 0, y: 0 }
  }
}

/**
 * Hit-stop: the simulation freezes for a hair while the renderer keeps
 * drawing. It is the single cheapest way to make a contact feel heavy.
 */
export class HitStop {
  private remaining = 0

  public freeze(seconds: number): void {
    this.remaining = Math.max(this.remaining, seconds)
  }

  /** Returns the leftover step time consumed by the freeze. */
  public consume(dt: number): boolean {
    if (this.remaining <= 0) {
      return false
    }
    this.remaining -= dt
    return true
  }

  public get active(): boolean {
    return this.remaining > 0
  }

  public reset(): void {
    this.remaining = 0
  }
}

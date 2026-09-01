/** Domain vocabulary for Avoid the Spikes. Pure data, no behaviour. */

export type WallSide = 'left' | 'right'
export type BoundarySide = 'ceiling' | 'floor'
export type SpikeSurface = WallSide | BoundarySide

export interface Vec2 {
  x: number
  y: number
}

/** Triangle in world space: `base` is the wall segment, `apex` points inward. */
export interface Triangle {
  readonly a: Vec2
  readonly b: Vec2
  readonly c: Vec2
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Spike {
  readonly id: number
  readonly surface: SpikeSurface
  /** Centre position along the surface (y for walls, x for ceiling/floor). */
  readonly along: number
  /** Length of the base, measured along the wall. */
  readonly base: number
  /** Full depth; the live depth is `depth * growth`. */
  readonly depth: number
  readonly sproutDelay: number
  /** Seconds since the row was armed; drives the sprout animation. */
  age: number
}

export type MoverAxis = 'vertical' | 'horizontal'

export interface Mover {
  readonly id: number
  readonly axis: MoverAxis
  readonly pos: Vec2
  readonly vel: Vec2
  readonly size: number
  readonly min: number
  readonly max: number
  age: number
}

export type PickupKind = 'candy' | 'gem'

export interface Pickup {
  readonly id: number
  /** Live position, bob included - the collider and the renderer read this. */
  readonly pos: Vec2
  readonly baseY: number
  readonly kind: PickupKind
  readonly phase: number
  readonly ttl: number
  life: number
  collected: boolean
}

export type ParticleShape = 'spark' | 'shard' | 'ring'

export interface Particle {
  pos: Vec2
  vel: Vec2
  age: number
  ttl: number
  size: number
  color: string
  shape: ParticleShape
  rotation: number
  spin: number
  drag: number
}

export type DeathCause = 'wall' | 'ceiling' | 'floor' | 'mover'

export type RunStatus = 'ready' | 'running' | 'paused' | 'over'

export interface TrailPoint {
  x: number
  y: number
  age: number
}

export interface PlayerState {
  pos: Vec2
  vel: Vec2
  /** +1 heading right, -1 heading left. */
  heading: 1 | -1
  /** Multiplier applied to horizontal speed right after a flap (1 -> decay). */
  boost: number
  flapCooldown: number
  /** 0..1 squash animation, 1 = fully squashed. */
  squash: number
  trail: TrailPoint[]
  trailTimer: number
  alive: boolean
}

export interface InputSnapshot {
  /** True while the pointer is held down. */
  readonly pointerDown: boolean
}

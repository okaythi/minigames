/**
 * Every tunable number in the game, in one file, with the reasoning attached.
 *
 * World units are CSS pixels of a fixed 360x480 arena that the renderer
 * scales to fit, so feel is identical on a phone and a 27" monitor.
 */

export const ARENA = {
  width: 360,
  height: 480,
  /** Wall spikes. `pitch` is the cell size; a gap is a run of empty cells. */
  wallPitch: 34,
  wallBase: 34,
  wallDepth: 26,
  /** Permanent hazard bands. */
  ceilingDepth: 20,
  floorDepth: 24,
  boundaryPitch: 26,
  /** Vertical slack kept clear around the arena ends for mover travel. */
  boundaryInset: 8,
} as const

export const PLAYER = {
  width: 26,
  height: 22,
  get halfWidth(): number {
    return PLAYER.width / 2
  },
  get halfHeight(): number {
    return PLAYER.height / 2
  },
  trailSamples: 9,
  trailInterval: 0.018,
} as const

export const PHYSICS = {
  /** Fixed simulation step; the renderer interpolates nothing, 120 Hz is enough. */
  step: 1 / 120,
  maxStepsPerFrame: 6,
  /**
   * Tuned around recovery distance, not just "feel": `v^2 / 2g` is how far the
   * pod falls before a flap arrests it, and that number has to stay well under
   * one third of the arena (480px) or a bad arc is unrecoverable.
   * 760^2 / (2 * 1850) = 156px of recovery.
   */
  gravity: 1850,
  /**
   * Rising is decelerated harder than falling. It is the oldest trick in
   * arcade physics: it shortens the apex (65px here instead of 104px), which
   * means a flap is a decision you can abort, and it keeps the ceiling teeth
   * from being a coin flip.
   */
  riseGravityFactor: 1.5,
  flapImpulse: 620,
  maxFallSpeed: 760,
  maxRiseSpeed: -900,
  /** Prevents "spam = flight": you may flap often, but not every frame. */
  flapCooldown: 0.09,
  /** Forward kick applied by a flap, then relaxed back to cruise speed. */
  flapBoost: 1.22,
  flapBoostDecay: 5.6,
  /** Slight vertical absorption on a wall contact keeps arcs readable. */
  bounceVerticalRetention: 0.94,
} as const

export const SPEED = {
  /** Cruise speed in px/s at score 0. */
  base: 340,
  /**
   * Logarithmic gain: the *relative* step at bounce n is logGain / (1 + n), so
   * the first bounce is a 5.5% nudge and the hundredth is 0.05%.
   */
  logGain: 0.055,
  /** Hard ceiling so a 300-bounce run is still playable. */
  max: 560,
} as const

export const HAZARDS = {
  /** Wall hazards only start after the first contact, so the opening is free. */
  minScoreForSpikes: 1,
  /** A gap must be at least this many cells wide, tightening with score. */
  gapCells: { start: 3, min: 2 },
  /** Longest run of spike cells, growing with score. */
  runCells: { start: 2, max: 5 },
  /** Density ramp: probability that a cell outside a gap holds a spike. */
  density: { start: 0.55, max: 0.86 },
  sproutStagger: 0.035,
  sproutDuration: 0.17,
  /** Collision ignores spikes that have barely started to grow. */
  collisionGrowth: 0.45,
} as const

export const MOVERS = {
  /** "past 10 points". */
  unlockScore: 11,
  // One extra mover every 7 bounces, capped at 3: enough that you have to time
  // the crossing, never enough that the middle of the screen is impassable.
  onePerScore: 7,
  maxCount: 3,
  size: 25,
  baseSpeed: 76,
  speedPerScore: 2.4,
  maxSpeed: 150,
  /** Keep clear of the ceiling/floor teeth so movers never hide them. */
  clearance: 50,
  /** A mover never spawns within this distance of the player. */
  spawnDistance: 96,
} as const

export const CANDY = {
  firstDelay: 3.4,
  interval: { min: 3.6, max: 7.2 },
  maxAlive: 2,
  ttl: 9,
  fadeOut: 1.2,
  bobAmplitude: 6,
  bobSpeed: 2.6,
  collectRadius: 20,
  /** Horizontal band: the middle of the screen, away from both walls. */
  band: { from: 0.28, to: 0.72 },
  /** Vertical band, inside the permanent hazard bands. */
  row: { from: 0.22, to: 0.8 },
} as const

export const JUICE = {
  shakeBounce: 5.2,
  shakeDeath: 15,
  shakeCandy: 1.6,
  shakeDecay: 26,
  hitStopBounce: 0.045,
  hitStopDeath: 0.11,
  hitStopCandy: 0.02,
  bounceSparks: 14,
  deathSparks: 30,
  candySparks: 12,
  flashOnDeath: 0.5,
  /** Wall contact briefly widens the arena outline. */
  wallFlash: 0.22,
} as const

export const SCORE = {
  /** Exactly one point per successful wall bounce, per the design. */
  perBounce: 1,
} as const

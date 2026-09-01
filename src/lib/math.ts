/** Numeric helpers shared by every game. All angles are radians. */

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value

export const clamp01 = (value: number): number => clamp(value, 0, 1)

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

/**
 * Frame-rate independent exponential smoothing: the fraction of the remaining
 * distance closed per second, so 0.0001 at 60 fps feels the same as at 144.
 */
export const damp = (from: number, to: number, remaining: number, dt: number): number =>
  to + (from - to) * Math.pow(remaining, dt)

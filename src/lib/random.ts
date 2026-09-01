/**
 * Deterministic RNG utilities. Games never call `Math.random()` directly:
 * a seeded generator keeps replays debuggable and lets tests pin a run.
 */

export interface Random {
  /** Uniform float in [0, 1). */
  next(): number
  /** Float in [min, max). */
  range(min: number, max: number): number
  /** True with probability `p`. */
  chance(p: number): boolean
  /** Uniform choice from a non-empty list. */
  pick<T>(items: readonly T[]): T
}

const TWO32 = 4294967296

/** mulberry32: 32-bit state, tiny, well distributed, no allocations. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / TWO32
  }
  return {
    next,
    range: (min, max) => next() * (max - min) + min,
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) {
        throw new RangeError('pick() needs a non-empty list')
      }
      return items[Math.floor(next() * items.length)] as (typeof items)[number]
    },
  }
}

/** Non-crypto entropy for the initial seed of a session. */
export const entropySeed = (): number => {
  const buffer = new Uint32Array(1)
  globalThis.crypto?.getRandomValues(buffer)
  return (buffer[0] ?? Date.now()) ^ Math.trunc(Date.now() / 1000)
}

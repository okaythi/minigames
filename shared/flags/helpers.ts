import { UserFlags, GameFlags, type UserFlagsBit, type GameFlagsBit } from './types'

/**
 * Checks whether a specific flag bit is set on the user's bitmask vector.
 * Runs in a single CPU clock cycle for bit numbers, and resolves strings via static dictionary.
 */
export function hasFlag(
  flags: number | undefined | null,
  flag: UserFlagsBit | number | string,
): boolean {
  const vector = Number(flags) || 0
  if (typeof flag === 'string') {
    const bit = (UserFlags as Record<string, number>)[flag]
    if (!bit) return false
    return (vector & bit) === bit
  }
  if (flag === 0) return false
  return (vector & flag) === flag
}

/**
 * Returns a new bitmask vector with the specified flag bit set.
 */
export function enableFlag(
  flags: number | undefined | null,
  flag: UserFlagsBit | number | string,
): number {
  const bit = typeof flag === 'string' ? (UserFlags as Record<string, number>)[flag] ?? 0 : flag
  return (Number(flags) || 0) | bit
}

/**
 * Returns a new bitmask vector with the specified flag bit cleared.
 */
export function disableFlag(
  flags: number | undefined | null,
  flag: UserFlagsBit | number | string,
): number {
  const bit = typeof flag === 'string' ? (UserFlags as Record<string, number>)[flag] ?? 0 : flag
  return (Number(flags) || 0) & ~bit
}

/**
 * Checks whether ALL flags in the requirement mask are set.
 *
 * Example:
 *   const PIONEER_DEV = UserFlags.USER_DEVELOPER | UserFlags.USER_PIONEER
 *   if (hasAllFlags(user.flags, PIONEER_DEV)) { ... }
 */
export function hasAllFlags(
  flags: number | undefined | null,
  mask: number,
): boolean {
  if (mask === 0) return true
  const vector = Number(flags) || 0
  return (vector & mask) === mask
}

/**
 * Checks whether ANY of the flags in the mask are set.
 */
export function hasAnyFlag(
  flags: number | undefined | null,
  mask: number,
): boolean {
  if (mask === 0) return false
  const vector = Number(flags) || 0
  return (vector & mask) !== 0
}

/**
 * Safely coerces a raw database or API field into an integer bitmask.
 * Supports numbers, numeric strings, and legacy JSON fallback.
 */
export function parseFlags(raw: unknown): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return Math.floor(raw)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric)) {
      return Math.floor(numeric)
    }
    // Backward compatibility with temporary JSON format:
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        let mask = 0
        if (parsed.USER_DEVELOPER?.enabled) mask |= UserFlags.USER_DEVELOPER
        if (parsed.USER_PIONEER?.enabled) mask |= UserFlags.USER_PIONEER
        if (parsed.STAFF?.enabled) mask |= UserFlags.STAFF
        if (parsed.CMS_EDITOR?.enabled) mask |= UserFlags.CMS_EDITOR
        return mask
      }
    } catch {
      return 0
    }
  }
  return 0
}

/**
 * Safely coerces raw game flag representation (number, numeric string, or name) into bitmask integer.
 */
export function parseGameFlags(raw: unknown): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return Math.floor(raw)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric)) {
      return Math.floor(numeric)
    }
    const bit = (GameFlags as Record<string, number>)[trimmed]
    if (bit !== undefined) {
      return bit
    }
  }
  return 0
}

/**
 * Checks whether a game manifest or vector has a specific game flag bit.
 * Supports manifests with flags, flag, or gameFlag, as well as raw bitmask vectors.
 */
export function hasGameFlag(
  manifestOrFlags:
    | {
        readonly flags?: number | undefined
        readonly flag?: number | string | undefined
        readonly gameFlag?: number | string | undefined
      }
    | number
    | undefined
    | null,
  flag: GameFlagsBit | number | string,
): boolean {
  if (manifestOrFlags == null) return false

  let bit: number
  if (typeof flag === 'string') {
    bit = (GameFlags as Record<string, number>)[flag] ?? 0
    if (bit === 0) return false
  } else {
    bit = flag
    if (bit === 0) return false
  }

  if (typeof manifestOrFlags === 'number') {
    return (manifestOrFlags & bit) === bit
  }

  // Check numeric vector on manifest.flags
  if (typeof manifestOrFlags.flags === 'number') {
    return (manifestOrFlags.flags & bit) === bit
  }

  // Check flag / gameFlag properties (number, string, or alias)
  const candidate = manifestOrFlags.flag ?? manifestOrFlags.gameFlag
  if (candidate === undefined) return false

  const candidateVector = parseGameFlags(candidate)
  return (candidateVector & bit) === bit
}

/**
 * Returns a new game bitmask vector with the specified flag bit set.
 */
export function enableGameFlag(
  flags: number | undefined | null,
  flag: GameFlagsBit | number | string,
): number {
  const bit = typeof flag === 'string' ? (GameFlags as Record<string, number>)[flag] ?? 0 : flag
  return (Number(flags) || 0) | bit
}

/**
 * Returns a new game bitmask vector with the specified flag bit cleared.
 */
export function disableGameFlag(
  flags: number | undefined | null,
  flag: GameFlagsBit | number | string,
): number {
  const bit = typeof flag === 'string' ? (GameFlags as Record<string, number>)[flag] ?? 0 : flag
  return (Number(flags) || 0) & ~bit
}

/**
 * Checks whether ALL flags in the game requirement mask are set.
 */
export function hasAllGameFlags(
  flags: number | undefined | null,
  mask: number,
): boolean {
  if (mask === 0) return true
  const vector = Number(flags) || 0
  return (vector & mask) === mask
}

/**
 * Checks whether ANY of the flags in the game requirement mask are set.
 */
export function hasAnyGameFlag(
  flags: number | undefined | null,
  mask: number,
): boolean {
  if (mask === 0) return false
  const vector = Number(flags) || 0
  return (vector & mask) !== 0
}


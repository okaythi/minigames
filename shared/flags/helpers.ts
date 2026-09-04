import { UserFlags, type UserFlagsBit } from './types'

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
 * Checks whether a game manifest has a specific game flag.
 */
export function hasGameFlag(
  manifest:
    | { readonly flag?: string | undefined; readonly gameFlag?: string | undefined }
    | undefined
    | null,
  flag: string,
): boolean {
  if (!manifest) return false
  return manifest.flag === flag || manifest.gameFlag === flag
}

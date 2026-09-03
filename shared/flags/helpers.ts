import type { UserFlags } from './types'
import type { UserFlagName } from './registry'

/**
 * Checks whether a given flag is actively present and enabled on a user's flags object.
 */
export function hasFlag(
  flags: UserFlags | undefined | null,
  flag: UserFlagName | string,
): boolean {
  if (!flags || typeof flags !== 'object') return false
  const entry = flags[flag]
  if (!entry) return false
  if (entry.enabled === false) return false
  return true
}

/**
 * Returns a new UserFlags object with the specified flag enabled.
 */
export function enableFlag(
  flags: UserFlags | undefined | null,
  flag: UserFlagName | string,
  extraData?: Record<string, unknown>,
): UserFlags {
  const current = flags ? { ...flags } : {}
  const existing = current[flag] ?? {}
  current[flag] = {
    ...existing,
    ...extraData,
    enabled: true,
  }
  return current
}

/**
 * Returns a new UserFlags object with the specified flag removed.
 */
export function disableFlag(
  flags: UserFlags | undefined | null,
  flag: UserFlagName | string,
): UserFlags {
  if (!flags) return {}
  const next = { ...flags }
  delete next[flag]
  return next
}

/**
 * Safely parses raw JSON from D1 or an API payload into a typed UserFlags record.
 */
export function parseFlags(raw: string | UserFlags | undefined | null): UserFlags {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as UserFlags
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as UserFlags
      }
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Returns an array of all active flag names.
 */
export function getActiveFlagNames(flags: UserFlags | undefined | null): string[] {
  if (!flags) return []
  return Object.keys(flags).filter((flag) => hasFlag(flags, flag))
}

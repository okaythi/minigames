/**
 * localStorage with a namespace, JSON typing and a hard refusal to throw.
 * Private-mode Safari is a real deployment target for a game site.
 */

const PREFIX = 'nixlabs.'

interface SafeStorage {
  read<T>(key: string, fallback: T, validator?: (val: unknown) => val is T): T
  write<T>(key: string, value: T): boolean
  remove(key: string): void
}

const backend = (): Storage | null => {
  try {
    const probe = '__nixlabs_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

let cached: Storage | null | undefined

const storage = (): Storage | null => {
  cached ??= backend()
  return cached
}

const revive = (raw: string | null): unknown => {
  if (raw === null) {
    return undefined
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

export const localStore: SafeStorage = {
  read<T>(key: string, fallback: T, validator?: (val: unknown) => val is T): T {
    const driver = storage()
    if (driver === null) {
      return fallback
    }
    const value = revive(driver.getItem(PREFIX + key))
    if (value === undefined) {
      return fallback
    }
    if (validator !== undefined) {
      return validator(value) ? value : fallback
    }
    return value as T
  },

  write<T>(key: string, value: T): boolean {
    const driver = storage()
    if (driver === null) {
      return false
    }
    try {
      driver.setItem(PREFIX + key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },

  remove(key: string): void {
    storage()?.removeItem(PREFIX + key)
  },
}

/** Cross-tab freshness: fires when another tab writes the same key. */
export function onLocalStorageChange(key: string, handler: () => void): () => void {
  const listener = (event: StorageEvent): void => {
    if (event.key === null || event.key === PREFIX + key) {
      handler()
    }
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}

import { localStore, onLocalStorageChange } from '../storage/local-store'

/**
 * Per-browser counters. This is the single writer for anything the games
 * persist, and it doubles as the fallback when the edge namespace is not
 * bound: the "global" numbers then simply become this browser's numbers.
 */

export interface LocalCounters {
  readonly plays: number
  /** Personal best, `null` until the first finished run. */
  readonly best: number | null
  /** Collectibles banked across sessions (candy in Avoid the Spikes). */
  readonly candy: number
}

const keyFor = (slug: string): string => `stats.${slug}`

type Listener = () => void

const cache = new Map<string, LocalCounters>()
const listeners = new Set<Listener>()

export function readLocalCounters(slug: string): LocalCounters {
  const cached = cache.get(slug)
  if (cached !== undefined) {
    return cached
  }
  const stored = localStore.read<Partial<LocalCounters>>(keyFor(slug), {})
  const counters: LocalCounters = {
    plays: typeof stored.plays === 'number' && stored.plays >= 0 ? Math.floor(stored.plays) : 0,
    best: typeof stored.best === 'number' && Number.isFinite(stored.best) ? Math.floor(stored.best) : null,
    candy: typeof stored.candy === 'number' && stored.candy >= 0 ? Math.floor(stored.candy) : 0,
  }
  cache.set(slug, counters)
  return counters
}

export function patchLocalCounters(slug: string, patch: Partial<LocalCounters>): LocalCounters {
  const current = readLocalCounters(slug)
  const next: LocalCounters = {
    plays: patch.plays ?? current.plays,
    best: patch.best === undefined ? current.best : patch.best,
    candy: patch.candy ?? current.candy,
  }
  cache.set(slug, next)
  localStore.write(keyFor(slug), next)
  emit()
  return next
}

export const registerPlay = (slug: string): LocalCounters => {
  const current = readLocalCounters(slug)
  return patchLocalCounters(slug, { plays: current.plays + 1 })
}

export const registerScore = (slug: string, score: number): LocalCounters => {
  const current = readLocalCounters(slug)
  return patchLocalCounters(slug, { best: current.best === null ? score : Math.max(current.best, score) })
}

export const bankCandy = (slug: string, amount: number): LocalCounters => {
  const current = readLocalCounters(slug)
  return patchLocalCounters(slug, { candy: Math.max(0, current.candy + amount) })
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

/**
 * Listeners re-read the slugs they care about; nothing caches a derived view
 * here, so the grid and the game page can never disagree mid-session.
 */
export function subscribeLocalCounters(listener: Listener): () => void {
  listeners.add(listener)
  const offStorage = onLocalStorageChange('stats', () => {
    // Another tab wrote: drop every memo so the next read hits localStorage.
    for (const slug of [...cache.keys()]) {
      cache.delete(slug)
    }
    emit()
  })
  return () => {
    listeners.delete(listener)
    offStorage()
  }
}

export function readGlobalCandy(knownSlugs: readonly string[]): number {
  let total = 0
  for (const slug of knownSlugs) {
    total += readLocalCounters(slug).candy
  }
  return total
}

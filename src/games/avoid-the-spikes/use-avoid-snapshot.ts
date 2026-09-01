import { useSyncExternalStore } from 'react'
import type { Store } from '../../lib/observable-store'
import type { AvoidSnapshot } from './state'

/**
 * React's window into the engine. The store only changes when something the
 * player can see changes (score, status, candy), so the HUD re-renders a few
 * times per run - never 120 times a second.
 */
export function useAvoidSnapshot(store: Store<AvoidSnapshot>): AvoidSnapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

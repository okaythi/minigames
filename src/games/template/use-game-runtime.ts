import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Store } from '../../lib/observable-store'
import { useGameStats } from '../../services/stats/stats-provider'
import type { GameRuntimeDeps, GameRuntimeFactory, GameRuntime } from './types'
import type { GameSnapshot } from './snapshot'
import type { GameManifest } from '../types'

/** Before the first render settles, the game sees "no history, nowhere to report". */
const IDLE_DEPS: GameRuntimeDeps = {
  best: null,
  bonus: 0,
  beginRun: () => undefined,
  finishRun: () => undefined,
  bankBonus: () => undefined,
}

/**
 * Binds a game's runtime to the page: the runtime is built once, reads the live
 * stats controller through a ref, and is torn down with the component.
 *
 * This is the only place the chrome talks to `StatsProvider`, so the engine
 * never imports a service and the services never import an engine.
 */
export function useGameRuntime(manifest: GameManifest, create: GameRuntimeFactory): GameRuntime {
  const stats = useGameStats(manifest.slug)

  // Refreshed on every render: a run started two minutes from now must see the
  // best score the player set since the runtime was created.
  const deps = useRef<GameRuntimeDeps>(IDLE_DEPS)
  deps.current = {
    best: stats.personalBest,
    bonus: stats.candy,
    beginRun: () => stats.beginRun(manifest.slug),
    finishRun: (score) => stats.finishRun(manifest.slug, score),
    bankBonus: (amount) => stats.bankCandy(manifest.slug, amount),
  }

  const runtime = useMemo(() => create(deps), [create])

  useEffect(() => () => runtime.dispose(), [runtime])

  return runtime
}

/**
 * React's window into the engine. The store only changes when something the
 * player can see changes, so the chrome re-renders a few times per run - never
 * 120 times a second.
 */
export function useGameSnapshot(store: Store<GameSnapshot>): GameSnapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

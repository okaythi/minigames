import { createRandom, entropySeed } from '../../lib/random'
import { createStore, type Store } from '../../lib/observable-store'
import { AudioEngine } from './engine/audio/audio-engine'
import { AvoidSession } from './engine/session'
import { attachAvoidGame } from './create-avoid-game'
import { createSnapshot, type AvoidSnapshot } from './state'
import { AVOID_SLUG } from './manifest'
import type { GameViewFactory } from '../runtime/types'

/**
 * One object that owns everything the game needs outside React: the seeded
 * random source, the audio engine, the session and the HUD store.
 *
 * Creation is side-effect free (the AudioContext only exists after a gesture),
 * which makes it safe under StrictMode's double render.
 */

export interface AvoidRuntimeStats {
  readonly personalBest: number | null
  readonly candy: number
  readonly beginRun: (slug: string) => void
  readonly finishRun: (slug: string, score: number) => void
  readonly bankCandy: (slug: string, amount: number) => void
}

export interface AvoidRuntime {
  readonly store: Store<AvoidSnapshot>
  readonly session: AvoidSession
  readonly audio: AudioEngine
  readonly attach: GameViewFactory
  readonly dispose: () => void
}

export function createAvoidRuntime(stats: { current: AvoidRuntimeStats }): AvoidRuntime {
  const store = createStore<AvoidSnapshot>(createSnapshot())
  const audio = new AudioEngine({
    onMutedChange: () => {
      store.update((snapshot) => ({ ...snapshot, muted: audio.isMuted }))
    },
  })
  const random = createRandom(entropySeed())

  const session = new AvoidSession({
    audio,
    random,
    best: stats.current.personalBest,
    candyBank: stats.current.candy,
    publish: (snapshot) => {
      store.set(snapshot)
    },
    onRunStarted: () => {
      stats.current.beginRun(AVOID_SLUG)
    },
    onRunFinished: (result) => {
      stats.current.finishRun(AVOID_SLUG, result.score)
    },
    onCandy: (delta) => {
      stats.current.bankCandy(AVOID_SLUG, delta)
    },
  })

  store.set({ ...session.snapshotValue, muted: audio.isMuted })

  return {
    store,
    session,
    audio,
    attach: (host) => attachAvoidGame(host, session),
    dispose: () => {
      audio.dispose()
    },
  }
}

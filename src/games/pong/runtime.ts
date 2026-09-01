import { createStore } from '../../lib/observable-store'
import type { GameSnapshot } from '../template/snapshot'
import type { GameRuntime, GameRuntimeDeps } from '../template/types'
import { emptyGameSnapshot } from '../template/snapshot'
import { PongEngine } from './engine/engine'
import { attachPongRender } from './render/render'
import { AudioEngine } from './engine/audio/audio-engine'

export function createPongRuntime(deps: { readonly current: GameRuntimeDeps }): GameRuntime {
  const store = createStore<GameSnapshot>(emptyGameSnapshot())

  const audio = new AudioEngine({
    onMutedChange: () => {
      store.update((snapshot) => ({ ...snapshot, muted: audio.isMuted }))
    },
  })

  const engine = new PongEngine(deps, store, audio)

  return {
    store,
    actions: {
      primary: () => engine.start(),
      pause: () => engine.pause(),
      resume: () => engine.resume(),
      restart: () => engine.restart(),
      toggleMute: () => engine.toggleMute(),
    },
    attach: (host) => attachPongRender(engine, host),
    dispose: () => {
      engine.dispose()
      audio.dispose()
    },
  }
}


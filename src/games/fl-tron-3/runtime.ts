import { createStore } from '../../lib/observable-store'
import type { GameSnapshot } from '../template/snapshot'
import type { GameRuntime, GameRuntimeDeps } from '../template/types'
import { emptyGameSnapshot } from '../template/snapshot'
import { TronEngine } from './engine/engine'
import { TronAudioEngine } from './engine/audio/audio-engine'
import { TronAchievementTracker } from './achievement-tracker'
import { getAchievementBus } from '../../lib/achievement-bus'
import { attachTronGame } from './create-tron-game'

export function createTronRuntime(deps: { readonly current: GameRuntimeDeps }): GameRuntime {
  const store = createStore<GameSnapshot>(emptyGameSnapshot())
  const achievementTracker = new TronAchievementTracker(getAchievementBus())

  const audio = new TronAudioEngine({
    onMutedChange: () => {
      store.update((snapshot) => ({ ...snapshot, muted: audio.isMuted }))
    },
  })

  const engine = new TronEngine(deps, store, audio, achievementTracker)

  return {
    store,
    actions: {
      primary: () => engine.start(),
      pause: () => engine.pause(),
      resume: () => engine.resume(),
      restart: () => engine.restart(),
      toggleMute: () => engine.toggleMute(),
    },
    attach: (host) => attachTronGame(host, engine),
    dispose: () => {
      engine.dispose()
      audio.dispose()
    },
  }
}

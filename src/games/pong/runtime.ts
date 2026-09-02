import { createStore } from '../../lib/observable-store'
import type { GameSnapshot } from '../template/snapshot'
import type { GameRuntime, GameRuntimeDeps } from '../template/types'
import { emptyGameSnapshot } from '../template/snapshot'
import { PongEngine } from './engine/engine'
import { PongAchievementTracker } from './achievement-tracker'
import { getAchievementBus } from '../../lib/achievement-bus'
import { attachPongGame } from './create-pong-game'
import { AudioEngine } from './engine/audio/audio-engine'

export function createPongRuntime(deps: { readonly current: GameRuntimeDeps }): GameRuntime {
  const store = createStore<GameSnapshot>(emptyGameSnapshot())
  const achievementTracker = new PongAchievementTracker(getAchievementBus())

  const audio = new AudioEngine({
    onMutedChange: () => {
      store.update((snapshot) => ({ ...snapshot, muted: audio.isMuted }))
    },
  })

  const engine = new PongEngine(deps, store, audio, achievementTracker)

  return {
    store,
    actions: {
      primary: () => engine.start(),
      pause: () => engine.pause(),
      resume: () => engine.resume(),
      restart: () => engine.restart(),
      toggleMute: () => engine.toggleMute(),
    },
    attach: (host) => attachPongGame(host, engine),
    dispose: () => {
      engine.dispose()
      audio.dispose()
    },
  }
}

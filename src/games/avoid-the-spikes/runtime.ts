import { createRandom, entropySeed } from '../../lib/random'
import { createStore } from '../../lib/observable-store'
import { getAchievementBus } from '../../lib/achievement-bus'
import { AudioEngine } from './engine/audio/audio-engine'
import { AvoidSession } from './engine/session'
import { AvoidAchievementTracker } from './achievement-tracker'
import { attachAvoidGame } from './create-avoid-game'
import { createSnapshot } from './state'
import { describe } from './view-model'
import type { GameSnapshot } from '../template/snapshot'
import type { GameRuntime, GameRuntimeDeps } from '../template/types'

/**
 * Everything the game needs outside React: the seeded random source, the audio
 * engine, the session, and the store the shared chrome renders.
 *
 * Creation is side-effect free (the AudioContext only exists after a gesture),
 * which makes it safe under StrictMode's double render.
 */
export function createAvoidRuntime(deps: { readonly current: GameRuntimeDeps }): GameRuntime {
  const store = createStore<GameSnapshot>(describe(createSnapshot()))
  const audio = new AudioEngine({
    onMutedChange: () => {
      store.update((snapshot) => ({ ...snapshot, muted: audio.isMuted }))
    },
  })
  const random = createRandom(entropySeed())
  const achievementTracker = new AvoidAchievementTracker(getAchievementBus())

  const session = new AvoidSession({
    audio,
    random,
    best: deps.current.best,
    candyBank: deps.current.bonus,
    publish: (snapshot) => {
      store.set(describe(snapshot))
    },
    onRunStarted: () => {
      achievementTracker.onRunStarted()
      deps.current.beginRun()
    },
    onRunFinished: (result) => {
      achievementTracker.onRunFinished(result)
      deps.current.finishRun(result.score)
    },
    onCandy: (delta) => {
      deps.current.bankBonus(delta)
    },
    onBounce: (score, moversLive, now) => {
      achievementTracker.onBounce(score, moversLive, now)
    },
    onFlap: () => {
      achievementTracker.onFlap()
    },
    onGraze: (playerY) => {
      achievementTracker.onGraze(playerY)
    },
    onFrame: (playerY) => {
      achievementTracker.onFrame(playerY)
    },
    onCandyCollected: (runTotal, lifetimeTotal) => {
      achievementTracker.onCandy(runTotal, lifetimeTotal)
    },
    onMoverDodge: (count) => {
      achievementTracker.onMoverDodge(count)
    },
    onMoversDestroyed: (count) => {
      achievementTracker.onMoversDestroyed(count)
    },
  })

  store.set(describe(session.snapshotValue))

  return {
    store,
    actions: {
      primary: () => session.primary(),
      // The chrome only ever pauses; resuming is the player's decision.
      pause: () => session.autoPause(),
      resume: () => session.resume(),
      restart: () => session.restart(),
      toggleMute: () => session.toggleMute(),
    },
    attach: (host) => attachAvoidGame(host, session),
    dispose: () => {
      audio.dispose()
    },
  }
}


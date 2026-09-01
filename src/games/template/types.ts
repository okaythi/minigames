import type { Store } from '../../lib/observable-store'
import type { GameViewFactory } from '../runtime/types'
import type { GameSnapshot } from './snapshot'

/**
 * The contract between the shared chrome and a game. A game supplies one of
 * these objects and gets the whole page: canvas host, readout panel, overlay
 * cards, pause-on-scroll-away, and the stats wiring. It never writes JSX.
 */

/** The five things any game's chrome is allowed to ask of an engine. */
export interface GameActions {
  /** The one-button verb: start, flap, continue - whatever the game means by it. */
  readonly primary: () => void
  readonly pause: () => void
  readonly resume: () => void
  readonly restart: () => void
  readonly toggleMute: () => void
}

/**
 * What a game may read from the site: its player's own history, plus the two
 * reporting hooks. The template keeps this in a ref, so a runtime created once
 * never captures a stale value.
 */
export interface GameFinishDetails {
  /** Optional progression metadata for games whose score has a mode or difficulty. */
  readonly difficulty?: string
  readonly won?: boolean
}

export interface GameRuntimeDeps {
  readonly best: number | null
  readonly bonus: number
  readonly completedDifficulties: readonly string[]
  readonly beginRun: () => void
  readonly finishRun: (score: number, details?: GameFinishDetails) => void
  readonly bankBonus: (amount: number) => void
}

export interface GameRuntime {
  /** Immutable view model the HUD and overlay render. */
  readonly store: Store<GameSnapshot>
  readonly actions: GameActions
  /** Canvas host hook-up, handed to `<GameSurface>`. */
  readonly attach: GameViewFactory
  /** Called on unmount: release audio, listeners, anything the engine owns. */
  readonly dispose: () => void
}

/**
 * A game's one exported function. `deps` is a live ref, not a snapshot - read
 * `deps.current` whenever the engine needs the player's current best.
 */
export type GameRuntimeFactory = (deps: { readonly current: GameRuntimeDeps }) => GameRuntime

import type { GameModule } from '../types'
import { avoidTheSpikesManifest } from './manifest'
import { AvoidTheSpikesView } from './avoid-the-spikes-view'

/** What the registry sees: a manifest and a React view. Nothing else escapes. */
export const avoidTheSpikes: GameModule = {
  manifest: avoidTheSpikesManifest,
  View: AvoidTheSpikesView,
}

export { AVOID_SLUG, avoidTheSpikesManifest } from './manifest'

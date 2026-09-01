import type { GameModule } from '../types'
import { avoidTheSpikesManifest } from './manifest'
import { createAvoidRuntime } from './runtime'

/**
 * What the registry sees: the words and pictures the site displays, plus the
 * factory behind the shared chrome. Nothing else escapes the folder.
 */
export const avoidTheSpikes: GameModule = {
  manifest: avoidTheSpikesManifest,
  createRuntime: createAvoidRuntime,
}

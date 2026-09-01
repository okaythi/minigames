import type { GameModule } from '../types'
import { pongManifest } from './manifest'
import { createPongRuntime } from './runtime'

export const pong: GameModule = {
  manifest: pongManifest,
  createRuntime: createPongRuntime,
}

import { GameTemplate } from '../template/game-template'
import { avoidTheSpikesManifest } from './manifest'
import { createAvoidRuntime } from './runtime'

export default function AvoidTheSpikesGame() {
  return <GameTemplate game={{ manifest: avoidTheSpikesManifest, createRuntime: createAvoidRuntime }} />
}

import { GameTemplate } from '../template/game-template'
import { pongManifest } from './manifest'
import { createPongRuntime } from './runtime'

export default function PongGame() {
  return <GameTemplate game={{ manifest: pongManifest, createRuntime: createPongRuntime }} />
}

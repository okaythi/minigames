import { GameTemplate } from '../template/game-template'
import { flTron3Manifest } from './manifest'
import { createTronRuntime } from './runtime'

export default function FLTron3Game() {
  return <GameTemplate game={{ manifest: flTron3Manifest, createRuntime: createTronRuntime }} />
}

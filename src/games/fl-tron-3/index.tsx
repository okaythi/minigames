import { GameTemplate } from '../template/game-template'
import { flTron3Manifest } from './manifest'
import { createTronRuntime } from './runtime'

import { type GameSnapshot } from '../template/snapshot'

import { QuantumHologram } from '../../components/quantum-hologram'

function renderLeftImage(snapshot: GameSnapshot) {
  const { customState } = snapshot
  if (!customState) return null
  
  const { level, phase } = customState

  let stateName: 'determined' | 'mad' | 'sad' | 'smug' = 'determined'
  
  if (phase === 'game_over') {
    stateName = 'smug' // AI won
  } else if (phase === 'victory') {
    stateName = 'sad' // AI lost
  } else {
    // Normal state, pre-game, during game
    if (level === 6) {
      stateName = 'mad'
    } else {
      stateName = 'determined'
    }
  }

  return (
    <div style={{ flex: 1, position: 'relative', width: '264px' }}>
      <QuantumHologram stateName={stateName} />
    </div>
  )
}

export default function FLTron3Game() {
  return <GameTemplate game={{ manifest: flTron3Manifest, createRuntime: createTronRuntime }} renderLeft={renderLeftImage} />
}

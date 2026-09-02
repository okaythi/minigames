import { GameTemplate } from '../template/game-template'
import { flTron3Manifest } from './manifest'
import { createTronRuntime } from './runtime'

import { type GameSnapshot } from '../template/snapshot'

function renderLeftImage(snapshot: GameSnapshot) {
  const { customState } = snapshot
  if (!customState) return null
  
  const { level, phase } = customState
  // phase can be 'victory', 'game_over', 'ready', 'playing' etc.
  // We need to map to the correct image.
  // Normal state, pre-game, during game; levels 0-5: Determined
  // Normal state, level 6: Mad
  // AI Won (Player Death): Smug
  // AI Level 6 (Final Boss): Mad
  // AI Lost (Campaign Victory): Sad

  let imageName = 'determined'
  
  if (phase === 'game_over') {
    imageName = 'smug' // AI won
  } else if (phase === 'victory') {
    imageName = 'sad' // AI lost
  } else {
    // Normal state, pre-game, during game
    if (level === 6) {
      imageName = 'mad'
    } else {
      imageName = 'determined'
    }
  }

  // "AI Level 6 (Final Boss): Mad" - wait, if phase is game_over at level 6, should it be smug or mad?
  // Let's assume AI won at level 6 -> Smug, but prompt says "AI Level 6 (Final Boss): Mad" which might mean always Mad at level 6?
  // Let's refine based on "Normal state, level 6: Mad", "AI Level 6 (Final Boss): Mad" implies maybe Level 6 is always Mad except if AI lost (Sad) or AI won (Smug)?
  // Actually, "AI Level 6 (Final Boss): Mad" is just stating that the AI for level 6 is the final boss and they are mad.
  
  const src = `/images/ai/${imageName}.png`

  return (
    <div style={{ flex: 1, position: 'relative', width: '220px' }}>
      <img 
        src={src} 
        alt="" 
        draggable={false}
        data-protected-image="true"
        style={{ 
          position: 'absolute',
          bottom: 0,
          right: 0,
          maxHeight: '60%',
          objectFit: 'contain',
          objectPosition: 'bottom right',
          display: 'block',
          pointerEvents: 'none',
          userSelect: 'none',
        }} 
      />
      {/* Invisible shield to block inspect element and direct image interactions */}
      <div 
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          cursor: 'default',
          background: 'transparent',
          pointerEvents: 'auto'
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDragStart={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      />
    </div>
  )
}

export default function FLTron3Game() {
  return <GameTemplate game={{ manifest: flTron3Manifest, createRuntime: createTronRuntime }} renderLeft={renderLeftImage} />
}

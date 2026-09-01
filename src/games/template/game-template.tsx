import type { CSSProperties } from 'react'
import { accentOf } from '../../theme/palette'
import type { GameManifest } from '../types'
import type { GameRuntimeFactory } from './types'
import { GameStage } from './game-stage'
import { GameHud } from './game-hud'
import { GameOverlay } from './game-overlay'
import { useGameRuntime, useGameSnapshot } from './use-game-runtime'
import './game-template.css'

interface GameTemplateProps {
  readonly game: {
    readonly manifest: GameManifest
    readonly createRuntime: GameRuntimeFactory
  }
}

/**
 * Every game page on the site is this component. A game brings a manifest and a
 * runtime and gets the playfield, the readout, the overlay cards, auto-pause,
 * mute and the stats round trip - all pixel-identical to its neighbours,
 * because there is exactly one place where any of it is drawn.
 */
export function GameTemplate({ game }: GameTemplateProps) {
  const runtime = useGameRuntime(game.manifest, game.createRuntime)
  const snapshot = useGameSnapshot(runtime.store)
  const style = { '--nx-accent': accentOf(game.manifest.accent).base } as CSSProperties

  return (
    <div className="nx-play" style={style}>
      <GameStage runtime={runtime} manifest={game.manifest}>
        <GameOverlay runtime={runtime} manifest={game.manifest} snapshot={snapshot} />
      </GameStage>
      <GameHud manifest={game.manifest} snapshot={snapshot} />
    </div>
  )
}

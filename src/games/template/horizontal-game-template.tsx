import type { CSSProperties, ReactNode } from 'react'
import { accentOf } from '../../theme/palette'
import type { GameManifest } from '../types'
import type { GameRuntimeFactory } from './types'
import { GameStage } from './game-stage'
import { GameOverlay } from './game-overlay'
import { useGameRuntime, useGameSnapshot } from './use-game-runtime'
import type { GameSnapshot } from './snapshot'
import { compactCount } from '../../lib/format'
import './horizontal-game-template.css'

interface HorizontalGameTemplateProps {
  readonly game: {
    readonly manifest: GameManifest
    readonly createRuntime: GameRuntimeFactory
  }
  /** Optional custom stage replacing the default Canvas stage (e.g. for Flash/Ruffle) */
  readonly renderCustomStage?: (runtime: ReturnType<typeof useGameRuntime>, snapshot: GameSnapshot) => ReactNode
  /** Custom UI rendered immediately under the stage */
  readonly renderUnderStage?: (snapshot: GameSnapshot) => ReactNode
  /** Custom HUD replacement or supplement */
  readonly renderCustomHud?: (snapshot: GameSnapshot) => ReactNode
  /** Custom controls/panels rendered below the HUD */
  readonly renderBottom?: (snapshot: GameSnapshot) => ReactNode
}

/**
 * Dedicated Horizontal Game Template for widescreen horizontal minigames.
 * Renders the widescreen stage across the primary lane, with all HUD readouts,
 * statistics, controls, and difficulty settings stacked neatly underneath.
 */
export function HorizontalGameTemplate({
  game,
  renderCustomStage,
  renderUnderStage,
  renderCustomHud,
  renderBottom,
}: HorizontalGameTemplateProps) {
  const runtime = useGameRuntime(game.manifest, game.createRuntime)
  const snapshot = useGameSnapshot(runtime.store)
  const style = {
    '--nx-accent': accentOf(game.manifest.accent).base,
  } as CSSProperties

  return (
    <div className="nx-horizontal-play-container" style={style}>
      <div className="nx-horizontal-stage-wrapper">
        {renderCustomStage ? (
          renderCustomStage(runtime, snapshot)
        ) : (
          <GameStage runtime={runtime} manifest={game.manifest}>
            <GameOverlay runtime={runtime} manifest={game.manifest} snapshot={snapshot} />
          </GameStage>
        )}
      </div>

      {renderUnderStage && renderUnderStage(snapshot)}

      <div className="nx-horizontal-bottom-strip">
        {renderCustomHud ? (
          renderCustomHud(snapshot)
        ) : (
          <dl className="nx-horizontal-hud-bar">
            <div className="nx-horizontal-hud-cell">
              <dt>{game.manifest.scoreLabel}</dt>
              <dd>
                {game.manifest.formatScore !== undefined
                  ? game.manifest.formatScore(snapshot.score)
                  : snapshot.score}
              </dd>
            </div>
            <div className="nx-horizontal-hud-cell">
              <dt>{game.manifest.formatScore !== undefined ? 'Best' : 'Highscore'}</dt>
              <dd>
                {game.manifest.formatScore !== undefined
                  ? game.manifest.formatScore(snapshot.best)
                  : snapshot.best === null
                    ? '—'
                    : snapshot.best}
              </dd>
            </div>
            <div className="nx-horizontal-hud-cell">
              <dt>{game.manifest.bonusLabel}</dt>
              <dd>
                <span>🍬</span>
                <span>{compactCount(snapshot.bonus)}</span>
              </dd>
            </div>
            <div className="nx-horizontal-hud-cell">
              <dt>Status</dt>
              <dd style={{ fontSize: '15px' }}>
                <span className="nx-hud-sub">
                  {snapshot.status === 'running'
                    ? 'In Match'
                    : snapshot.status === 'paused'
                      ? 'Paused'
                      : snapshot.status === 'over'
                        ? 'Match Complete'
                        : 'Ready'}
                </span>
              </dd>
            </div>
          </dl>
        )}

        {renderBottom && renderBottom(snapshot)}
      </div>
    </div>
  )
}

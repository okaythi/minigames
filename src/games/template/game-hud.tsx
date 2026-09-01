import type { GameManifest } from '../types'
import type { GameRuntime } from './types'
import type { GameSnapshot } from './snapshot'

interface GameHudProps {
  readonly runtime: GameRuntime
  readonly manifest: GameManifest
  readonly snapshot: GameSnapshot
}
/**
 * The readout panel every game gets: the live score, whatever tiles the engine
 * published, the state tags, the three controls, and the game's own key list.
 */
export function GameHud({ runtime, manifest, snapshot }: GameHudProps) {
  return (
    <aside className="nx-play-hud" aria-label="Run readout">
      <div className="nx-play-score">
        <span className="nx-eyebrow">{manifest.scoreLabel}</span>
        <strong className="nx-play-score-value" aria-live="polite" aria-atomic="true">
          {snapshot.score}
        </strong>
        <span className="nx-play-score-sub">
          {snapshot.best === null ? 'no personal best yet' : `your best · ${snapshot.best}`}
        </span>
      </div>

      <dl className="nx-play-stats">
        {snapshot.tiles.map((tile) => (
          <div className="nx-play-stat" key={tile.label}>
            <dt>{tile.label}</dt>
            <dd>
              {tile.value}
              <span> {tile.note}</span>
            </dd>
          </div>
        ))}
      </dl>

      <dl className="nx-play-controls">
        {manifest.controls.map((control) => (
          <div key={control.input}>
            <dt>
              <kbd>{control.input}</kbd>
            </dt>
            <dd>{control.action}</dd>
          </div>
        ))}
      </dl>

      <p className="nx-play-tip">{manifest.tip}</p>
    </aside>
  )
}

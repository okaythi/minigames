import { Button } from '../../components/ui/button'
import { compactCount, formatSeconds } from '../../lib/format'
import type { GameManifest } from '../types'
import type { GameRuntime } from './types'
import type { GameSnapshot } from './snapshot'

interface GameOverlayProps {
  readonly runtime: GameRuntime
  readonly manifest: GameManifest
  readonly snapshot: GameSnapshot
}

/**
 * The card that sits on top of the canvas while you are not playing. The scrim
 * itself ignores the pointer, so a click anywhere still reaches the game.
 */
export function GameOverlay({ runtime, manifest, snapshot }: GameOverlayProps) {
  if (snapshot.status === 'running') {
    return null
  }
  if (snapshot.status === 'over') {
    const result = snapshot.run
    return (
      <div className="nx-play-overlay">
        <div className="nx-play-card" data-variant="over">
          <p className="nx-eyebrow">Run over</p>
          <h3>{result === null ? 'Ouch.' : result.note}</h3>
          <dl className="nx-play-card-stats">
            <div>
              <dt>{manifest.scoreLabel}</dt>
              <dd>{snapshot.score}</dd>
            </div>
            <div>
              <dt>{manifest.bonusLabel}</dt>
              <dd>{result === null ? 0 : compactCount(result.bonus)}</dd>
            </div>
            {manifest.runDurationLabel !== undefined && (
              <div>
                <dt>{manifest.runDurationLabel}</dt>
                <dd>{result === null ? '0s' : formatSeconds(result.seconds)}</dd>
              </div>
            )}
            <div>
              <dt>Your best</dt>
              <dd>{snapshot.best ?? 0}</dd>
            </div>
          </dl>
          {result?.isRecord === true && (
            <p className="nx-play-record" role="status">
              New personal best
              {result.beatBestBy !== null && result.beatBestBy > 0 ? ` by ${result.beatBestBy}` : ''}
              .
            </p>
          )}
          <div className="nx-play-card-actions">
            <Button variant="primary" size="large" onClick={() => runtime.actions.restart()}>
              Play again
            </Button>
            <span className="nx-play-card-hint">
              or press <kbd>Enter</kbd>
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (snapshot.status === 'paused') {
    return (
      <div className="nx-play-overlay">
        <div className="nx-play-card" data-variant="paused">
          <p className="nx-eyebrow">Paused</p>
          <h3>Take your time.</h3>
          <p className="nx-play-card-body">{manifest.pauseNote}</p>
          <div className="nx-play-card-actions">
            <Button variant="primary" size="large" onClick={() => runtime.actions.resume()}>
              Resume
            </Button>
            <span className="nx-play-card-hint">
              or press <kbd>P</kbd>
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="nx-play-overlay">
      <div className="nx-play-card" data-variant="ready">
        <p className="nx-eyebrow">{manifest.title}</p>
        <h3>{manifest.startLine}</h3>
        <p className="nx-play-card-body">{manifest.intro}</p>
        {manifest.legend.length > 0 && (
          <ul className="nx-play-card-legend">
            {manifest.legend.map((item) => (
              <li key={item.text}>
                <i data-swatch={item.swatch} />
                {item.text}
              </li>
            ))}
          </ul>
        )}
        <div className="nx-play-card-actions">
          <Button variant="primary" size="large" onClick={() => runtime.actions.primary()}>
            Start
          </Button>
          <span className="nx-play-card-hint">best {snapshot.best ?? 0}</span>
        </div>
      </div>
    </div>
  )
}

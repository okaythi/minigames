import { Button } from '../../components/ui/button'
import { Tag } from '../../components/ui/tag'
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
  const running = snapshot.status === 'running'
  const primaryLabel =
    snapshot.status === 'paused' ? 'Resume' : running ? manifest.primaryLabel : 'Start'

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

      {snapshot.badges.length > 0 && (
        <p className="nx-play-difficulty">
          {snapshot.badges.map((badge) => (
            <Tag key={badge}>{badge}</Tag>
          ))}
        </p>
      )}

      <div className="nx-play-actions">
        <Button
          variant={running ? 'default' : 'primary'}
          onClick={() => {
            if (snapshot.status === 'paused') {
              runtime.actions.resume()
            } else {
              runtime.actions.primary()
            }
          }}
        >
          {primaryLabel}
        </Button>
        <Button onClick={() => runtime.actions.restart()}>Restart</Button>
        <Button
          variant="ghost"
          aria-pressed={!snapshot.muted}
          onClick={() => runtime.actions.toggleMute()}
        >
          <SpeakerIcon muted={snapshot.muted} />
          {snapshot.muted ? 'Unmute' : 'Mute'}
        </Button>
      </div>

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

function SpeakerIcon({ muted }: { readonly muted: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3 6.2h2.2L8.4 3.4v9.2L5.2 9.8H3z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="m11 6 3.2 4M14.2 6 11 10"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M10.8 5.6a3.4 3.4 0 0 1 0 4.8M12.6 4a5.6 5.6 0 0 1 0 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

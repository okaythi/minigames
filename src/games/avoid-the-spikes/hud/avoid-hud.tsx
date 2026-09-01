import type { CSSProperties } from 'react'
import { compactCount, formatSeconds } from '../../../lib/format'
import { accentOf } from '../../../theme/palette'
import { Button } from '../../../components/ui/button'
import { Tag } from '../../../components/ui/tag'
import { useAvoidSnapshot } from '../use-avoid-snapshot'
import { avoidTheSpikesManifest } from '../manifest'
import type { AvoidRuntime } from '../runtime'

interface AvoidHudProps {
  readonly runtime: AvoidRuntime
}

/** Side panel: the live readout plus the only three controls the game has. */
export function AvoidHud({ runtime }: AvoidHudProps) {
  const snapshot = useAvoidSnapshot(runtime.store)
  const accent = accentOf(avoidTheSpikesManifest.accent)
  const running = snapshot.status === 'running'
  const style = { '--nx-accent': accent.base } as CSSProperties

  return (
    <aside className="avoid-hud" aria-label="Run readout">
      <div className="avoid-score" style={style}>
        <span className="nx-eyebrow">Bounces</span>
        <strong className="avoid-score-value" aria-live="polite" aria-atomic="true">
          {snapshot.score}
        </strong>
        <span className="avoid-score-sub">
          {snapshot.best === null ? 'no personal best yet' : `your best · ${snapshot.best}`}
        </span>
      </div>

      <dl className="avoid-stats">
        <div className="avoid-stat">
          <dt>Candy bank</dt>
          <dd>
            {compactCount(snapshot.candyBank)}
            <span> kept</span>
          </dd>
        </div>
        <div className="avoid-stat">
          <dt>Speed</dt>
          <dd>
            ×{snapshot.speedFactor.toFixed(3)}
            <span> cruise</span>
          </dd>
        </div>
        <div className="avoid-stat">
          <dt>Armed teeth</dt>
          <dd>
            {snapshot.hazardsArmed}
            <span> on the far wall</span>
          </dd>
        </div>
        <div className="avoid-stat">
          <dt>Last run</dt>
          <dd>
            {snapshot.lastRun === null ? '—' : formatSeconds(snapshot.lastRun.seconds)}
            <span> alive</span>
          </dd>
        </div>
      </dl>

      <p className="avoid-difficulty">
        <Tag>{snapshot.difficulty}</Tag>
        {snapshot.moversLive > 0 && <Tag>{snapshot.moversLive} floating</Tag>}
        {snapshot.candyRun > 0 && <Tag>{snapshot.candyRun} grabbed</Tag>}
      </p>

      <div className="avoid-actions">
        <Button
          variant={running ? 'default' : 'primary'}
          onClick={() => {
            if (snapshot.status === 'paused') {
              runtime.session.resume()
            } else {
              runtime.session.primary()
            }
          }}
        >
          {running ? 'Flap' : snapshot.status === 'paused' ? 'Resume' : 'Start'}
        </Button>
        <Button onClick={() => runtime.session.restart()}>Restart</Button>
        <Button
          variant="ghost"
          aria-pressed={!snapshot.muted}
          onClick={() => runtime.session.toggleMute()}
        >
          <SpeakerIcon muted={snapshot.muted} />
          {snapshot.muted ? 'Unmute' : 'Mute'}
        </Button>
      </div>

      <dl className="avoid-controls">
        {avoidTheSpikesManifest.controls.map((control) => (
          <div key={control.input}>
            <dt>
              <kbd>{control.input}</kbd>
            </dt>
            <dd>{control.action}</dd>
          </div>
        ))}
      </dl>

      <p className="avoid-tip">
        Every bounce arms the wall you are heading to next. Watch the orange
        teeth, not the ones behind you.
      </p>
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
        <path d="m11 6 3.2 4M14.2 6 11 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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

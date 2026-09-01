import type { CSSProperties } from 'react'
import { Button } from '../../../components/ui/button'
import { compactCount, formatSeconds } from '../../../lib/format'
import { accentOf } from '../../../theme/palette'
import { DEATH_COPY } from '../state'
import { useAvoidSnapshot } from '../use-avoid-snapshot'
import { avoidTheSpikesManifest } from '../manifest'
import { MOVERS } from '../engine/config'
import type { AvoidRuntime } from '../runtime'

interface AvoidOverlayProps {
  readonly runtime: AvoidRuntime
}

/** The card that sits on top of the canvas while you are not flying. */
export function AvoidOverlay({ runtime }: AvoidOverlayProps) {
  const snapshot = useAvoidSnapshot(runtime.store)
  if (snapshot.status === 'running') {
    return null
  }

  const accent = accentOf(avoidTheSpikesManifest.accent)
  const style = { '--nx-accent': accent.base } as CSSProperties

  if (snapshot.status === 'over') {
    const result = snapshot.lastRun
    return (
      <div className="avoid-overlay" style={style}>
        <div className="avoid-card" data-variant="over">
          <p className="nx-eyebrow">Run over</p>
          <h3>{result === null ? 'Ouch.' : DEATH_COPY[result.cause]}</h3>
          <dl className="avoid-card-stats">
            <div>
              <dt>Bounces</dt>
              <dd>{snapshot.score}</dd>
            </div>
            <div>
              <dt>Candy</dt>
              <dd>{result === null ? 0 : compactCount(result.candy)}</dd>
            </div>
            <div>
              <dt>Alive for</dt>
              <dd>{result === null ? '0s' : formatSeconds(result.seconds)}</dd>
            </div>
            <div>
              <dt>Your best</dt>
              <dd>{snapshot.best ?? 0}</dd>
            </div>
          </dl>
          {result?.isRecord === true && (
            <p className="avoid-record" role="status">
              New personal best{result.beatBestBy !== null && result.beatBestBy > 0 ? ` by ${result.beatBestBy}` : ''}.
            </p>
          )}
          <div className="avoid-card-actions">
            <Button variant="primary" size="large" onClick={() => runtime.session.restart()}>
              Play again
            </Button>
            <span className="avoid-card-hint">
              or press <kbd>Enter</kbd>
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (snapshot.status === 'paused') {
    return (
      <div className="avoid-overlay" style={style}>
        <div className="avoid-card" data-variant="paused">
          <p className="nx-eyebrow">Paused</p>
          <h3>Take your time.</h3>
          <p className="avoid-card-body">
            Bounce off a wall for +1. Landing on a tooth, the ceiling or the floor
            ends the run.
          </p>
          <div className="avoid-card-actions">
            <Button variant="primary" size="large" onClick={() => runtime.session.resume()}>
              Resume
            </Button>
            <span className="avoid-card-hint">
              press <kbd>P</kbd> or <kbd>Space</kbd>
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="avoid-overlay" style={style}>
      <div className="avoid-card" data-variant="ready">
        <p className="nx-eyebrow">{avoidTheSpikesManifest.title}</p>
        <h3>Click, tap or hit Space to flap.</h3>
        <p className="avoid-card-body">
          You fall constantly. A flap throws you up and forward; the walls bounce you
          back and score a point - but each touch grows a new row of spikes on the
          wall you are flying to.
        </p>
        <ul className="avoid-card-legend">
          <li>
            <i data-swatch="graphite" />
            ceiling and floor are always teeth
          </li>
          <li>
            <i data-swatch="orange" />
            wall spikes, re-rolled on every bounce
          </li>
          <li>
            <i data-swatch="red" />
            floating spikes, from {MOVERS.unlockScore} bounces
          </li>
        </ul>
        <div className="avoid-card-actions">
          <Button variant="primary" size="large" onClick={() => runtime.session.primary()}>
            Start
          </Button>
          <span className="avoid-card-hint">best {snapshot.best ?? 0}</span>
        </div>
      </div>
    </div>
  )
}

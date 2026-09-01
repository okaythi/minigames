import { compactCount, formatSeconds } from '../../lib/format'
import type { GameRunSummary, GameSnapshot, GameStatTile } from '../template/snapshot'
import type { DeathCause } from './engine/types'
import type { AvoidRunResult, AvoidSnapshot } from './state'

/**
 * The one translation layer between this engine and the shared chrome.
 *
 * The engine describes itself in snapshots; the chrome reads tiles, badges and
 * a run summary. Everything game-specific about the page - which numbers are
 * worth a slot in the panel, what a death is called - is decided here, in a
 * file with no markup in it.
 */

const DEATH_COPY: Readonly<Record<DeathCause, string>> = {
  wall: 'You landed on a spike. Aim for the gap.',
  ceiling: 'The ceiling is teeth. Cap your climb.',
  floor: 'Gravity wins by default. Flap earlier.',
  mover: 'A floating spike crossed your line.',
}

function tilesFor(snapshot: AvoidSnapshot): readonly GameStatTile[] {
  const tiles: GameStatTile[] = [
    { label: 'Candy bank', value: compactCount(snapshot.candyBank), note: 'kept' },
    { label: 'Speed', value: `×${snapshot.speedFactor.toFixed(3)}`, note: 'cruise' },
    { label: 'Armed teeth', value: `${snapshot.hazardsArmed}`, note: 'on the far wall' },
    {
      label: 'Last run',
      value: snapshot.lastRun === null ? '—' : formatSeconds(snapshot.lastRun.seconds),
      note: 'alive',
    },
  ]
  return tiles
}

function badgesFor(snapshot: AvoidSnapshot): readonly string[] {
  const badges: string[] = [snapshot.difficulty]
  if (snapshot.moversLive > 0) {
    badges.push(`${snapshot.moversLive} floating`)
  }
  if (snapshot.candyRun > 0) {
    badges.push(`${snapshot.candyRun} grabbed`)
  }
  return badges
}

function summaryFor(result: AvoidRunResult | null): GameRunSummary | null {
  if (result === null) {
    return null
  }
  return {
    score: result.score,
    bonus: result.candy,
    seconds: result.seconds,
    note: DEATH_COPY[result.cause],
    isRecord: result.isRecord,
    beatBestBy: result.beatBestBy,
  }
}

export function describe(snapshot: AvoidSnapshot): GameSnapshot {
  return {
    status: snapshot.status,
    score: snapshot.score,
    best: snapshot.best,
    bonus: snapshot.candyBank,
    tiles: tilesFor(snapshot),
    badges: badgesFor(snapshot),
    run: summaryFor(snapshot.lastRun),
    muted: snapshot.muted,
  }
}

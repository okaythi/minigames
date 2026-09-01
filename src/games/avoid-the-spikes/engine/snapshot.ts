import { MOVERS } from './config'
import { difficultyTier, speedFactor } from './speed-curve'
import { createSnapshot, type AvoidSnapshot } from '../state'
import type { AvoidSession } from './session'

/**
 * The one adapter between the simulation and the DOM: engine state in, an
 * immutable HUD snapshot out. Keeping it here means `session.ts` never imports
 * anything React-adjacent, and the snapshot shape has a single owner.
 */
export function snapshotFor(session: AvoidSession): AvoidSnapshot {
  return createSnapshot({
    status: session.status,
    score: session.score,
    best: session.best,
    candyRun: session.candyRun,
    candyBank: session.candyBank,
    difficulty: difficultyTier(session.score),
    speedFactor: speedFactor(session.score),
    moversLive: session.movers.list().length,
    hazardsArmed: session.armedSpikes(session.nextWall).length,
    unlockedMovers: session.score >= MOVERS.unlockScore,
    muted: session.muted,
    lastRun: session.lastRun,
  })
}

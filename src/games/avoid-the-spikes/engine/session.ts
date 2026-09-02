import { ARENA, HAZARDS, PLAYER, PHYSICS, SCORE } from './config'
import { clamp } from '../../../lib/math'
import { createPlayer, advance, advanceTrail, attachToWall, bounce, contactWith, flap } from './player'
import { BoundarySpikeField, WallSpikeField } from './wall-spike-field'
import { createBoundarySpikes } from './spike-factory'
import { MoverField } from './movers'
import { PickupField } from './pickups'
import { Feedback } from './feedback'
import { crossingSeconds } from './speed-curve'
import { snapshotFor } from './snapshot'
import { spikeNormal, playerRect } from './geometry'
import type { IAudioEngine } from '../../../lib/audio-engine'
import type { SfxName } from './audio/sfx'
import type { Random } from '../../../lib/random'
import type { DeathCause, PlayerState, RunStatus, Spike, Vec2, WallSide } from './types'
import type { AvoidRunResult, AvoidSnapshot } from '../state'
import { createSnapshot } from '../state'

/**
 * The run itself: one fixed-step simulation that knows the rules and nothing
 * about React, the DOM or the canvas. Feel lives in `feedback.ts`.
 *
 * What every step checks, in order:
 *  1. gravity + flap impulse (see player.ts)
 *  2. ceiling / floor teeth are instant death
 *  3. a wall contact is either a spike (death) or +1 point and a re-arm of the
 *     opposite wall
 *  4. floating centre spikes kill on contact, once the score has earned them
 *  5. candy is collected, banked, and costs nothing but a routing decision
 */

export interface AvoidSessionDeps {
  readonly audio: IAudioEngine<SfxName>
  readonly random: Random
  readonly best: number | null
  readonly candyBank: number
  readonly developer?: boolean
  readonly publish: (snapshot: AvoidSnapshot) => void
  readonly onRunStarted: () => void
  readonly onRunFinished: (result: AvoidRunResult) => void
  /** Delta, not a total: the shell banks each piece as it is grabbed. */
  readonly onCandy: (amount: number) => void
  /** Optional achievement hooks — called for live per-run tracking. */
  readonly onBounce?: (score: number, moversLive: number, now: number) => void
  readonly onFlap?: () => void
  readonly onGraze?: (playerY: number) => void
  readonly onFrame?: (playerY: number) => void
  readonly onCandyCollected?: (runTotal: number, lifetimeTotal: number) => void
  readonly onMoverDodge?: (dodgesThisRun: number) => void
  readonly onMoversDestroyed?: (count: number) => void
}

export class AvoidSession {
  public readonly player: PlayerState = createPlayer()
  public readonly walls = new WallSpikeField()
  public readonly boundary = new BoundarySpikeField(createBoundarySpikes())
  public readonly movers = new MoverField()
  public readonly pickups = new PickupField()
  public readonly feedback: Feedback

  public readonly isDeveloper: boolean
  public status: RunStatus = 'ready'
  public score = 0
  public elapsed = 0
  public candyRun = 0
  public best: number | null
  public candyBank: number
  public lastRun: AvoidRunResult | null = null
  public muted = false

  private accumulator = 0
  private restartLock = 0
  private candyBufferRoundsRemaining = 0
  private snapshot: AvoidSnapshot

  public constructor(private readonly deps: AvoidSessionDeps) {
    this.isDeveloper = Boolean(deps.developer)
    this.best = deps.best
    this.candyBank = deps.candyBank
    this.feedback = new Feedback(() => deps.random.next())

    this.snapshot = createSnapshot({
      best: this.best,
      candyBank: this.candyBank,
      muted: deps.audio.isMuted,
    })
    attachToWall(this.player, 'left')
  }

  public get snapshotValue(): AvoidSnapshot {
    return this.snapshot
  }

  /** Which wall the pod is heading for; the other one may already be armed. */
  public get nextWall(): WallSide {
    return this.player.heading === 1 ? 'right' : 'left'
  }

  public armedSpikes(side: WallSide): readonly Spike[] {
    return this.walls.spikes(side)
  }

  // --- input -----------------------------------------------------------------

  /** Pointer / Space: starts a run, then flaps. */
  public primary(): void {
    this.deps.audio.unlock()

    if (this.status === 'ready') {
      this.start()
      flap(this.player)
      this.deps.audio.play('flap')
      return
    }
    if (this.status === 'over') {
      if (this.restartLock <= 0) {
        this.start()
      }
      return
    }
    if (this.status !== 'running') {
      this.resume()
      return
    }
    // A flap is deliberately quiet in the FX: squash, sound and forward boost
    // are enough. Only *contacts* get particles.
    if (flap(this.player)) {
      this.deps.audio.play('flap')
      this.deps.onFlap?.()
    }
  }

  public start(): void {
    this.status = 'running'
    this.score = 0
    this.elapsed = 0
    this.candyRun = 0
    this.accumulator = 0
    this.restartLock = 0
    this.candyBufferRoundsRemaining = 0
    this.walls.clear()
    this.movers.reset()
    this.pickups.reset()
    this.feedback.reset()
    attachToWall(this.player, this.player.heading === 1 ? 'left' : 'right')
    this.deps.onRunStarted()
    this.deps.audio.play('start')
    this.publish()
  }

  public restart(): void {
    this.start()
  }

  public togglePause(): void {
    if (this.status === 'running') {
      this.status = 'paused'
      this.publish()
      return
    }
    if (this.status === 'paused') {
      this.resume()
    }
  }

  /** Called by the host on blur / tab hide: never resumes, only pauses. */
  public autoPause(): void {
    if (this.status === 'running') {
      this.status = 'paused'
      this.publish()
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.status = 'running'
      this.accumulator = 0
      this.publish()
    }
  }

  public toggleMute(): void {
    this.muted = this.deps.audio.toggleMuted()
    this.publish()
  }

  // --- simulation --------------------------------------------------------------

  public update(dt: number): void {
    this.restartLock = Math.max(0, this.restartLock - dt)
    const random = () => this.deps.random.next()
    this.feedback.update(dt, random)

    if (this.status !== 'running') {
      this.player.trail = this.player.trail.map((point) => ({ ...point, age: point.age + dt }))
      return
    }
    if (this.feedback.hitStop.consume(dt)) {
      return
    }

    this.accumulator += dt
    let steps = 0
    while (this.accumulator >= PHYSICS.step && steps < PHYSICS.maxStepsPerFrame) {
      this.step(PHYSICS.step)
      this.accumulator -= PHYSICS.step
      steps += 1
      if (this.status !== 'running') {
        this.accumulator = 0
        break
      }
    }
    if (steps === PHYSICS.maxStepsPerFrame) {
      // Never let a slow frame build up a debt of catch-up steps.
      this.accumulator = 0
    }
  }

  private step(dt: number): void {
    this.elapsed += dt
    advance(this.player, dt, this.score)
    advanceTrail(this.player, dt)
    this.walls.update(dt)
    if (this.candyBufferRoundsRemaining === 0) {
      this.movers.sync(this.score, this.player.pos, this.deps.random)
    }
    this.movers.update(dt)
    this.pickups.update(dt, this.player.pos, this.deps.random, (pickup) => {
      this.collect(pickup.pos)
    })

    const rect = playerRect(this.player.pos, PLAYER.width, PLAYER.height)

    const boundaryHit = this.boundary.hits(rect)
    if (boundaryHit !== null) {
      this.die(boundaryHit.surface === 'ceiling' ? 'ceiling' : 'floor')
      return
    }

    if (this.movers.hits(rect) !== null) {
      this.die('mover')
      return
    }

    this.deps.onFrame?.(this.player.pos.y)

    const contact = contactWith(this.player)
    if (contact === null) {
      return
    }
    if (this.walls.hazardAt(contact.side, rect) !== null) {
      this.die('wall')
      return
    }
    this.bounceOff(contact.side, contact.point)
  }

  private bounceOff(side: WallSide, point: Vec2): void {
    this.score += SCORE.perBounce
    bounce(this.player, side, this.score)
    this.walls.spend(side)
    this.armOpposite(side)

    if (this.candyBufferRoundsRemaining > 0) {
      this.candyBufferRoundsRemaining -= 1
    }
    if (this.candyBufferRoundsRemaining === 0) {
      this.movers.sync(this.score, this.player.pos, this.deps.random)
    }

    this.feedback.bounce(point, spikeNormal(side), side, () => this.deps.random.next())
    this.deps.audio.play('bounce')
    this.deps.onBounce?.(this.score, this.movers.list().length, this.elapsed)
    this.publish()
  }

  /**
   * The hazard you must land in is always the one that grew in front of you a
   * second ago. `safeCell` is where the pod is *predicted* to arrive, so the
   * generator can never close the gap you are already committed to.
   */
  private armOpposite(side: WallSide): void {
    if (this.score < HAZARDS.minScoreForSpikes) {
      return
    }
    const aim = clamp(
      this.player.pos.y + this.player.vel.y * crossingSeconds(this.score),
      ARENA.ceilingDepth + PLAYER.height,
      ARENA.height - ARENA.floorDepth - PLAYER.height,
    )
    this.walls.arm(side === 'left' ? 'right' : 'left', this.score, this.deps.random, aim)
  }

  private collect(at: Vec2): void {
    this.candyRun += 1
    this.candyBank += 1
    this.feedback.collect(at, () => this.deps.random.next())
    this.deps.audio.play('candy')

    const activeMovers = this.movers.list()
    if (activeMovers.length > 0) {
      for (const mover of activeMovers) {
        this.feedback.clearMover(mover.pos, () => this.deps.random.next())
      }
      const count = activeMovers.length
      this.movers.clear()
      this.deps.audio.play('dissolve')
      this.deps.onMoversDestroyed?.(count)
    }
    this.candyBufferRoundsRemaining = 2

    this.deps.onCandy(1)
    this.deps.onCandyCollected?.(this.candyRun, this.candyBank)
    this.publish()
  }

  private die(cause: DeathCause): void {
    this.status = 'over'
    this.player.alive = false
    this.restartLock = 0.45
    this.feedback.death({ x: this.player.pos.x, y: this.player.pos.y }, () => this.deps.random.next())
    this.deps.audio.play('death')

    const previousBest = this.best
    const isRecord = previousBest === null || this.score > previousBest
    if (isRecord) {
      this.best = this.score
    }
    this.lastRun = {
      score: this.score,
      candy: this.candyRun,
      seconds: this.elapsed,
      cause,
      isRecord,
      beatBestBy: previousBest === null ? null : Math.max(0, this.score - previousBest),
    }
    this.deps.onRunFinished(this.lastRun)
    this.publish()
  }

  private publish(): void {
    this.snapshot = snapshotFor(this)
    this.deps.publish(this.snapshot)
  }

  /** Read by the host to decide whether losing focus should pause anything. */
  public get busy(): boolean {
    return this.status === 'running'
  }
}

/**
 * Engine invariants for Avoid the Spikes, checked headlessly.
 *
 * `npm run simulate` boots the real `AvoidSession` (physics, spike planning,
 * collisions, pickups, hit-stop, shake) with no canvas and no DOM and asserts
 * the promises the design makes: one point per clean bounce, teeth kill, rows
 * always leave a landable gap, the speed curve stays monotonic and gentle,
 * movers unlock on schedule, nothing goes NaN.
 *
 * This is a regression harness, not a fairness test - a bot flying the game
 * would prove nothing about how it feels in the hand. The renderer is never
 * imported here on purpose.
 */

import { AvoidSession } from '../src/games/avoid-the-spikes/engine/session'
import { createRandom } from '../src/lib/random'
import { ARENA, CANDY, HAZARDS, MOVERS, PHYSICS, PLAYER, SPEED } from '../src/games/avoid-the-spikes/engine/config'
import { cellIndexForY, planWallSpikes } from '../src/games/avoid-the-spikes/engine/spike-factory'
import { wallGrid } from '../src/games/avoid-the-spikes/engine/geometry'
import { bounceSpeed, speedFactor } from '../src/games/avoid-the-spikes/engine/speed-curve'
import { desiredMoverCount } from '../src/games/avoid-the-spikes/engine/movers'
import { PickupField } from '../src/games/avoid-the-spikes/engine/pickups'
import type { AudioEngine } from '../src/games/avoid-the-spikes/engine/audio/audio-engine'
import type { DeathCause, Spike } from '../src/games/avoid-the-spikes/engine/types'

const STEP = 1 / 60
const checks: { readonly name: string; readonly ok: boolean }[] = []
const check = (name: string, ok: boolean): void => {
  checks.push({ name, ok })
}
const line = (label: string, value: string): void => {
  console.log(`${label.padEnd(42)} ${value}`)
}

/** Silences the audio engine without importing the DOM. */
const silentAudio = {
  unlock: () => undefined,
  isMuted: true,
  play: () => undefined,
  setMuted: () => undefined,
  toggleMuted: () => true,
} as unknown as AudioEngine

function bootSession(seed: number): AvoidSession {
  return new AvoidSession({
    audio: silentAudio,
    random: createRandom(seed),
    best: null,
    candyBank: 0,
    publish: () => undefined,
    onRunStarted: () => undefined,
    onRunFinished: () => undefined,
    onCandy: () => undefined,
  })
}

/**
 * A clean contact 24px from the right wall at a score where rows are dense:
 * exactly one point more, and the far wall re-armed.
 */
function scoringProbe(): void {
  const startScore = 40
  let deltas = 0
  let armed = 0
  let firstContact = 0
  for (let seed = 0; seed < 8; seed += 1) {
    const session = bootSession(99 + seed)
    session.start()
    session.score = startScore
    session.player.pos = { x: ARENA.width - PLAYER.halfWidth - 24, y: ARENA.height / 2 }
    session.player.vel = { x: SPEED.base, y: -60 }
    let steps = 0
    while (session.score === startScore && steps < 60 && session.status === 'running') {
      session.update(STEP)
      steps += 1
    }
    deltas += session.score - startScore - 1
    armed += session.armedSpikes('left').length > 0 ? 1 : 0
    firstContact += steps
  }
  line('score delta on a clean wall touch', `8 runs, total overshoot ${deltas} (expected 0)`)
  line('frames to contact', String(Math.round(firstContact / 8)))
  check('exactly one point per bounce', deltas === 0)
  check('bounce arms the opposite wall', armed === 8)
}

/** Flying into a tooth must end the run, not pay out. */
function fatalContactProbe(): void {
  const session = bootSession(1234)
  session.start()
  session.score = 40
  let row: readonly Spike[] = []
  for (let attempt = 0; attempt < 16 && row.length === 0; attempt += 1) {
    row = session.armedSpikes('right')
    if (row.length === 0) {
      session.walls.arm('right', 40, createRandom(500 + attempt), -999)
      session.walls.update(0.5)
      row = session.armedSpikes('right')
    }
  }
  const tooth = row[0]
  if (tooth !== undefined) {
    session.player.pos = { x: ARENA.width - PLAYER.halfWidth - 30, y: tooth.along }
    session.player.vel = { x: 360, y: 0 }
    session.player.heading = 1
  }
  let steps = 0
  while (session.status === 'running' && steps < 60) {
    session.update(STEP)
    steps += 1
  }
  const cause: DeathCause | 'none' = session.lastRun?.cause ?? 'none'
  line('contact with a sprouted tooth', `${cause} (expected wall)`)
  check('landing on teeth is fatal', cause === 'wall')
}

/** The pod may not flap its way out of a ceiling or a floor. */
function boundaryProbe(): void {
  const ceiling = bootSession(7)
  ceiling.start()
  ceiling.player.pos = { x: ARENA.width / 2, y: 60 }
  ceiling.player.vel = { x: 200, y: -900 }
  let up = 0
  while (ceiling.status === 'running' && up < 60) {
    ceiling.update(STEP)
    up += 1
  }
  const floor = bootSession(8)
  floor.start()
  floor.player.pos = { x: ARENA.width / 2, y: ARENA.height - 60 }
  floor.player.vel = { x: 200, y: 400 }
  let down = 0
  while (floor.status === 'running' && down < 60) {
    floor.update(STEP)
    down += 1
  }
  line('flying into the ceiling teeth', ceiling.lastRun?.cause ?? 'survived')
  line('falling into the floor teeth', floor.lastRun?.cause ?? 'survived')
  check('ceiling kills', ceiling.lastRun?.cause === 'ceiling')
  check('floor kills', floor.lastRun?.cause === 'floor')
}

/** A run long enough to reach movers, checking for NaN and stuck states. */
function soakProbe(): void {
  const random = createRandom(2024)
  let worstScore = 0
  let sawNaN = false
  let sawFrozen = false
  for (let seed = 0; seed < 40; seed += 1) {
    const session = bootSession(seed * 31 + 5)
    session.start()
    let stuckFrames = 0
    let lastScore = 0
    for (let frame = 0; frame < 1800 && session.status === 'running'; frame += 1) {
      // Rhythm flapping with noise: enough to cross the arena, dumb enough to
      // eventually die. The point is coverage, not skill.
      if (frame % (5 + Math.floor(random.next() * 24)) === 0) {
        session.primary()
      }
      session.update(STEP)
      const { x, y } = session.player.pos
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(session.score)) {
        sawNaN = true
        break
      }
      stuckFrames = session.score === lastScore ? stuckFrames + 1 : 0
      lastScore = session.score
      if (stuckFrames > 900) {
        sawFrozen = true
        break
      }
    }
    worstScore = Math.max(worstScore, session.score)
  }
  line('soak: 40 scripted runs', `best score ${worstScore}, movers unlocked at ${MOVERS.unlockScore}`)
  check('no non-finite state in soak', !sawNaN)
  check('no stuck/frozen run in soak', !sawFrozen)
}

/** Speed curve: monotonic, bounded, and each step imperceptible. */
function curveProbe(): void {
  const samples = [0, 1, 5, 10, 25, 50, 100, 300].map((score) => bounceSpeed(score))
  const monotonic = samples.every((value, index) => index === 0 || value >= (samples[index - 1] ?? value))
  const bounded = samples.every((value) => value >= SPEED.base && value <= SPEED.max)
  const relativeGainAt = (score: number): number =>
    (bounceSpeed(score + 1) - bounceSpeed(score)) / bounceSpeed(score)
  const first = relativeGainAt(0)
  const hundredth = relativeGainAt(100)
  const decaying = relativeGainAt(0) > relativeGainAt(10) && relativeGainAt(10) > relativeGainAt(100)
  line('cruise speed at 0/10/50/300', samples.map((value) => value.toFixed(0)).join(' / '))
  line('per-bounce gain, 1st vs 100th', `${(first * 100).toFixed(2)}% vs ${(hundredth * 100).toFixed(3)}%`)
  check('speed curve monotonic', monotonic)
  check('speed curve bounded', bounded)
  check('speed ramp is imperceptible per bounce', decaying && first < 0.06)
  check('speed factor readout matches', Math.abs(speedFactor(50) * SPEED.base - bounceSpeed(50)) < 0.001)
}

/** Generated wall rows must always leave a gap wide enough to land in. */
function fairnessProbe(): void {
  const grid = wallGrid()
  const random = createRandom(7)
  let minGapCells = Number.POSITIVE_INFINITY
  let fullyBlocked = 0
  for (let index = 0; index < 5000; index += 1) {
    const spikes = planWallSpikes({
      side: index % 2 === 0 ? 'left' : 'right',
      density: HAZARDS.density.max,
      gapCells: HAZARDS.gapCells.min,
      maxRun: HAZARDS.runCells.max,
      safeCell: Math.floor(random.range(0, grid.cells)),
      random: () => random.next(),
    })
    const blocked = new Set(spikes.map((spike) => cellIndexForY(spike.along)))
    if (blocked.size >= grid.cells) {
      fullyBlocked += 1
    }
    let run = 0
    let gap = 0
    for (let cell = 0; cell < grid.cells; cell += 1) {
      run = blocked.has(cell) ? 0 : run + 1
      gap = Math.max(gap, run)
    }
    minGapCells = Math.min(minGapCells, gap)
  }
  const gapHeight = minGapCells * ARENA.wallPitch
  line('5000 rows at worst-case density', `smallest gap ${minGapCells} cells (${gapHeight}px vs a ${PLAYER.height}px pod)`)
  line('rows with no gap at all', String(fullyBlocked))
  check('every row has a gap', fullyBlocked === 0)
  check('the gap fits the pod', gapHeight >= PLAYER.height * 2)
}

/** Mover budget and unlock point. */
function moverProbe(): void {
  const before = desiredMoverCount(MOVERS.unlockScore - 1)
  const at = desiredMoverCount(MOVERS.unlockScore)
  const late = desiredMoverCount(400)
  line('movers at 10 / 11 / 400 bounces', `${before} / ${at} / ${late} (cap ${MOVERS.maxCount})`)
  check('no movers before the unlock score', before === 0)
  check('movers start at the unlock score', at === 1)
  check('mover count is capped', late === MOVERS.maxCount)
}

/** Pickups spawn, expire and can be intercepted. */
function pickupProbe(): void {
  const field = new PickupField()
  const random = createRandom(3)
  const seeker = { x: ARENA.width / 2, y: ARENA.height / 2 }
  const spawned = new Set<number>()
  let collected = 0
  for (let frame = 0; frame < 3000; frame += 1) {
    field.update(STEP, seeker, random, () => {
      collected += 1
    })
    const first = field.list()[0]
    if (first !== undefined) {
      spawned.add(first.id)
      seeker.x += Math.sign(first.pos.x - seeker.x) * 4
      seeker.y += Math.sign(first.pos.y - seeker.y) * 4
    }
  }
  line('pickups in 50s / intercepted', `${spawned.size} / ${collected} (ttl ${CANDY.ttl}s)`)
  check('pickups spawn', spawned.size >= 3)
  check('pickups are reachable', collected >= spawned.size - 1)
  check('pickup cap respected', field.list().length <= CANDY.maxAlive)
}

/** Pause, mute and restart transitions. */
function stateProbe(): void {
  const session = bootSession(5)
  session.start()
  const running = session.status
  session.togglePause()
  const paused = session.status
  session.resume()
  const resumed = session.status
  session.toggleMute()
  session.restart()
  line('status chain', `${running} -> ${paused} -> ${resumed} -> ${session.status}`)
  check('pause and resume', paused === 'paused' && resumed === 'running')
  check('restart returns to running at 0', session.status === 'running' && session.score === 0)
}

console.log('--- Avoid the Spikes: engine invariants ---')
scoringProbe()
fatalContactProbe()
boundaryProbe()
soakProbe()
curveProbe()
fairnessProbe()
moverProbe()
pickupProbe()
stateProbe()
line('simulated step', `${PHYSICS.step === 1 / 120 ? '120 Hz fixed' : 'variable'} (max ${PHYSICS.maxStepsPerFrame} per frame)`)

const failed = checks.filter((entry) => !entry.ok)
console.log('')
for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'}  ${entry.name}`)
}
console.log(failed.length === 0 ? `\nRESULT: ${checks.length}/${checks.length} hold` : `\nRESULT: ${failed.length} failed`)
process.exitCode = failed.length === 0 ? 0 : 1

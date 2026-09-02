/**
 * Engine invariants and AI decision simulation for FL Tron 3.0, checked headlessly.
 */

import { OccupancyGrid, OCCUPANCY } from '../src/games/fl-tron-3/engine/grid'
import { createCycle, queueDirection, triggerCycleTurbo, updateCycleTimers, OPPOSITE_DIRECTIONS } from '../src/games/fl-tron-3/engine/cycle'
import { AIController, SurvivalEngine, PersonalityEngine } from '../src/games/fl-tron-3/engine/ai'
import { AI_CONFIGS, ARENA, RULES } from '../src/games/fl-tron-3/engine/config'
import { TronEngine } from '../src/games/fl-tron-3/engine/engine'
import type { DifficultyLevel } from '../src/games/fl-tron-3/engine/types'

const checks: { readonly name: string; readonly ok: boolean }[] = []
const check = (name: string, ok: boolean): void => {
  checks.push({ name, ok })
}
const line = (label: string, value: string): void => {
  console.log(`${label.padEnd(46)} ${value}`)
}

function gridInvariantProbe(): void {
  const grid = new OccupancyGrid()
  let interiorFree = true
  for (let c = ARENA.borderInset; c < grid.cols - ARENA.borderInset; c += 1) {
    for (let r = ARENA.borderInset; r < grid.rows - ARENA.borderInset; r += 1) {
      if (!grid.isInBounds(c, r) || !grid.isFree(c, r)) {
        interiorFree = false
      }
    }
  }

  // Border cells (edge lines) must be blocked by borderInset
  const borderBlocked =
    !grid.isFree(0, 50) &&
    !grid.isFree(grid.cols - 1, 50) &&
    !grid.isFree(40, 0) &&
    !grid.isFree(40, grid.rows - 1)

  // Set boundary and verify
  grid.set(10, 10, OCCUPANCY.p1Trail)
  const isOccupied = !grid.isFree(10, 10) && grid.get(10, 10) === OCCUPANCY.p1Trail
  const outOfBoundsCheck = !grid.isInBounds(-1, 0) && !grid.isInBounds(grid.cols, grid.rows)

  // Test flood fill
  const openArea = grid.floodFillArea(20, 20, 500)

  line('grid dimensions (cols x rows)', `${grid.cols} x ${grid.rows}`)
  line('border inset excluded hazard margin', `${ARENA.borderInset} cell(s) per edge`)
  line('flood fill open chamber capacity', `${openArea} cells (expected >= 500)`)
  check('playable grid interior in-bounds and empty', interiorFree)
  check('border edge cells correctly blocked by borderInset', borderBlocked)
  check('grid occupancy read/write integrity', isOccupied)
  check('out of bounds guard holds', outOfBoundsCheck)
  check('flood fill calculates open chamber', openArea >= 500)
}

function cycleMechanicsProbe(): void {
  const p1 = createCycle('p1', 20, 75, 'up', RULES.playerTurbosPerRound)

  const initialTrailSegmentCount = p1.trail.length === 1 && !p1.trail[0]?.isTurbo

  // 180° reverse turn prevention
  queueDirection(p1, OPPOSITE_DIRECTIONS[p1.dir])
  const preventedReverse = p1.inputBuffer.length === 0

  // Valid 90° turn queueing
  queueDirection(p1, 'right')
  queueDirection(p1, 'down')
  const queuedTurns = p1.inputBuffer.length === 2

  // Turbo activation
  const initialTurbos = p1.turbosLeft
  const turboTriggered = triggerCycleTurbo(p1, false)
  const isBoosting = p1.isTurbo && p1.turbosLeft === initialTurbos - 1
  const turboSegmentCreated = p1.trail.length === 2 && !p1.trail[0]?.isTurbo && p1.trail[1]?.isTurbo === true

  // Second immediate turbo blocked by cooldown
  const secondTurboBlocked = !triggerCycleTurbo(p1, false)

  // Turbo expiration
  updateCycleTimers(p1, RULES.turboDurationSeconds + 0.1)
  const turboExpired = !p1.isTurbo
  const normalSegmentResumed = p1.trail.length === 3 && !p1.trail[0]?.isTurbo && p1.trail[1]?.isTurbo === true && !p1.trail[2]?.isTurbo

  line('reverse 180° turn prevention', preventedReverse ? 'BLOCKED' : 'ALLOWED')
  line('turbos remaining after boost', `${p1.turbosLeft} / ${initialTurbos}`)
  line('segmented turbo trail persistence', normalSegmentResumed ? 'PERMANENT' : 'INVALID')
  check('trail begins with 1 normal non-turbo segment', initialTrailSegmentCount)
  check('prevent 180° instant reverse turns', preventedReverse)
  check('valid 90° turn buffering up to 2 steps', queuedTurns)
  check('turbo boost activation & meter decrement', turboTriggered && isBoosting)
  check('turbo creates distinct active turbo segment', turboSegmentCreated)
  check('turbo cooldown locks re-triggering', secondTurboBlocked)
  check('turbo timers expire cleanly', turboExpired)
  check('turbo stretch remains pastel while new stretch returns to normal', normalSegmentResumed)
}

function vetoArchitectureProbe(): void {
  const grid = new OccupancyGrid()
  const ai = createCycle('ai', 40, 50, 'up', 3)
  const p1 = createCycle('p1', 10, 10, 'down', 3)

  // 1. Test lethal proposal veto: Propose moving towards a wall 2 cells ahead.
  // AI at (40,50) moving 'up' -> destination cell is (40,49), but the cell after that (40,48) is blocked.
  // The veto should detect 'up' is a dead end and redirect to left or right.
  grid.set(40, 48, OCCUPANCY.p1Trail)
  const lethalProposal = { desiredDir: 'up' as const, wantsTurbo: true, intent: 'chase' as const }
  const vetoVerdict = SurvivalEngine.evaluateVeto(ai, lethalProposal, grid)

  line('veto of lethal wall collision', `${vetoVerdict.allowed ? 'ALLOWED' : 'VETOED'} -> override to ${vetoVerdict.finalDir}`)
  check('survival engine vetoes lethal collision', !vetoVerdict.allowed && vetoVerdict.finalDir !== 'up')

  // 2. Test Doomed Player diagnosis: Box the player into a 5x5 cell box
  for (let c = 8; c <= 14; c += 1) {
    grid.set(c, 8, OCCUPANCY.aiTrail)
    grid.set(c, 14, OCCUPANCY.aiTrail)
  }
  for (let r = 8; r <= 14; r += 1) {
    grid.set(8, r, OCCUPANCY.aiTrail)
    grid.set(14, r, OCCUPANCY.aiTrail)
  }

  const diagnosis = SurvivalEngine.diagnosePlayer(p1, ai, grid)
  line('doomed player diagnosis (<100 cells box)', `playerArea: ${diagnosis.playerArea}, doomed: ${diagnosis.playerDoomed}`)
  check('diagnosePlayer detects trapped/doomed player', diagnosis.playerDoomed)

  // 3. Test Personality Engine transition to passing_time
  const l5Personality = new PersonalityEngine(5)
  const moveWhenDoomed = l5Personality.proposeMove(ai, p1, grid, 0.2)
  line('personality mood when player is doomed', `intent: ${moveWhenDoomed.intent}`)
  check('personality switches to lawnmower/thick_stairs when doomed', moveWhenDoomed.intent === 'lawnmower' || moveWhenDoomed.intent === 'thick_stairs')
}

function aiCampaignScalingProbe(): void {
  const grid = new OccupancyGrid()

  for (let lvl = 1; lvl <= 6; lvl += 1) {
    const level = lvl as DifficultyLevel
    const aiConfig = AI_CONFIGS[level]
    const controller = new AIController(level)
    const p1 = createCycle('p1', 20, 75, 'up', 3)
    const ai = createCycle('ai', 60, 30, 'down', aiConfig.maxTurbos)

    // Simulate 120 AI evaluation frames
    let threw = false
    try {
      for (let f = 0; f < 120; f += 1) {
        controller.update(0.016, ai, p1, grid)
        updateCycleTimers(ai, 0.016)
      }
    } catch {
      threw = true
    }

    line(`Level ${level} (${aiConfig.name.padEnd(11)})`, `turbos: ${aiConfig.infiniteTurbos ? 'infinite' : aiConfig.maxTurbos}, voronoi: ${aiConfig.useVoronoi}`)
    check(`Level ${level} AI simulation runs error-free`, !threw)
  }

  // Level 1 and 2 zero turbos check
  check('Level 1 Novice gets 0 turbos', AI_CONFIGS[1].maxTurbos === 0)
  check('Level 2 Scout gets 0 turbos', AI_CONFIGS[2].maxTurbos === 0)
  // Level 5 6-turbos and Level 6 infinite turbos check
  check('Level 5 Assassin gets 6 turbos', AI_CONFIGS[5].maxTurbos === 6)
  check('Level 6 Master Core gets infinite turbos', AI_CONFIGS[6].infiniteTurbos)
}

function level5AssassinBehaviorProbe(): void {
  const grid = new OccupancyGrid()
  const p1 = createCycle('p1', 20, 75, 'up', 3)
  const ai = createCycle('ai', 20, 45, 'down', 6)
  const personality = new PersonalityEngine(5)

  // 1. Normal state: Level 5 prime directive is tailing (intent 'chase', no stairs)
  const normalMove = personality.proposeMove(ai, p1, grid, 0.1)
  line('Level 5 prime directive intent', `intent: ${normalMove.intent}, mood: ${personality.currentMood}`)
  check('Level 5 prime directive is tailing pursuit', normalMove.intent === 'chase')
  check('Level 5 never enters having_fun staircase state', personality.currentMood !== 'having_fun')

  // 2. Player activates turbo -> Level 5 immediately counter-boosts
  p1.isTurbo = true
  const counterTurboMove = personality.proposeMove(ai, p1, grid, 0.1)
  line('Level 5 counter-boost reaction', `wantsTurbo: ${counterTurboMove.wantsTurbo}`)
  check('Level 5 reacts to player turbo by triggering AI turbo', counterTurboMove.wantsTurbo)
}

function ghostCollisionAndInputQueueProbe(): void {
  // 1. Test 6-item buffer capacity and TTL expiry
  const p1 = createCycle('p1', 20, 75, 'up', 3)
  const t0 = 100.0

  // Queue up to 6 valid alternating turns
  queueDirection(p1, 'right', t0)
  queueDirection(p1, 'down', t0)
  queueDirection(p1, 'left', t0)
  queueDirection(p1, 'down', t0)
  queueDirection(p1, 'right', t0)
  queueDirection(p1, 'down', t0)
  const sixInputsBuffered = p1.inputBuffer.length === 6

  // 7th input should be capped / rejected
  queueDirection(p1, 'left', t0)
  const cappedAtSix = p1.inputBuffer.length === 6

  // Check TTL (1.2s): at t = t0 + 1.25, active inputs should expire on next queue
  queueDirection(p1, 'right', t0 + 1.25)
  const ttlExpiredOldInputs = p1.inputBuffer.length === 1 && p1.inputBuffer[0]?.dir === 'right'

  line('6-input buffer capacity holds', sixInputsBuffered ? '6 QUEUED' : 'FAILED')
  line('buffer capacity strictly capped at 6', cappedAtSix ? 'CAPPED' : 'OVERFLOW')
  line('1.2s TTL purges stale inputs', ttlExpiredOldInputs ? 'PURGED' : 'FAILED')
  check('input buffer stores up to 6 turns', sixInputsBuffered)
  check('input buffer caps at 6 maximum entries', cappedAtSix)
  check('input buffer TTL (1.2s) purges expired commands', ttlExpiredOldInputs)

  // 2. Test Ghost Collision Fix: Rapid Right -> Down while moving Up
  const mockDeps = { current: { beginRun: () => {}, finishRun: () => {}, best: null } }
  const mockAudio = {
    isMuted: false,
    unlock: () => {},
    play: () => {},
    startBikeHum: () => {},
    stopBikeHum: () => {},
    updateBikeHumSpeed: () => {},
    toggleMuted: () => false,
    dispose: () => {},
  }
  const store = {
    get: () => ({}),
    set: () => {},
    update: () => {},
    subscribe: () => () => {},
  }

  const engine = new TronEngine(mockDeps as any, store as any, mockAudio as any)
  engine.startCampaign()
  // Advance past countdown phase (2.4s)
  for (let i = 0; i < 60; i += 1) {
    engine.update(0.05)
  }

  // Verify starting position: p1 at (20, 75) moving 'up'
  const startCol = engine.state.p1.col
  const startRow = engine.state.p1.row
  const initialAlive = engine.state.p1.alive && engine.state.phase === 'playing'

  // Rapidly press Right then Down
  engine.handleInput('ArrowRight', true)
  engine.handleInput('ArrowDown', true)

  const twoTurnsQueued = engine.state.p1.inputBuffer.length === 2

  // Simulate 30 frames (0.5 seconds at 60fps) of physics
  for (let f = 0; f < 30; f += 1) {
    engine.update(1 / 60)
  }

  // Under the old bug, the cycle would immediately crash into its own trail cell at (20, 75).
  // With grid snapping and one turn per cell entry, the cycle travels to (20, 74), turns Right to (21, 74),
  // turns Down to (21, 75+), remaining fully alive and intact!
  const survivedRapidTurns = engine.state.p1.alive && engine.state.phase === 'playing'
  const movedToNewCol = engine.state.p1.col === 21
  const turnedDownSafely = engine.state.p1.dir === 'down'

  line('start position at (20, 75) moving up', `col: ${startCol}, row: ${startRow}, alive: ${initialAlive}`)
  line('rapid Right then Down buffering', `buffer length: ${twoTurnsQueued ? 2 : 'invalid'}`)
  line('ghost collision eliminated', survivedRapidTurns ? 'SURVIVED (ALIVE)' : 'CRASHED (BUG)')
  line('hairpin maneuver executed cleanly', `col: ${engine.state.p1.col}, row: ${engine.state.p1.row}, dir: ${engine.state.p1.dir}`)

  check('rapid Right+Down inputs successfully buffered', twoTurnsQueued)
  check('eliminated ghost collision: player survives rapid Right->Down turn', survivedRapidTurns)
  check('cycle reached column 21 after Right turn', movedToNewCol)
  check('cycle completed second 90° turn to Down without self-collision', turnedDownSafely)
}

function aiPerimeterNavigationProbe(): void {
  // Simulate full AI gameplay across all difficulty levels for 300 physics frames each
  for (let lvl = 1; lvl <= 6; lvl += 1) {
    const mockDeps = { current: { beginRun: () => {}, finishRun: () => {}, best: null } }
    const mockAudio = {
      isMuted: false,
      unlock: () => {},
      play: () => {},
      startBikeHum: () => {},
      stopBikeHum: () => {},
      updateBikeHumSpeed: () => {},
      toggleMuted: () => false,
      dispose: () => {},
    }
    const store = { get: () => ({}), set: () => {}, update: () => {}, subscribe: () => () => {} }

    const engine = new TronEngine(mockDeps as any, store as any, mockAudio as any)
    engine.startCampaign()
    engine.state.level = lvl as DifficultyLevel

    // Advance countdown
    for (let i = 0; i < 60; i += 1) {
      engine.update(0.05)
    }

    // Run 300 physics frames of AI navigation
    for (let f = 0; f < 300; f += 1) {
      if (engine.state.phase !== 'playing') break
      engine.update(1 / 60)
    }

    const aiInBounds =
      engine.state.ai.col >= 0 &&
      engine.state.ai.col < engine.grid.cols &&
      engine.state.ai.row >= 0 &&
      engine.state.ai.row < engine.grid.rows
    const aiAlive = engine.state.ai.alive

    line(`Level ${lvl} AI 300-frame navigation`, `alive: ${aiAlive}, in-bounds: ${aiInBounds} (${engine.state.ai.col}, ${engine.state.ai.row})`)
    check(`Level ${lvl} AI survives perimeter and stays inside arena`, aiInBounds && aiAlive)
  }
}

console.log('--- FL Tron 3.0: Engine & Invariant Simulation ---')
gridInvariantProbe()
cycleMechanicsProbe()
vetoArchitectureProbe()
aiCampaignScalingProbe()
level5AssassinBehaviorProbe()
ghostCollisionAndInputQueueProbe()
aiPerimeterNavigationProbe()

const failed = checks.filter((entry) => !entry.ok)
console.log('')
for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'}  ${entry.name}`)
}
console.log(failed.length === 0 ? `\nRESULT: ${checks.length}/${checks.length} hold` : `\nRESULT: ${failed.length} failed`)
process.exitCode = failed.length === 0 ? 0 : 1


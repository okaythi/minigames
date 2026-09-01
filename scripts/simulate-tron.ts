/**
 * Engine invariants and AI decision simulation for FL Tron 3.0, checked headlessly.
 */

import { OccupancyGrid, OCCUPANCY } from '../src/games/fl-tron-3/engine/grid'
import { createCycle, queueDirection, triggerCycleTurbo, updateCycleTimers, OPPOSITE_DIRECTIONS } from '../src/games/fl-tron-3/engine/cycle'
import { AIController, SurvivalEngine, PersonalityEngine } from '../src/games/fl-tron-3/engine/ai'
import { AI_CONFIGS, RULES } from '../src/games/fl-tron-3/engine/config'
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
  let inBounds = true
  for (let c = 0; c < grid.cols; c += 1) {
    for (let r = 0; r < grid.rows; r += 1) {
      if (!grid.isInBounds(c, r) || !grid.isFree(c, r)) {
        inBounds = false
      }
    }
  }

  // Set boundary and verify
  grid.set(10, 10, OCCUPANCY.p1Trail)
  const isOccupied = !grid.isFree(10, 10) && grid.get(10, 10) === OCCUPANCY.p1Trail
  const outOfBoundsCheck = !grid.isInBounds(-1, 0) && !grid.isInBounds(grid.cols, grid.rows)

  // Test flood fill
  const openArea = grid.floodFillArea(20, 20, 500)

  line('grid dimensions (cols x rows)', `${grid.cols} x ${grid.rows}`)
  line('flood fill open chamber capacity', `${openArea} cells (expected >= 500)`)
  check('grid initialization in-bounds and empty', inBounds)
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

  // 1. Test lethal proposal veto: Propose moving straight into a wall obstacle
  grid.set(40, 49, OCCUPANCY.p1Trail)
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

console.log('--- FL Tron 3.0: Engine & Invariant Simulation ---')
gridInvariantProbe()
cycleMechanicsProbe()
vetoArchitectureProbe()
aiCampaignScalingProbe()

const failed = checks.filter((entry) => !entry.ok)
console.log('')
for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'}  ${entry.name}`)
}
console.log(failed.length === 0 ? `\nRESULT: ${checks.length}/${checks.length} hold` : `\nRESULT: ${failed.length} failed`)
process.exitCode = failed.length === 0 ? 0 : 1

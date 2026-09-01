import { ARENA, HAZARDS } from './config'
import { alongForCell, boundaryGrid, wallGrid } from './geometry'
import type { Spike, SpikeSurface, WallSide } from './types'

/**
 * Spike construction shared by the permanent boundary rows and the wall rows
 * that get re-armed on every bounce. Ids are monotonic, which is all the
 * renderer needs to keep a stable animation per spike.
 */

let nextId = 1
export const takeSpikeId = (): number => nextId++

interface CellPlan {
  readonly index: number
  readonly surface: SpikeSurface
  readonly along: number
  readonly base: number
  readonly depth: number
}

const toSpike = (plan: CellPlan, order: number): Spike => ({
  id: takeSpikeId(),
  surface: plan.surface,
  along: plan.along,
  base: plan.base,
  depth: plan.depth,
  sproutDelay: order * HAZARDS.sproutStagger,
  age: 0,
})

/** The two permanent rows: the top and bottom of the screen are never safe. */
export function createBoundarySpikes(): Spike[] {
  const grid = boundaryGrid()
  const plans: CellPlan[] = []
  for (let index = 0; index < grid.cells; index += 1) {
    const along = alongForCell(grid, index)
    plans.push({
      index,
      surface: 'ceiling',
      along,
      base: ARENA.boundaryPitch * 0.9,
      depth: ARENA.ceilingDepth,
    })
    plans.push({
      index,
      surface: 'floor',
      along,
      base: ARENA.boundaryPitch * 0.9,
      depth: ARENA.floorDepth,
    })
  }
  // Boundary rows are fully grown from frame one.
  return plans.map((plan) => ({ ...toSpike(plan, 0), sproutDelay: 0, age: 1 }))
}

export interface WallPlanOptions {
  readonly side: WallSide
  readonly density: number
  readonly gapCells: number
  readonly maxRun: number
  /** Cell index the player is aiming at; the generator guarantees it is open. */
  readonly safeCell: number
  readonly random: () => number
}

/**
 * Builds a blocked/open bitmap for a wall, then converts blocked cells into
 * spikes.
 *
 * Guarantees, in order:
 *  1. every open run is at least `gapCells` tall (a gap you can actually fit in)
 *  2. the cell the player is currently tracking stays open (no cheap deaths)
 *  3. the row never covers the whole wall
 */
export function planWallSpikes(options: WallPlanOptions): Spike[] {
  const { side, density, gapCells: minGap, maxRun, safeCell, random } = options
  const grid = wallGrid()
  const cells = grid.cells
  const blocked: boolean[] = Array.from({ length: cells }, () => false)

  let cursor = 0
  while (cursor < cells) {
    const gap = minGap + (random() < 0.35 ? 1 : 0)
    cursor += gap
    if (cursor >= cells) {
      break
    }
    if (random() > density) {
      continue
    }
    const run = 1 + Math.floor(random() * maxRun)
    for (let i = cursor; i < Math.min(cursor + run, cells); i += 1) {
      blocked[i] = true
    }
    cursor += run
  }

  // Guarantee #2: clear the tracked cell and its immediate neighbours.
  for (let i = safeCell - 1; i <= safeCell + 1; i += 1) {
    if (i >= 0 && i < cells) {
      blocked[i] = false
    }
  }

  const depth = ARENA.wallDepth
  const base = ARENA.wallPitch * 0.86
  const spikes: Spike[] = []
  blocked.forEach((value, index) => {
    if (!value) {
      return
    }
    spikes.push(
      toSpike(
        {
          index,
          surface: side,
          along: alongForCell(grid, index),
          base,
          depth,
        },
        index,
      ),
    )
  })
  return spikes
}

/** Which cell a given y coordinate lands in - used for the safety guarantee. */
export function cellIndexForY(y: number): number {
  const grid = wallGrid()
  const raw = Math.floor((y - grid.origin) / grid.pitch)
  return Math.max(0, Math.min(grid.cells - 1, raw))
}

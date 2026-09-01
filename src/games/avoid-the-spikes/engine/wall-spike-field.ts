import { HAZARDS } from './config'
import { clamp01, lerp } from '../../../lib/math'
import { easeOutBack } from '../../../lib/easing'
import { rectIntersectsTriangle } from './collision'
import { spikeTriangle } from './geometry'
import { cellIndexForY, planWallSpikes, type WallPlanOptions } from './spike-factory'
import type { Random } from '../../../lib/random'
import type { Rect, Spike, WallSide } from './types'

/**
 * The two live walls. A wall is "armed" when the player leaves the opposite
 * wall, and "spent" the moment the player touches it - so the hazard you must
 * land in is always the one that sprouted in front of you a second ago.
 */

export interface SpikeGrowth {
  /** 0..~1.12 for drawing (it overshoots); collision clamps it to 1. */
  readonly growth: number
  readonly ready: boolean
}

const pressureFor = (score: number): number => clamp01(score / 45)

export class WallSpikeField {
  private readonly rows: Record<WallSide, Spike[]> = { left: [], right: [] }

  public spikes(side: WallSide): readonly Spike[] {
    return this.rows[side]
  }

  /** Arm `side` with a fresh random row, keeping the aimed cell open. */
  public arm(side: WallSide, score: number, random: Random, aimY: number): readonly Spike[] {
    const pressure = pressureFor(score)
    const options: WallPlanOptions = {
      side,
      density: lerp(HAZARDS.density.start, HAZARDS.density.max, pressure ** 0.85),
      gapCells: Math.round(lerp(HAZARDS.gapCells.start, HAZARDS.gapCells.min, pressure)),
      maxRun: Math.round(lerp(HAZARDS.runCells.start, HAZARDS.runCells.max, pressure ** 0.9)),
      safeCell: cellIndexForY(aimY),
      random: () => random.next(),
    }
    const spikes = planWallSpikes(options)
    this.rows[side] = spikes
    return spikes
  }

  /** Touching a wall consumes its row: the next visit starts clean. */
  public spend(side: WallSide): void {
    this.rows[side] = []
  }

  public update(dt: number): void {
    for (const side of ['left', 'right'] as const) {
      for (const spike of this.rows[side]) {
        spike.age += dt
      }
    }
  }

  public growthOf(spike: Spike): SpikeGrowth {
    const progress = clamp01((spike.age - spike.sproutDelay) / HAZARDS.sproutDuration)
    return {
      growth: progress === 0 ? 0 : easeOutBack(progress),
      ready: progress >= HAZARDS.collisionGrowth,
    }
  }

  /** The spike a player rect is touching on `side`, if any. */
  public hazardAt(side: WallSide, rect: Rect): Spike | null {
    for (const spike of this.rows[side]) {
      const { growth, ready } = this.growthOf(spike)
      if (!ready) {
        continue
      }
      if (rectIntersectsTriangle(rect, spikeTriangle(spike, Math.min(growth, 1)))) {
        return spike
      }
    }
    return null
  }

  public clear(): void {
    this.rows.left = []
    this.rows.right = []
  }
}

/** The permanent ceiling/floor rows: built once, never re-armed. */
export class BoundarySpikeField {
  public constructor(private readonly spikes: readonly Spike[]) {}

  public hits(rect: Rect): Spike | null {
    for (const spike of this.spikes) {
      if (rectIntersectsTriangle(rect, spikeTriangle(spike, 1))) {
        return spike
      }
    }
    return null
  }

  public list(): readonly Spike[] {
    return this.spikes
  }
}

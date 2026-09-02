import { DIRECTION_VECTORS } from '../../cycle'
import type { CycleState, Direction } from '../../types'
import type { PlayerTacticalMetrics } from './types'

export class OnlinePlayerTracker {
  private lastCol = -1
  private lastRow = -1
  private lastDir: Direction = 'up'
  private wasTurboLastFrame = false

  private turnCount = 0
  private turboCount = 0
  private straightSteps = 0
  private totalSteps = 0
  private aggressionHits = 0

  public update(player: CycleState, ai: CycleState): void {
    if (!player.alive) return

    if (player.isTurbo && !this.wasTurboLastFrame) {
      this.turboCount += 1
    }
    this.wasTurboLastFrame = player.isTurbo

    const cellChanged = player.col !== this.lastCol || player.row !== this.lastRow
    if (cellChanged) {
      this.lastCol = player.col
      this.lastRow = player.row
      this.totalSteps += 1

      if (player.dir !== this.lastDir) {
        this.turnCount += 1
        this.lastDir = player.dir
        this.straightSteps = 0
      } else {
        this.straightSteps += 1
      }

      const pVec = DIRECTION_VECTORS[player.dir]
      const distNow = Math.hypot(ai.col - player.col, ai.row - player.row)
      const distNext = Math.hypot(ai.col - (player.col + pVec.x), ai.row - (player.row + pVec.y))
      if (distNext < distNow) {
        this.aggressionHits += 1
      }
    }
  }

  public getMetrics(): PlayerTacticalMetrics {
    const total = Math.max(1, this.totalSteps)
    return {
      turnCount: this.turnCount,
      turboCount: this.turboCount,
      straightRunRatio: Math.min(1, this.straightSteps / Math.max(1, total)),
      playerAggressionScore: this.aggressionHits / total,
    }
  }

  public reset(): void {
    this.lastCol = -1
    this.lastRow = -1
    this.lastDir = 'up'
    this.wasTurboLastFrame = false
    this.turnCount = 0
    this.turboCount = 0
    this.straightSteps = 0
    this.totalSteps = 0
    this.aggressionHits = 0
  }
}

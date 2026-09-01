import { AI_CONFIGS } from '../config'
import { queueDirection, triggerCycleTurbo } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { CycleState, DifficultyLevel } from '../types'
import { PersonalityEngine } from './personality-engine'
import { SurvivalEngine } from './survival-engine'

export class AIController {
  private reactionTimer = 0
  private readonly personality: PersonalityEngine

  public constructor(public readonly level: DifficultyLevel) {
    this.personality = new PersonalityEngine(level)
  }

  public update(
    dt: number,
    aiCycle: CycleState,
    playerCycle: CycleState,
    grid: OccupancyGrid,
  ): void {
    if (!aiCycle.alive) return

    this.reactionTimer += dt
    const config = AI_CONFIGS[this.level]

    if (this.reactionTimer < config.reactionTime) {
      return
    }
    this.reactionTimer = 0

    // 1. Personality Engine decides what it WANTS to do
    const proposal = this.personality.proposeMove(aiCycle, playerCycle, grid, dt)

    // 2. Survival Engine decides what it is ALLOWED to do (The Veto System)
    const verdict = SurvivalEngine.evaluateVeto(aiCycle, proposal, grid)

    // 3. Execute the final approved direction
    if (verdict.finalDir !== aiCycle.dir) {
      queueDirection(aiCycle, verdict.finalDir)
    }

    // 4. Execute turbo if approved
    if (verdict.finalTurbo) {
      triggerCycleTurbo(aiCycle, config.infiniteTurbos)
    }
  }
}

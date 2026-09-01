import { AI_CONFIGS } from '../config'
import { queueDirection, triggerCycleTurbo } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { CycleState, DifficultyLevel } from '../types'
import { PersonalityEngine } from './personality-engine'
import { SurvivalEngine } from './survival-engine'
import type { MoveProposal } from './types'

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

    let proposal: MoveProposal = { desiredDir: aiCycle.dir, wantsTurbo: false, intent: 'wander' }

    if (this.reactionTimer >= config.reactionTime) {
      proposal = this.personality.proposeMove(aiCycle, playerCycle, grid, this.reactionTimer)
      this.reactionTimer = 0
    }

    // 2. Survival Engine ALWAYS runs every frame (The Veto System)
    // This ensures Level 1 & 2 AI don't randomly crash into walls between their slow reaction ticks!
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

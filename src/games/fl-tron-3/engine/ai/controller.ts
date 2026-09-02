import { AI_CONFIGS } from '../config'
import { triggerCycleTurbo } from '../cycle'
import type { OccupancyGrid } from '../grid'
import type { CycleState, DifficultyLevel } from '../types'
import { PersonalityEngine } from './personality-engine'
import { SurvivalEngine } from './survival-engine'
import type { MoveProposal } from './types'

export class AIController {
  private reactionTimer = 0
  private lastCol = -1
  private lastRow = -1
  private activeProposal: MoveProposal | null = null
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

    const cellChanged = aiCycle.col !== this.lastCol || aiCycle.row !== this.lastRow
    if (cellChanged) {
      this.lastCol = aiCycle.col
      this.lastRow = aiCycle.row
    }

    // When an active macro pattern is executing, only query personality upon entering a new cell (cellChanged)
    // When no macro is active, query on reactionTimer or cell entry
    const isMacroActive =
      this.activeProposal?.intent === 'staircase' ||
      this.activeProposal?.intent === 'thick_stairs' ||
      this.activeProposal?.intent === 'lawnmower'

    const shouldQueryPersonality =
      this.activeProposal === null ||
      (isMacroActive && cellChanged) ||
      (!isMacroActive && (this.reactionTimer >= config.reactionTime || cellChanged))

    if (shouldQueryPersonality) {
      this.activeProposal = this.personality.proposeMove(
        aiCycle,
        playerCycle,
        grid,
        Math.max(dt, this.reactionTimer),
      )
      this.reactionTimer = 0
    }

    const proposal = this.activeProposal ?? { desiredDir: aiCycle.dir, wantsTurbo: false, intent: 'wander' }

    // 2. Survival Engine ALWAYS runs every frame (The Veto System)
    // This ensures Level 1 & 2 AI don't randomly crash into walls between their slow reaction ticks!
    const verdict = SurvivalEngine.evaluateVeto(aiCycle, playerCycle, proposal, grid, config.level)

    // If veto forced an override, clear active macro and accept safe direction
    if (!verdict.allowed) {
      this.personality.abortPattern()
      this.activeProposal = {
        desiredDir: verdict.finalDir,
        wantsTurbo: verdict.finalTurbo,
        intent: 'wander',
      }
    }

    // 3. Execute the final approved direction
    if (verdict.finalDir !== aiCycle.dir) {
      aiCycle.inputBuffer = [{ dir: verdict.finalDir, expiresAt: performance.now() / 1000 + 1.2 }]
    } else {
      aiCycle.inputBuffer = []
    }

    // 4. Execute turbo if approved
    if (verdict.finalTurbo) {
      triggerCycleTurbo(aiCycle, config.infiniteTurbos)
    }
  }
}

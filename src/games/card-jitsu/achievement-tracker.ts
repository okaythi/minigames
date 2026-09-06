/**
 * Card-Jitsu — in-session achievement tracker.
 *
 * Evaluates match outcomes, power clashes, card collection milestones,
 * and Dojo store purchases, notifying the AchievementBus when thresholds are crossed.
 */

import type { AchievementBus } from '../../lib/achievement-bus'
import type { MatchEndResult } from './types'
import { checkWinCondition } from './engine/rules/combos'

export class CardJitsuAchievementTracker {
  constructor(private readonly bus: AchievementBus) {}

  /**
   * Evaluates match end outcomes against the Card-Jitsu achievement catalogue.
   *
   * @param result Match outcome and card banks
   * @param rank Current or newly awarded ninja rank (1 = White, 9 = Black, 10 = Master)
   * @param totalWins All-time wins in Card-Jitsu
   * @param ownedCardsCount Total unique cards in the player's binder
   */
  onMatchCompleted(
    result: MatchEndResult,
    rank: number,
    totalWins: number,
    ownedCardsCount: number,
  ): void {
    // 1. Belt progression milestones
    if (rank >= 1) {
      this.bus.unlock('cj_belt_white')
    }
    if (rank >= 9) {
      this.bus.unlock('cj_belt_black')
    }
    // Ninja Master: face and defeat Sensei as a Black Belt
    if (result.mode === 'sensei' && result.winner === 'player' && rank >= 9) {
      this.bus.unlock('cj_ninja_master')
    }

    // 2. Play count milestones
    this.updatePlayCounts(totalWins)

    // 3. Card collection / binder milestones
    this.updateCardCollection(ownedCardsCount)

    // Player must have won the match for the remaining combat badges
    if (result.winner !== 'player') {
      return
    }

    // 4. Triad Win Methods
    const winCheck = checkWinCondition(result.playerBank)
    if (winCheck.won) {
      if (winCheck.triadType === 'same-element' && winCheck.winningCards && winCheck.winningCards.length >= 3) {
        const firstCard = winCheck.winningCards[0]
        if (firstCard) {
          const elem = firstCard.element
          if (elem === 'f') this.bus.unlock('cj_triad_fire')
          else if (elem === 'w') this.bus.unlock('cj_triad_water')
          else if (elem === 's') this.bus.unlock('cj_triad_snow')
        }
      } else if (winCheck.triadType === 'different-elements') {
        this.bus.unlock('cj_triad_harmony')
      }
    }

    // 5. Flawless Duelist: zero opponent cards scored
    if (result.flawless || result.opponentBank.length === 0) {
      this.bus.unlock('cj_flawless_victory')
    }

    // 6. Dojo Endurance: 9 or more total cards scored on the mat
    const totalCardsScored = result.playerBank.length + result.opponentBank.length
    if (result.fullDojo || totalCardsScored >= 9) {
      this.bus.unlock('cj_dojo_endurance')
    }

    // 7. Rapid Strike: win in 4 rounds or fewer
    if (result.rounds <= 4) {
      this.bus.unlock('cj_rapid_strike')
    }
  }

  /**
   * Syncs server profile state when loaded or refreshed.
   */
  onProfileLoaded(
    rank: number,
    totalWins: number,
    ownedCardsCount: number,
    packsPurchased?: number,
  ): void {
    if (rank >= 1) this.bus.unlock('cj_belt_white')
    if (rank >= 9) this.bus.unlock('cj_belt_black')
    if (rank >= 10) this.bus.unlock('cj_ninja_master')
    this.updatePlayCounts(totalWins)
    this.updateCardCollection(ownedCardsCount)
    if (packsPurchased !== undefined) {
      this.onPacksPurchased(packsPurchased)
    }
  }

  /** Call when player wins a clash using a Power Card modifier. */
  onPowerClashWon(): void {
    this.bus.unlock('cj_power_surge')
  }

  /** Updates play count badges and progress. */
  updatePlayCounts(totalWins: number): void {
    if (totalWins >= 150) {
      this.bus.unlock('cj_plays_legend', totalWins)
    } else {
      this.bus.progress('cj_plays_legend', totalWins)
    }

    if (totalWins >= 50) {
      this.bus.unlock('cj_plays_champion', totalWins)
    } else {
      this.bus.progress('cj_plays_champion', totalWins)
    }

    if (totalWins >= 10) {
      this.bus.unlock('cj_plays_apprentice', totalWins)
    } else {
      this.bus.progress('cj_plays_apprentice', totalWins)
    }
  }

  /** Call when card inventory or profile is updated. */
  updateCardCollection(ownedCardsCount: number): void {
    if (ownedCardsCount >= 509) {
      this.bus.unlock('cj_binder_complete', ownedCardsCount)
    } else {
      this.bus.progress('cj_binder_complete', ownedCardsCount)
    }

    if (ownedCardsCount >= 250) {
      this.bus.unlock('cj_binder_archivist', ownedCardsCount)
    } else {
      this.bus.progress('cj_binder_archivist', ownedCardsCount)
    }

    if (ownedCardsCount >= 100) {
      this.bus.unlock('cj_binder_deckbuilder', ownedCardsCount)
    } else {
      this.bus.progress('cj_binder_deckbuilder', ownedCardsCount)
    }

    if (ownedCardsCount >= 25) {
      this.bus.unlock('cj_binder_novice', ownedCardsCount)
    } else {
      this.bus.progress('cj_binder_novice', ownedCardsCount)
    }
  }

  /** Call when player purchases booster packs from the Dojo store or profile loads. */
  onPacksPurchased(packsCount: number): void {
    if (packsCount >= 10) {
      this.bus.unlock('cj_pack_cracker', packsCount)
    } else {
      this.bus.progress('cj_pack_cracker', packsCount)
    }
  }
}

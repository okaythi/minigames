import { describe, it, expect } from 'vitest'
import {
  getThresholdForRank,
  applyMatchProgression,
  getTierProgress,
  ITEM_AWARDS,
  STARTER_DECK_CARDS,
  STARTER_DECK_ITEM_ID,
} from '../shared/progression'

describe('Card-Jitsu Progression Engine — Houdini & Disney Parity', () => {
  describe('Experience Threshold Formula ((r + 1) * r / 2) * 5', () => {
    it('calculates exact thresholds for ranks 0 through 9', () => {
      expect(getThresholdForRank(0)).toBe(0)
      expect(getThresholdForRank(1)).toBe(5)   // White Belt
      expect(getThresholdForRank(2)).toBe(15)  // Yellow Belt
      expect(getThresholdForRank(3)).toBe(30)  // Orange Belt
      expect(getThresholdForRank(4)).toBe(50)  // Green Belt
      expect(getThresholdForRank(5)).toBe(75)  // Blue Belt
      expect(getThresholdForRank(6)).toBe(105) // Red Belt
      expect(getThresholdForRank(7)).toBe(140) // Purple Belt
      expect(getThresholdForRank(8)).toBe(180) // Brown Belt
      expect(getThresholdForRank(9)).toBe(225) // Black Belt
    })

    it('exhibits exact arithmetic tier differences of 5, 10, 15, ..., 45', () => {
      const expectedDiffs = [5, 10, 15, 20, 25, 30, 35, 40, 45]
      for (let r = 1; r <= 9; r++) {
        const diff = getThresholdForRank(r) - getThresholdForRank(r - 1)
        expect(diff).toBe(expectedDiffs[r - 1])
      }
    })
  })

  describe('Ranks 0→1 through 8→9 Incremental Rank Progression', () => {
    it('ranks up 0→1 (White Belt) upon reaching 5 exp (+5 win)', () => {
      const res = applyMatchProgression(
        { rank: 0, progress: 0, matchesWon: 0 },
        { winner: 'player', mode: 'belts' },
      )
      expect(res.rank).toBe(1)
      expect(res.progress).toBe(5)
      expect(res.matchesWon).toBe(1)
      expect(res.awardRank).toBe(1)
    })

    it('ranks up 0→1 (White Belt) upon reaching 5 exp via losses (+1 loss)', () => {
      let state = { rank: 0, progress: 0, matchesWon: 0 }
      for (let i = 0; i < 4; i++) {
        state = applyMatchProgression(state, { winner: 'opponent', mode: 'belts' })
        expect(state.rank).toBe(0)
        expect(state.awardRank).toBeUndefined()
      }
      expect(state.progress).toBe(4)

      const finalLoss = applyMatchProgression(state, { winner: 'opponent', mode: 'belts' })
      expect(finalLoss.rank).toBe(1)
      expect(finalLoss.progress).toBe(5)
      expect(finalLoss.awardRank).toBe(1)
      expect(finalLoss.matchesWon).toBe(0)
    })

    it('progresses through every rank 0→1 through 8→9 step-by-step', () => {
      let state = { rank: 0, progress: 0, matchesWon: 0 }

      for (let targetRank = 1; targetRank <= 9; targetRank++) {
        const targetExp = getThresholdForRank(targetRank)
        while (state.progress < targetExp) {
          state = applyMatchProgression(state, { winner: 'player', mode: 'belts' })
        }
        expect(state.rank).toBe(targetRank)
        expect(state.awardRank).toBe(targetRank)
      }

      expect(state.rank).toBe(9)
      expect(state.progress).toBe(225)
    })
  })

  describe('Rank 9 Black Belt and Sensei Challenge Case', () => {
    it('awards no exp at rank >= 9 in standard belt matches', () => {
      const state = { rank: 9, progress: 225, matchesWon: 45 }
      const winResult = applyMatchProgression(state, { winner: 'player', mode: 'belts' })

      expect(winResult.rank).toBe(9)
      expect(winResult.progress).toBe(225) // No exp added
      expect(winResult.matchesWon).toBe(46)
      expect(winResult.awardRank).toBeUndefined()

      const lossResult = applyMatchProgression(state, { winner: 'opponent', mode: 'belts' })
      expect(lossResult.rank).toBe(9)
      expect(lossResult.progress).toBe(225) // No exp added
      expect(lossResult.awardRank).toBeUndefined()
    })

    it('does not rank up to 10 if losing to Sensei at rank 9', () => {
      const state = { rank: 9, progress: 225, matchesWon: 50 }
      const res = applyMatchProgression(state, { winner: 'opponent', mode: 'sensei' })

      expect(res.rank).toBe(9)
      expect(res.progress).toBe(225)
      expect(res.awardRank).toBeUndefined()
    })

    it('awards rank 10 (Ninja Master) upon beating Sensei at rank 9 in sensei mode with zero XP gain', () => {
      const state = { rank: 9, progress: 225, matchesWon: 50 }
      const res = applyMatchProgression(state, { winner: 'player', mode: 'sensei' })

      expect(res.rank).toBe(10)
      expect(res.progress).toBe(225) // Zero XP granted
      expect(res.matchesWon).toBe(51)
      expect(res.awardRank).toBe(10)
    })

    it('awards normal progression for completed Sensei matches below Black Belt', () => {
      // Houdini's Sensei handler calls ninja_progress(p, False) when Sensei
      // wins, so a training loss is still rewarded.
      const lossAtRank1 = applyMatchProgression(
        { rank: 1, progress: 8, matchesWon: 2 },
        { winner: 'opponent', mode: 'sensei' },
      )
      expect(lossAtRank1.progress).toBe(9)
      expect(lossAtRank1.rank).toBe(1)
      expect(lossAtRank1.awardRank).toBeUndefined()

      // A completed player win must be rewarded even if the Sensei counter
      // flow unexpectedly allows it below Black Belt.
      const winAtGreenBelt = applyMatchProgression(
        { rank: 4, progress: 70, matchesWon: 8 },
        { winner: 'player', mode: 'sensei' },
      )
      expect(winAtGreenBelt.progress).toBe(75)
      expect(winAtGreenBelt.rank).toBe(5)
      expect(winAtGreenBelt.matchesWon).toBe(9)
      expect(winAtGreenBelt.awardRank).toBe(5)

      // Loss progress can award the first belt as well.
      const lossAtRank0 = applyMatchProgression(
        { rank: 0, progress: 4, matchesWon: 0 },
        { winner: 'opponent', mode: 'sensei' },
      )
      expect(lossAtRank0.progress).toBe(5)
      expect(lossAtRank0.rank).toBe(1)
      expect(lossAtRank0.awardRank).toBe(1)
    })
  })

  describe('UI Tier Progression Display Calculations (Footer)', () => {
    it('calculates White Belt tier progress as x / 10', () => {
      // White Belt is rank 1 (starts at 5 exp, next Yellow Belt is 15 exp, tier requirement = 10)
      const tier = getTierProgress(1, 6)
      expect(tier.neededInTier).toBe(10)
      expect(tier.currentInTier).toBe(1) // 6 - 5 = 1
      expect(tier.isMax).toBe(false)
    })

    it('calculates Yellow Belt tier progress as x / 15', () => {
      // Yellow Belt is rank 2 (starts at 15 exp, next Orange Belt is 30 exp, tier requirement = 15)
      const tier = getTierProgress(2, 20)
      expect(tier.neededInTier).toBe(15)
      expect(tier.currentInTier).toBe(5) // 20 - 15 = 5
      expect(tier.isMax).toBe(false)
    })

    it('reports isMax for rank >= 9', () => {
      const tier = getTierProgress(9, 225)
      expect(tier.isMax).toBe(true)
    })
  })

  describe('Item and Deck Constants', () => {
    it('has 10 item awards ending with Ninja Mask (104)', () => {
      expect(ITEM_AWARDS).toHaveLength(10)
      expect(ITEM_AWARDS[0]).toBe(4025) // White Belt
      expect(ITEM_AWARDS[8]).toBe(4033) // Black Belt
      expect(ITEM_AWARDS[9]).toBe(104)  // Ninja Mask
    })

    it('has item 821 starter deck with 12 cards', () => {
      expect(STARTER_DECK_ITEM_ID).toBe(821)
      expect(STARTER_DECK_CARDS).toEqual([1, 6, 9, 14, 17, 20, 22, 23, 26, 73, 81, 89])
    })
  })
})

/**
 * Card-Jitsu Progression Engine — Houdini & Disney Club Penguin Parity
 * 
 * Threshold formula (Houdini ninja.py):
 * threshold(r) = ((r + 1) * r // 2) * 5
 * Differences:
 * r=1: 5 (White Belt)
 * r=2: 15 (Yellow Belt, delta: 10)
 * r=3: 30 (Orange Belt, delta: 15)
 * r=4: 50 (Green Belt, delta: 20)
 * r=5: 75 (Blue Belt, delta: 25)
 * r=6: 105 (Red Belt, delta: 30)
 * r=7: 140 (Purple Belt, delta: 35)
 * r=8: 180 (Brown Belt, delta: 40)
 * r=9: 225 (Black Belt, delta: 45)
 */

export const BELT_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type BeltRank = (typeof BELT_RANKS)[number]

export const MIN_BELT_RANK: BeltRank = 1
export const MAX_BELT_RANK: BeltRank = 9
export const SENSEI_RANK = 10

export type NinjaBelt =
  | 'white'
  | 'yellow'
  | 'orange'
  | 'green'
  | 'blue'
  | 'red'
  | 'purple'
  | 'brown'
  | 'black'

export interface BeltInfo {
  readonly belt: NinjaBelt
  readonly name: string
  readonly rank: BeltRank
  readonly requiredExp: number
  readonly colorHex: string
}

export const BELT_TO_RANK: Readonly<Record<NinjaBelt, BeltRank>> = {
  white: 1,
  yellow: 2,
  orange: 3,
  green: 4,
  blue: 5,
  red: 6,
  purple: 7,
  brown: 8,
  black: 9,
} as const

export const RANK_TO_BELT: Readonly<Record<BeltRank, NinjaBelt>> = {
  1: 'white',
  2: 'yellow',
  3: 'orange',
  4: 'green',
  5: 'blue',
  6: 'red',
  7: 'purple',
  8: 'brown',
  9: 'black',
} as const

export const ITEM_AWARDS: readonly number[] = [
  4025, // Rank 1: White Belt
  4026, // Rank 2: Yellow Belt
  4027, // Rank 3: Orange Belt
  4028, // Rank 4: Green Belt
  4029, // Rank 5: Blue Belt
  4030, // Rank 6: Red Belt
  4031, // Rank 7: Purple Belt
  4032, // Rank 8: Brown Belt
  4033, // Rank 9: Black Belt
  104,  // Rank 10: Ninja Mask
] as const

export const STARTER_DECK_ITEM_ID = 821
export const STARTER_DECK_CARDS: readonly number[] = [
  1, 6, 9, 14, 17, 20, 22, 23, 26, 73, 81, 89
] as const

/**
 * Calculates absolute experience threshold to attain rank r.
 * threshold(r) = ((r + 1) * r / 2) * 5
 */
export function getThresholdForRank(rank: number): number {
  if (rank <= 0) return 0
  return Math.floor(((rank + 1) * rank) / 2) * 5
}
export const getRequiredExp = getThresholdForRank

export const BELT_PROGRESSION: readonly BeltInfo[] = [
  { belt: 'white', name: 'White Belt', rank: 1, requiredExp: 5, colorHex: '#ECEFF1' },
  { belt: 'yellow', name: 'Yellow Belt', rank: 2, requiredExp: 15, colorHex: '#FDD835' },
  { belt: 'orange', name: 'Orange Belt', rank: 3, requiredExp: 30, colorHex: '#FB8C00' },
  { belt: 'green', name: 'Green Belt', rank: 4, requiredExp: 50, colorHex: '#43A047' },
  { belt: 'blue', name: 'Blue Belt', rank: 5, requiredExp: 75, colorHex: '#1E88E5' },
  { belt: 'red', name: 'Red Belt', rank: 6, requiredExp: 105, colorHex: '#E53935' },
  { belt: 'purple', name: 'Purple Belt', rank: 7, requiredExp: 140, colorHex: '#8E24AA' },
  { belt: 'brown', name: 'Brown Belt', rank: 8, requiredExp: 180, colorHex: '#6D4C41' },
  { belt: 'black', name: 'Black Belt', rank: 9, requiredExp: 225, colorHex: '#212121' },
] as const

export function getBeltRank(belt: NinjaBelt): BeltRank {
  return BELT_TO_RANK[belt] ?? 1
}

export function getRankBelt(rank: number): NinjaBelt {
  const clamped = Math.max(MIN_BELT_RANK, Math.min(MAX_BELT_RANK, Math.floor(rank))) as BeltRank
  return RANK_TO_BELT[clamped]
}

export function getRankForExp(exp: number): number {
  let rank = 0
  while (rank < 9 && getThresholdForRank(rank + 1) <= exp) {
    rank++
  }
  return rank
}

export function getNextRank(rank: number): number | null {
  if (rank >= SENSEI_RANK) return null
  if (rank === MAX_BELT_RANK) return SENSEI_RANK
  return rank + 1
}

export interface ProgressionInputState {
  readonly rank: number
  readonly progress: number
  readonly matchesWon: number
}

export interface MatchOutcome {
  readonly winner: 'player' | 'opponent'
  readonly mode: 'belts' | 'sensei'
}

export interface ProgressionOutputState {
  readonly rank: number
  readonly progress: number
  readonly matchesWon: number
  readonly awardRank?: number
}

/**
 * Authoritative progression calculation:
 * - Win: +5 exp, matchesWon + 1
 * - Loss: +1 exp
 * - Rank up when progress >= threshold(rank + 1) (capped at rank 9)
 * - No exp gained when rank >= 9
 * - At rank 9, beating Sensei in 'sensei' mode awards rank 10
 */
export function applyMatchProgression(
  current: ProgressionInputState,
  match: MatchOutcome,
): ProgressionOutputState {
  let rank = current.rank
  let progress = current.progress
  let matchesWon = current.matchesWon
  let awardRank: number | undefined = undefined

  const playerWon = match.winner === 'player'

  if (playerWon) {
    matchesWon += 1
  }

  if (rank < 9) {
    const expGain = playerWon ? 5 : 1
    progress += expGain

    while (rank < 9 && progress >= getThresholdForRank(rank + 1)) {
      rank++
      awardRank = rank
    }
  } else if (rank === 9 && match.mode === 'sensei' && playerWon) {
    rank = 10
    awardRank = 10
  }

  return {
    rank,
    progress,
    matchesWon,
    ...(awardRank !== undefined ? { awardRank } : {}),
  }
}

/**
 * Returns tier progress for UI (e.g. Belt HUD):
 * - currentInTier: exp accumulated since previous rank threshold
 * - neededInTier: exp required between previous rank and next rank
 */
export function getTierProgress(rank: number, progress: number): {
  readonly currentInTier: number
  readonly neededInTier: number
  readonly isMax: boolean
} {
  if (rank >= 9) {
    return {
      currentInTier: 0,
      neededInTier: 0,
      isMax: true,
    }
  }

  const prevThreshold = getThresholdForRank(rank)
  const nextThreshold = getThresholdForRank(rank + 1)
  const neededInTier = nextThreshold - prevThreshold
  const currentInTier = Math.max(0, Math.min(neededInTier, progress - prevThreshold))

  return {
    currentInTier,
    neededInTier,
    isMax: false,
  }
}

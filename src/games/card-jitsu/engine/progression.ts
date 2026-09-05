import type { BeltInfo, NinjaBelt } from '../types'

export const BELT_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type BeltRank = (typeof BELT_RANKS)[number]

export const MIN_BELT_RANK: BeltRank = 1
export const MAX_BELT_RANK: BeltRank = 9
export const SENSEI_RANK = 10

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

/**
 * Houdini experience requirement calculation (ninja.py L49):
 * ((rank + 1) * rank // 2) * 5
 */
export function getRequiredExp(rank: number): number {
  if (rank <= 0) return 0
  return Math.floor(((rank + 1) * rank) / 2) * 5
}

export const BELT_PROGRESSION: readonly BeltInfo[] = [
  { belt: 'white', name: 'White Belt', requiredWins: 0, colorHex: '#ECEFF1' },
  { belt: 'yellow', name: 'Yellow Belt', requiredWins: 5, colorHex: '#FDD835' },
  { belt: 'orange', name: 'Orange Belt', requiredWins: 13, colorHex: '#FB8C00' },
  { belt: 'green', name: 'Green Belt', requiredWins: 21, colorHex: '#43A047' },
  { belt: 'blue', name: 'Blue Belt', requiredWins: 30, colorHex: '#1E88E5' },
  { belt: 'red', name: 'Red Belt', requiredWins: 40, colorHex: '#E53935' },
  { belt: 'purple', name: 'Purple Belt', requiredWins: 52, colorHex: '#8E24AA' },
  { belt: 'brown', name: 'Brown Belt', requiredWins: 64, colorHex: '#6D4C41' },
  { belt: 'black', name: 'Black Belt', requiredWins: 76, colorHex: '#212121' },
] as const

export function getBeltRank(belt: NinjaBelt): BeltRank {
  return BELT_TO_RANK[belt] ?? 1
}

export function getRankBelt(rank: number): NinjaBelt {
  const clamped = Math.max(MIN_BELT_RANK, Math.min(MAX_BELT_RANK, Math.floor(rank))) as BeltRank
  return RANK_TO_BELT[clamped]
}

export function getRankForExp(exp: number): BeltRank {
  let rank: BeltRank = 1
  for (let r = 1; r <= 9; r++) {
    if (exp >= getRequiredExp(r - 1)) {
      rank = r as BeltRank
    }
  }
  return rank
}

export function getNextRank(rank: BeltRank): BeltRank | null {
  if (rank >= MAX_BELT_RANK) return null
  return (rank + 1) as BeltRank
}

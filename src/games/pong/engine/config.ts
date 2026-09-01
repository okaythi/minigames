import type { ActivePowerup, Difficulty, PowerupType } from './types'

export const ARENA = { width: 360, height: 480 } as const
export const PADDLE = { width: 60, height: 10, offset: 20 } as const
export const BALL = { radius: 5, initialSpeed: 250, maxSpeed: 600 } as const
export const MAX_BOUNCE_ANGLE = Math.PI / 3 // 60 degrees
export const PADDLE_EXTENSION_STEP = 0.15

export const AI_SPEED_FACTORS: Readonly<Record<Difficulty, number>> = {
  easy: 0.7,
  normal: 0.75,
  hard: 0.8,
  'very-hard': 1,
} as const

export const POWERUP_DURATIONS: Readonly<
  Record<'speed' | 'extension' | 'glass-wall', Readonly<Record<Difficulty, number>>>
> = {
  speed: { easy: 18, normal: 15, hard: 10, 'very-hard': 8 },
  extension: { easy: 30, normal: 30, hard: 30, 'very-hard': 15 },
  'glass-wall': { easy: 15, normal: 15, hard: 10, 'very-hard': 6 },
} as const

export function extensionScale(activePowerups: readonly ActivePowerup[]): number {
  const extensions = activePowerups.filter((powerup) => powerup.type === 'extension').length
  return 1 + extensions * PADDLE_EXTENSION_STEP
}

export const COSTS: Readonly<Record<PowerupType, number>> = {
  speed: 10,
  extension: 20,
  magnet: 20,
  'glass-wall': 25,
} as const

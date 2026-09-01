export const ARENA = { width: 360, height: 480 }
export const PADDLE = { width: 60, height: 10, offset: 20 }
export const BALL = { radius: 5, initialSpeed: 250, maxSpeed: 600 }
export const MAX_BOUNCE_ANGLE = Math.PI / 3 // 60 degrees
export const PADDLE_EXTENSION_STEP = 0.15

export const AI_SPEED_FACTORS = {
  easy: 0.88,
  normal: 0.95,
  hard: 1,
  'very-hard': 1,
} as const

export const POWERUP_DURATIONS = {
  speed: { easy: 18, normal: 15, hard: 10, 'very-hard': 8 },
  extension: { easy: 30, normal: 30, hard: 30, 'very-hard': 15 },
  'glass-wall': { easy: 15, normal: 15, hard: 10, 'very-hard': 6 },
} as const

export function extensionScale(activePowerups: readonly { readonly type: string }[]): number {
  const extensions = activePowerups.filter((powerup) => powerup.type === 'extension').length
  return 1 + extensions * PADDLE_EXTENSION_STEP
}

export const COSTS = {
  'speed': 10,
  'extension': 20,
  'magnet': 20,
  'glass-wall': 25
}

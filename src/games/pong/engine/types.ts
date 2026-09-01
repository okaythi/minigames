export type Difficulty = 'easy' | 'normal' | 'hard' | 'very-hard'
export type Mode = 11 | 21 | 30
export type PowerupType = 'speed' | 'extension' | 'magnet' | 'glass-wall'
export type AIPowerupType = 'speed' | 'extension' | 'fast-ball'

export interface ActivePowerup {
  readonly type: PowerupType | AIPowerupType
  timeRemaining: number
  readonly duration: number
}

export interface PaddleState {
  x: number
  y: number
  w: number
  h: number
  vx: number
  maxV: number
  activePowerups: ActivePowerup[]
  targetX?: number
}

export interface BallState {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  speed: number
  stuckToPlayer: boolean
  stuckTime: number
}

export interface CandyState {
  x: number
  y: number
  radius: number
  active: boolean
  claimedBy: 'player' | 'ai' | null
}

export interface PongNotification {
  text: string
  time: number
  y: number
}

export type PongPhase = 'menu' | 'config' | 'loadout' | 'playing' | 'over'

export interface PongState {
  phase: PongPhase
  mode: Mode
  difficulty: Difficulty
  playerScore: number
  aiScore: number
  playerHits: number

  ball: BallState
  player: PaddleState
  ai: PaddleState

  slots: (PowerupType | null)[]
  aiSlots: (AIPowerupType | null)[]
  candy: CandyState[]
  candySpawnTimer: number

  playerMagnetActive: boolean
  playerGlassWallActive: boolean
  playerGlassWallTimeRemaining: number

  lastHitBy: 'player' | 'ai' | null
  notifications: PongNotification[]
  aiReactionTimer: number
  aiErrorOffset: number
}

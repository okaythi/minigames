export type Direction = 'up' | 'down' | 'left' | 'right'

export type CycleId = 'p1' | 'ai' | 'p2'

export type GameMode = 'campaign' | 'vs' | 'online'

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface Point {
  readonly x: number
  readonly y: number
}

export interface TrailSegment {
  readonly isTurbo: boolean
  readonly points: Point[]
}

export interface GridCoord {
  readonly col: number
  readonly row: number
}

export interface AILevelConfig {
  readonly level: DifficultyLevel
  readonly name: string
  readonly tagline: string
  readonly description: string
  readonly reactionTime: number
  readonly lookaheadSteps: number
  readonly stairProbability: number
  readonly enjoysStairs: boolean
  readonly fillQuality: 'none' | 'imperfect' | 'perfect'
  readonly maxTurbos: number
  readonly infiniteTurbos: boolean
  readonly offensiveTurbo: boolean
  readonly useVoronoi: boolean
  readonly interceptAggression: number
  readonly turboConfig: import('./ai/turbo/types').TurboConfig
}

export interface SmokeParticle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
  life: number
  maxLife: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
  size: number
  life: number
  maxLife: number
  shape: 'shard' | 'spark' | 'smoke' | 'trail_glow'
  rotation?: number
  vRot?: number
}

export interface QueuedInput {
  readonly dir: Direction
  readonly expiresAt: number
}

export interface CycleState {
  readonly id: CycleId
  x: number
  y: number
  col: number
  row: number
  dir: Direction
  targetDir: Direction
  inputBuffer: readonly QueuedInput[]
  alive: boolean
  crashedAt: Point | null
  crashTime: number | null
  smokeParticles: readonly SmokeParticle[]
  turbosLeft: number
  isTurbo: boolean
  turboTimer: number
  turboCooldown: number
  turboFlickerTimer: number
  trail: TrailSegment[]
}

export type MatchPhase =
  | 'menu'
  | 'countdown'
  | 'playing'
  | 'round_over'
  | 'intermission'
  | 'victory'
  | 'game_over'

export interface TronState {
  phase: MatchPhase
  mode: GameMode
  level: DifficultyLevel
  p1RoundWins: number
  aiRoundWins: number
  roundNumber: number
  countdownTimer: number
  phaseTimer: number
  elapsedRunSeconds: number
  p1: CycleState
  ai: CycleState
  roundWinner: CycleId | 'tie' | null
  particles: Particle[]
  bannerText: string | null
  bannerSubtext: string | null
}

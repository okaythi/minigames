import type { PowerupType } from '../engine/types'

export interface PongFonts {
  readonly sans: string
  readonly mono: string
}

export interface TrailDot {
  readonly x: number
  readonly y: number
  life: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  readonly maxLife: number
  readonly color: string
}

export interface PulseRing {
  readonly x: number
  readonly y: number
  readonly color: string
  life: number
  readonly maxLife: number
  readonly maxRadius: number
}

export interface PongFx {
  readonly trail: TrailDot[]
  readonly particles: Particle[]
  readonly rings: PulseRing[]
  previousBall: { x: number; y: number } | null
  lastPlayerHits: number
  lastPlayerScore: number
  lastAiScore: number
}

export interface PowerupTimer {
  readonly type: PowerupType
  readonly timeRemaining: number
  readonly duration: number
}

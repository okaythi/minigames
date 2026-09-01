import type { GameRuntimeDeps } from '../../template/types'
import type { Store } from '../../../lib/observable-store'
import type { GameSnapshot, GameRunStatus, GameStatTile } from '../../template/snapshot'

export type Difficulty = 'easy' | 'normal' | 'hard' | 'very-hard'
export type Mode = 11 | 21 | 30
export type PowerupType = 'speed' | 'extension' | 'magnet' | 'glass-wall'
export type AIPowerupType = 'speed' | 'extension' | 'fast-ball'

export interface PongState {
  phase: 'menu' | 'loadout' | 'playing' | 'over'
  mode: Mode
  difficulty: Difficulty
  playerScore: number
  aiScore: number
  
  // Physics
  ball: { x: number; y: number; vx: number; vy: number; radius: number }
  player: { x: number; y: number; w: number; h: number; vx: number; maxV: number }
  ai: { x: number; y: number; w: number; h: number; vx: number; maxV: number }
  
  // Powerups
  slots: PowerupType[]
  aiSlots: AIPowerupType[]
  candy: { x: number; y: number; w: number; h: number; active: boolean; claimedBy: 'player' | 'ai' | null }[]
  
  magnetActive: boolean
  glassWallActive: boolean
  
  lastHitBy: 'player' | 'ai' | null
}

export class PongEngine {
  state: PongState
  deps: { readonly current: GameRuntimeDeps }
  store: Store<GameSnapshot>
  frameId = 0
  keys = new Set<string>()

  constructor(deps: { readonly current: GameRuntimeDeps }, store: Store<GameSnapshot>) {
    this.deps = deps
    this.store = store
    this.state = this.initialState()
  }

  initialState(): PongState {
    return {
      phase: 'menu',
      mode: 11,
      difficulty: 'normal',
      playerScore: 0,
      aiScore: 0,
      ball: { x: 180, y: 240, vx: 0, vy: 0, radius: 5 },
      player: { x: 180, y: 460, w: 60, h: 10, vx: 0, maxV: 200 },
      ai: { x: 180, y: 20, w: 60, h: 10, vx: 0, maxV: 200 },
      slots: [],
      aiSlots: [],
      candy: [],
      magnetActive: false,
      glassWallActive: false,
      lastHitBy: null
    }
  }

  start() {
    // Called when user clicks "Start" on the React overlay
    // We go to loadout.
    this.state.phase = 'loadout'
    this.publish('running')
  }
  pause() { this.publish('paused') }
  resume() { this.publish('running') }
  restart() {
    this.state = this.initialState()
    this.publish('ready')
  }
  toggleMute() {}
  dispose() {}

  update(_dt: number) {
    if (this.state.phase === 'playing') {
       this.stepPhysics(_dt)
    }
    this.publish('running') // continuously publish if we need to update tiles? No, just when score changes.
  }

  stepPhysics(_dt: number) {
    // Simple placeholder physics to satisfy the existence of the loop for now
  }

  publish(status: GameRunStatus) {
    const tiles: GameStatTile[] = [
      { label: 'Player', value: this.state.playerScore.toString(), note: '' },
      { label: 'AI', value: this.state.aiScore.toString(), note: '' },
    ]
    this.store.update((s) => ({
      ...s,
      status,
      score: this.state.playerScore,
      best: this.deps.current.best,
      bonus: this.deps.current.bonus,
      tiles,
      run: status === 'over' ? {
        score: this.deps.current.best || 0,
        bonus: this.deps.current.bonus,
        seconds: 0,
        note: this.state.playerScore > this.state.aiScore ? 'You Won!' : 'You Lost!',
        isRecord: false,
        beatBestBy: null
      } : null
    }))
  }
}

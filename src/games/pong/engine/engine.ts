import type { GameRuntimeDeps } from '../../template/types'
import type { Store } from '../../../lib/observable-store'
import type { GameSnapshot, GameRunStatus, GameStatTile } from '../../template/snapshot'
import { ARENA, PADDLE, BALL, MAX_BOUNCE_ANGLE, AI_SPEED_FACTORS, extensionScale } from './config'
import { activatePowerupState } from './powerups'
import { updateAI } from './ai'

export type Difficulty = 'easy' | 'normal' | 'hard' | 'very-hard'
export type Mode = 11 | 21 | 30
export type PowerupType = 'speed' | 'extension' | 'magnet' | 'glass-wall'
export type AIPowerupType = 'speed' | 'extension' | 'fast-ball'

export interface PaddleState {
  x: number
  y: number
  w: number
  h: number
  vx: number
  maxV: number
  activePowerups: { type: string; timeRemaining: number; duration: number }[]
  targetX?: number
}

export interface PongState {
  phase: 'menu' | 'config' | 'loadout' | 'playing' | 'over'
  mode: Mode
  difficulty: Difficulty
  playerScore: number
  aiScore: number
  playerHits: number

  ball: { x: number; y: number; vx: number; vy: number; radius: number; speed: number; stuckToPlayer: boolean; stuckTime: number }
  player: PaddleState
  ai: PaddleState

  slots: (PowerupType | null)[]
  aiSlots: (AIPowerupType | null)[]
  candy: { x: number; y: number; radius: number; active: boolean; claimedBy: 'player' | 'ai' | null }[]
  candySpawnTimer: number

  playerMagnetActive: boolean
  playerGlassWallActive: boolean
  playerGlassWallTimeRemaining: number

  lastHitBy: 'player' | 'ai' | null
  notifications: { text: string; time: number; y: number }[]
}

export class PongEngine {
  state: PongState
  deps: { readonly current: GameRuntimeDeps }
  store: Store<GameSnapshot>
  frameId = 0
  pointerX = ARENA.width / 2
  pointerDown = false

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
      playerHits: 0,
      ball: { x: ARENA.width/2, y: ARENA.height/2, vx: 0, vy: 0, radius: BALL.radius, speed: BALL.initialSpeed, stuckToPlayer: false, stuckTime: 0 },
      player: { x: ARENA.width/2, y: ARENA.height - PADDLE.offset, w: PADDLE.width, h: PADDLE.height, vx: 0, maxV: 250, activePowerups: [] },
      ai: { x: ARENA.width/2, y: PADDLE.offset, w: PADDLE.width, h: PADDLE.height, vx: 0, maxV: 250, activePowerups: [] },
      slots: [],
      aiSlots: [],
      candy: [],
      candySpawnTimer: 8,
      playerMagnetActive: false,
      playerGlassWallActive: false,
      playerGlassWallTimeRemaining: 0,
      lastHitBy: null,
      notifications: []
    }
  }

  start() {
    if (this.state.phase === 'menu') {
      this.state.phase = 'config'
      this.publish('running')
    }
  }

  isVeryHardUnlocked(): boolean {
    return (['easy', 'normal', 'hard'] as const).every((difficulty) =>
      this.deps.current.completedDifficulties.includes(difficulty),
    )
  }

  confirmConfig() {
    if (this.state.difficulty === 'very-hard' && !this.isVeryHardUnlocked()) {
      this.state.difficulty = 'normal'
    }
    this.state.phase = 'loadout'
    const maxSlots = this.state.mode === 11 ? 5 : this.state.mode === 21 ? 6 : 7
    this.state.slots = Array(maxSlots).fill(null)

    if (this.state.difficulty === 'hard') {
       this.state.aiSlots = ['speed', 'extension']
    } else if (this.state.difficulty === 'very-hard') {
       this.state.aiSlots = ['speed', 'extension', 'fast-ball', 'speed', 'extension']
    } else {
       this.state.aiSlots = []
    }
  }

  startMatch() {
    this.state.phase = 'playing'
    this.deps.current.beginRun()
    this.resetBall(1)
  }

  resetBall(dir: 1 | -1) {
    this.state.ball.x = ARENA.width / 2
    this.state.ball.y = ARENA.height / 2
    this.state.ball.speed = BALL.initialSpeed
    const angle = (Math.random() - 0.5) * MAX_BOUNCE_ANGLE
    this.state.ball.vx = this.state.ball.speed * Math.sin(angle)
    this.state.ball.vy = this.state.ball.speed * Math.cos(angle) * dir
    this.state.lastHitBy = null
    this.state.candy = []
    this.state.candySpawnTimer = 8 + Math.random() * 6
  }

  releaseMagnetBall(): void {
    if (!this.state.ball.stuckToPlayer) return
    this.state.ball.stuckToPlayer = false
    this.state.ball.stuckTime = 0
    this.bounceBall(this.state.player, -1)
    this.state.notifications.push({ text: 'BALL RELEASED', time: 1.2, y: this.state.player.y - 30 })
  }

  pause() { this.publish('paused') }
  resume() { this.publish('running') }
  restart() {
    this.state = this.initialState()
    this.publish('ready')
  }
  toggleMute() {}
  dispose() {}

  update(dt: number) {
    if (this.state.phase === 'playing') {
       this.stepPhysics(dt)
       updateAI(this.state, dt, (idx) => activatePowerupState(this.state, idx, false))
       this.checkCollisions()
       this.updatePowerups(dt)
       this.updateCandy(dt)
    }
    this.publish(this.state.phase === 'playing' || this.state.phase === 'loadout' || this.state.phase === 'config' ? 'running' : 'over')
  }

  stepPhysics(dt: number) {
    const s = this.state

    const currentW = s.player.w * extensionScale(s.player.activePowerups)
    const currentMaxV = s.player.maxV * (s.player.activePowerups.some(p => p.type === 'speed') ? 2 : 1)

    const dx = this.pointerX - s.player.x
    const dist = Math.abs(dx)
    if (dist > 0) {
       const move = Math.sign(dx) * Math.min(dist, currentMaxV * dt)
       s.player.x += move
    }
    s.player.x = Math.max(currentW/2, Math.min(ARENA.width - currentW/2, s.player.x))

    const aiW = s.ai.w * extensionScale(s.ai.activePowerups)
    const aiBaseMaxV = s.player.maxV * AI_SPEED_FACTORS[s.difficulty]
    s.ai.maxV = aiBaseMaxV
    const aiMaxV = aiBaseMaxV * (s.ai.activePowerups.some(p => p.type === 'speed') ? 2 : 1)
    if (s.ai.targetX !== undefined) {
       const adx = s.ai.targetX - s.ai.x
       const adist = Math.abs(adx)
       if (adist > 0) {
          s.ai.x += Math.sign(adx) * Math.min(adist, aiMaxV * dt)
       }
    }
    s.ai.x = Math.max(aiW/2, Math.min(ARENA.width - aiW/2, s.ai.x))

    if (s.ball.stuckToPlayer) {
       s.ball.stuckTime += dt
       s.ball.x = s.player.x
       s.ball.y = s.player.y - s.player.h/2 - s.ball.radius
    } else {
       s.ball.x += s.ball.vx * dt
       s.ball.y += s.ball.vy * dt
    }

    if (s.ball.x - s.ball.radius <= 0) {
       s.ball.x = s.ball.radius
       s.ball.vx *= -1
    } else if (s.ball.x + s.ball.radius >= ARENA.width) {
       s.ball.x = ARENA.width - s.ball.radius
       s.ball.vx *= -1
    }

    for (let i = s.notifications.length - 1; i >= 0; i--) {
       const n = s.notifications[i]
       if (n) {
          n.time -= dt
          if (n.time <= 0) s.notifications.splice(i, 1)
       }
    }
  }

  bounceBall(paddle: PaddleState, dir: 1 | -1) {
    const s = this.state
    const currentW = paddle.w * extensionScale(paddle.activePowerups)

    const intersect = (s.ball.x - paddle.x) / (currentW / 2)
    const clamped = Math.max(-1, Math.min(1, intersect))

    const angle = clamped * MAX_BOUNCE_ANGLE

    s.ball.speed = Math.min(BALL.maxSpeed, s.ball.speed * 1.05)

    s.ball.vx = s.ball.speed * Math.sin(angle)
    s.ball.vy = s.ball.speed * Math.cos(angle) * dir
  }

  checkCollisions() {
    const s = this.state
    const { ball, player, ai } = s

    const aiW = ai.w * extensionScale(ai.activePowerups)
    if (ball.vy < 0 && ball.y - ball.radius <= ai.y + ai.h/2) {
       if (Math.abs(ball.x - ai.x) <= aiW/2 + ball.radius) {
          ball.y = ai.y + ai.h/2 + ball.radius
          this.bounceBall(ai, 1)
          s.lastHitBy = 'ai'
       }
    }

    const plW = player.w * extensionScale(player.activePowerups)
    if (!ball.stuckToPlayer && ball.vy > 0 && ball.y + ball.radius >= player.y - player.h/2) {
       if (Math.abs(ball.x - player.x) <= plW/2 + ball.radius) {
          ball.y = player.y - player.h/2 - ball.radius
          s.playerHits++
          s.lastHitBy = 'player'
          if (s.playerMagnetActive) {
             s.ball.stuckToPlayer = true
             s.ball.stuckTime = 0
             s.playerMagnetActive = false
             s.notifications.push({ text: 'MAGNETIZED', time: 1.5, y: player.y - 30 })
          } else {
             this.bounceBall(player, -1)
          }
       } else if (s.playerGlassWallActive && ball.y > player.y) {
          s.playerGlassWallActive = false
          s.playerGlassWallTimeRemaining = 0
          ball.y = player.y - ball.radius
          ball.vy *= -1
          s.lastHitBy = 'player'
          s.notifications.push({ text: 'GLASS WALL SHATTERED', time: 2, y: player.y - 30 })
       }
    }

    if (ball.y < 0) {
       s.playerScore++
       this.checkWin()
       if (s.phase === 'playing') this.resetBall(-1)
    } else if (ball.y > ARENA.height) {
       s.aiScore++
       this.checkWin()
       if (s.phase === 'playing') this.resetBall(1)
    }
  }

  updateCandy(dt: number) {
    const s = this.state
    s.candySpawnTimer -= dt
    if (s.candySpawnTimer <= 0) {
       if (!s.candy.some(candy => candy.active)) {
          s.candySpawnTimer = 8 + Math.random() * 6
          s.candy.push({
             x: 40 + Math.random() * (ARENA.width - 80),
             y: ARENA.height/2 - 50 + Math.random() * 100,
             radius: 6,
             active: true,
             claimedBy: null
          })
       } else {
          // Keep checking, but give the player a short respawn grace period
          // after the current piece is finally collected.
          s.candySpawnTimer = 3
       }
    }

    for (let i = s.candy.length - 1; i >= 0; i--) {
       const c = s.candy[i]
       if (c && c.active) {
          const dx = s.ball.x - c.x
          const dy = s.ball.y - c.y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist <= s.ball.radius + c.radius && s.lastHitBy === 'player') {
             c.active = false
             c.claimedBy = 'player'
             this.deps.current.bankBonus(5)
             s.notifications.push({ text: '+5 CANDY', time: 1.5, y: c.y - 20 })
          }
       }
    }
  }

  checkWin() {
    const s = this.state
    if (s.playerScore >= s.mode || s.aiScore >= s.mode) {
       s.phase = 'over'
       this.deps.current.finishRun(s.playerHits, {
         difficulty: s.difficulty,
         won: s.playerScore >= s.mode,
       })
    }
  }

  updatePowerups(dt: number) {
    const s = this.state
    const tick = (pList: {type: string, timeRemaining: number}[]) => {
      for (let i = pList.length - 1; i >= 0; i--) {
        const p = pList[i]
        if (p) {
           p.timeRemaining -= dt
           if (p.timeRemaining <= 0) pList.splice(i, 1)
        }
      }
    }
    tick(s.player.activePowerups)
    tick(s.ai.activePowerups)

    if (s.playerGlassWallActive) {
      s.playerGlassWallTimeRemaining -= dt
      if (s.playerGlassWallTimeRemaining <= 0) {
        s.playerGlassWallTimeRemaining = 0
        s.playerGlassWallActive = false
        s.notifications.push({ text: 'GLASS WALL GONE', time: 1.5, y: s.player.y - 30 })
      }
    }
  }

  handleInput(key: string, isDown: boolean) {
    if (isDown) {
      if (key === 'Enter' && this.state.phase === 'over') {
        this.restart()
        return
      }
      if (this.state.ball.stuckToPlayer && (key === ' ' || key === 'Space' || key === 'Spacebar')) {
        this.releaseMagnetBall()
        return
      }
      if (['1','2','3','4','5','6','7'].includes(key)) {
        const idx = parseInt(key) - 1
        if (idx < this.state.slots.length && this.state.slots[idx]) {
          activatePowerupState(this.state, idx, true)
        }
      }
    }
  }

  publish(status: GameRunStatus) {
    if (this.state.phase === 'menu') {
      status = 'ready'
    } else if (this.state.phase === 'loadout' || this.state.phase === 'config') {
      status = 'running'
    } else if (this.state.phase === 'over') {
      status = 'over'
    }
    const tiles: GameStatTile[] = [
      { label: 'Player', value: this.state.playerScore.toString(), note: '' },
      { label: 'AI', value: this.state.aiScore.toString(), note: '' },
    ]
    this.store.update((s) => ({
      ...s,
      status,
      score: this.state.playerHits,
      best: this.deps.current.best,
      bonus: this.deps.current.bonus,
      tiles,
      run: status === 'over' ? {
        score: this.state.playerHits,
        bonus: this.deps.current.bonus,
        seconds: 0,
        note: this.state.playerScore > this.state.aiScore ? 'You Won!' : 'You Lost!',
        isRecord: false,
        beatBestBy: null
      } : null
    }))
  }
}

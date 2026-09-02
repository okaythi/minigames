import type { GameRuntimeDeps } from '../../template/types'
import type { Store } from '../../../lib/observable-store'
import type { GameSnapshot, GameRunStatus } from '../../template/snapshot'
import { ARENA, PADDLE, BALL, MAX_BOUNCE_ANGLE, AI_REACTION_DELAY } from './config'
import { activatePowerupState, updatePowerups } from './powerups'
import { updateAI } from './ai'
import { stepPhysics } from './physics'
import { checkCollisions, bounceBall } from './collision'
import { updateCandy } from './candies'
import { snapshotFor } from './snapshot'
import type { IAudioEngine } from '../../../lib/audio-engine'
import type { SfxName } from './audio/sfx'
import type { Difficulty, Mode, PowerupType, AIPowerupType, PongState } from './types'
import type { PongAchievementTracker } from '../achievement-tracker'

export type { Difficulty, Mode, PowerupType, AIPowerupType, PongState }

export class PongEngine {
  public state: PongState
  public deps: { readonly current: GameRuntimeDeps }
  public store: Store<GameSnapshot>
  public audio: IAudioEngine<SfxName>
  public pointerX = ARENA.width / 2
  public pointerDown = false
  private achievements: PongAchievementTracker | null

  public constructor(
    deps: { readonly current: GameRuntimeDeps },
    store: Store<GameSnapshot>,
    audio: IAudioEngine<SfxName>,
    achievements: PongAchievementTracker | null = null,
  ) {
    this.deps = deps
    this.store = store
    this.audio = audio
    this.achievements = achievements
    this.state = this.initialState()
  }

  public get isDeveloper(): boolean {
    return this.deps.current.developer
  }

  public initialState(): PongState {
    return {
      phase: 'menu',
      mode: 11,
      difficulty: 'normal',
      playerScore: 0,
      aiScore: 0,
      playerHits: 0,
      ball: {
        x: ARENA.width / 2,
        y: ARENA.height / 2,
        vx: 0,
        vy: 0,
        radius: BALL.radius,
        speed: BALL.initialSpeed,
        stuckToPlayer: false,
        stuckTime: 0,
      },
      player: {
        x: ARENA.width / 2,
        y: ARENA.height - PADDLE.offset,
        w: PADDLE.width,
        h: PADDLE.height,
        vx: 0,
        maxV: 250,
        activePowerups: [],
      },
      ai: {
        x: ARENA.width / 2,
        y: PADDLE.offset,
        w: PADDLE.width,
        h: PADDLE.height,
        vx: 0,
        maxV: 250,
        activePowerups: [],
      },
      slots: [],
      aiSlots: [],
      candy: [],
      candySpawnTimer: 8,
      playerMagnetActive: false,
      playerGlassWallActive: false,
      playerGlassWallTimeRemaining: 0,
      lastHitBy: null,
      notifications: [],
      aiReactionTimer: 0,
      aiErrorOffset: 0,
    }
  }

  public start(): void {
    if (this.state.phase === 'menu') {
      this.state.phase = 'config'
      this.publish('running')
    }
  }

  public isVeryHardUnlocked(): boolean {
    return (['easy', 'normal', 'hard'] as const).every((difficulty) =>
      this.deps.current.completedDifficulties.includes(difficulty),
    )
  }

  public confirmConfig(): void {
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

  public startMatch(): void {
    this.audio.unlock()
    this.state.phase = 'playing'
    this.deps.current.beginRun()
    this.achievements?.onMatchStart(this.state.difficulty)
    this.resetBall(1)
    this.audio.play('start')
  }

  public resetBall(dir: 1 | -1): void {
    this.state.ball.x = ARENA.width / 2
    this.state.ball.y = ARENA.height / 2
    this.state.ball.speed = BALL.initialSpeed
    const angle = (Math.random() - 0.5) * MAX_BOUNCE_ANGLE
    this.state.ball.vx = this.state.ball.speed * Math.sin(angle)
    this.state.ball.vy = this.state.ball.speed * Math.cos(angle) * dir
    this.state.lastHitBy = null
    this.state.candy = []
    this.state.candySpawnTimer = 8 + Math.random() * 6
    if (dir === -1) {
      this.state.aiReactionTimer = AI_REACTION_DELAY
      this.state.aiErrorOffset = (Math.random() - 0.5) * (this.state.ai.w * 0.7)
    } else {
      this.state.aiReactionTimer = 0
      this.state.aiErrorOffset = 0
    }
  }

  public releaseMagnetBall(): void {
    if (!this.state.ball.stuckToPlayer) return
    this.state.ball.stuckToPlayer = false
    this.state.ball.stuckTime = 0
    bounceBall(this.state, this.state.player, -1)
    this.state.aiReactionTimer = AI_REACTION_DELAY
    this.state.aiErrorOffset = (Math.random() - 0.5) * (this.state.ai.w * 0.7)
    this.audio.play('bounce')
    this.state.notifications.push({ text: 'BALL RELEASED', time: 1.2, y: this.state.player.y - 30 })
  }

  public notifyPowerupPurchased(): void {
    this.achievements?.onPowerupPurchased()
  }

  public pause(): void {
    this.publish('paused')
  }

  public resume(): void {
    this.publish('running')
  }

  public restart(): void {
    this.state = this.initialState()
    this.publish('ready')
  }

  public toggleMute(): void {
    this.audio.toggleMuted()
  }

  public dispose(): void {}

  public update(dt: number): void {
    if (this.state.phase === 'playing') {
      stepPhysics(this.state, this.pointerX, dt, () => {
        this.audio.play('flap')
      })

      updateAI(this.state, dt, (idx) => {
        if (activatePowerupState(this.state, idx, false)) {
          this.audio.play('powerup')
        }
      })

      checkCollisions(this.state, {
        onPaddleHit: () => {
          this.audio.play('bounce')
          this.achievements?.onPaddleHit(this.state.playerHits)
        },
        onScorePoint: (scorer) => {
          this.audio.play('bounce')
          if (scorer === 'player') {
            this.achievements?.onPlayerScores(performance.now() / 1000)
          } else {
            this.achievements?.onAiScores()
          }
          this.checkWin()
          if (this.state.phase === 'playing') {
            this.resetBall(scorer === 'player' ? -1 : 1)
          }
        },
      })

      updatePowerups(this.state, dt)

      updateCandy(this.state, dt, (amount, y) => {
        this.audio.play('candy')
        this.deps.current.bankBonus(amount)
        this.state.notifications.push({ text: `+${amount} CANDY`, time: 1.5, y: y - 20 })
      })
    }

    this.publish(
      this.state.phase === 'playing' || this.state.phase === 'loadout' || this.state.phase === 'config'
        ? 'running'
        : 'over',
    )
  }

  public handleInput(key: string, isDown: boolean): void {
    if (isDown) {
      if (key === 'Enter' && this.state.phase === 'over') {
        this.restart()
        return
      }
      if (this.state.ball.stuckToPlayer && (key === ' ' || key === 'Space' || key === 'Spacebar')) {
        this.releaseMagnetBall()
        return
      }
      if (['1', '2', '3', '4', '5', '6', '7'].includes(key)) {
        const idx = Number.parseInt(key, 10) - 1
        if (idx < this.state.slots.length && this.state.slots[idx]) {
          if (activatePowerupState(this.state, idx, true)) {
            this.audio.play('powerup')
            const type = this.state.slots[idx]
            if (type) {
              this.achievements?.onPowerupActivated(type, performance.now() / 1000)
            }
          }
        }
      }
    }
  }

  private checkWin(): void {
    const s = this.state
    if (s.playerScore >= s.mode || s.aiScore >= s.mode) {
      s.phase = 'over'
      const playerWon = s.playerScore >= s.mode
      this.deps.current.finishRun(s.playerHits, {
        difficulty: s.difficulty,
        won: playerWon,
      })
      this.achievements?.onMatchEnd(playerWon, s.difficulty, s.playerScore, s.aiScore)
    }
  }

  private publish(_status: GameRunStatus): void {
    const snapshot = snapshotFor(this.state, this.deps.current)
    this.store.set(snapshot)
  }
}

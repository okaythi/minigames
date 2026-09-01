import { ARENA, BALL, MAX_BOUNCE_ANGLE, extensionScale } from './config'
import type { PaddleState, PongState } from './types'

export interface CollisionHandlers {
  readonly onPaddleHit: () => void
  readonly onScorePoint: (scorer: 'player' | 'ai') => void
}

export function bounceBall(state: PongState, paddle: PaddleState, dir: 1 | -1): void {
  const currentW = paddle.w * extensionScale(paddle.activePowerups)
  const intersect = (state.ball.x - paddle.x) / (currentW / 2)
  const clamped = Math.max(-1, Math.min(1, intersect))
  const angle = clamped * MAX_BOUNCE_ANGLE

  state.ball.speed = Math.min(BALL.maxSpeed, state.ball.speed * 1.05)
  state.ball.vx = state.ball.speed * Math.sin(angle)
  state.ball.vy = state.ball.speed * Math.cos(angle) * dir
}

export function checkCollisions(state: PongState, handlers: CollisionHandlers): void {
  const s = state
  const { ball, player, ai } = s

  const aiW = ai.w * extensionScale(ai.activePowerups)
  if (ball.vy < 0 && ball.y - ball.radius <= ai.y + ai.h / 2) {
    if (Math.abs(ball.x - ai.x) <= aiW / 2 + ball.radius) {
      ball.y = ai.y + ai.h / 2 + ball.radius
      bounceBall(s, ai, 1)
      s.lastHitBy = 'ai'
      handlers.onPaddleHit()
    }
  }

  const plW = player.w * extensionScale(player.activePowerups)
  if (!ball.stuckToPlayer && ball.vy > 0 && ball.y + ball.radius >= player.y - player.h / 2) {
    if (Math.abs(ball.x - player.x) <= plW / 2 + ball.radius) {
      ball.y = player.y - player.h / 2 - ball.radius
      s.playerHits++
      s.lastHitBy = 'player'
      if (s.playerMagnetActive) {
        s.ball.stuckToPlayer = true
        s.ball.stuckTime = 0
        s.playerMagnetActive = false
        s.notifications.push({ text: 'MAGNETIZED', time: 1.5, y: player.y - 30 })
      } else {
        bounceBall(s, player, -1)
        handlers.onPaddleHit()
      }
    } else if (s.playerGlassWallActive && ball.y > player.y) {
      s.playerGlassWallActive = false
      s.playerGlassWallTimeRemaining = 0
      ball.y = player.y - ball.radius
      ball.vy *= -1
      s.lastHitBy = 'player'
      s.notifications.push({ text: 'GLASS WALL SHATTERED', time: 2, y: player.y - 30 })
      handlers.onPaddleHit()
    }
  }

  if (ball.y < 0) {
    s.playerScore++
    handlers.onScorePoint('player')
  } else if (ball.y > ARENA.height) {
    s.aiScore++
    handlers.onScorePoint('ai')
  }
}

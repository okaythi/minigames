import { ARENA } from '../engine/config'
import type { PongEngine } from '../engine/engine'
import type { PongFx } from './types'
import { PALETTE, withAlpha } from '../../../theme/palette'

export function createFx(): PongFx {
  return {
    trail: [],
    particles: [],
    rings: [],
    previousBall: null,
    lastPlayerHits: 0,
    lastPlayerScore: 0,
    lastAiScore: 0,
  }
}

export function captureFx(engine: PongEngine, fx: PongFx): void {
  const state = engine.state
  if (state.phase !== 'playing') {
    fx.previousBall = null
    fx.trail.length = 0
    fx.lastPlayerHits = state.playerHits
    fx.lastPlayerScore = state.playerScore
    fx.lastAiScore = state.aiScore
    return
  }

  const ball = state.ball
  if (fx.previousBall !== null) {
    const distance = Math.hypot(ball.x - fx.previousBall.x, ball.y - fx.previousBall.y)
    if (distance < 100) {
      fx.trail.unshift({ x: ball.x, y: ball.y, life: 0.38 })
    } else {
      fx.trail.length = 0
    }
  }
  fx.previousBall = { x: ball.x, y: ball.y }

  if (state.playerHits > fx.lastPlayerHits) {
    burst(fx, ball.x, state.player.y, PALETTE.blue, 10)
    ring(fx, ball.x, state.player.y, PALETTE.blue, 32)
  }
  if (state.playerScore > fx.lastPlayerScore) {
    burst(fx, ARENA.width / 2, ARENA.height - 42, PALETTE.blue, 16)
    ring(fx, ARENA.width / 2, ARENA.height / 2, PALETTE.blue, 84)
  }
  if (state.aiScore > fx.lastAiScore) {
    burst(fx, ARENA.width / 2, 42, PALETTE.orange, 16)
    ring(fx, ARENA.width / 2, ARENA.height / 2, PALETTE.orange, 84)
  }

  fx.lastPlayerHits = state.playerHits
  fx.lastPlayerScore = state.playerScore
  fx.lastAiScore = state.aiScore
}

export function burst(fx: PongFx, x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35
    const speed = 24 + Math.random() * 46
    const maxLife = 0.32 + Math.random() * 0.22
    fx.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.5 + Math.random() * 2,
      life: maxLife,
      maxLife,
      color,
    })
  }
}

export function ring(fx: PongFx, x: number, y: number, color: string, maxRadius: number): void {
  fx.rings.push({ x, y, color, life: 0.42, maxLife: 0.42, maxRadius })
}

export function advanceFx(fx: PongFx, dt: number): void {
  for (let i = fx.trail.length - 1; i >= 0; i -= 1) {
    const dot = fx.trail[i]
    if (dot === undefined) continue
    dot.life -= dt
    if (dot.life <= 0) fx.trail.splice(i, 1)
  }
  if (fx.trail.length > 18) fx.trail.length = 18

  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const particle = fx.particles[i]
    if (particle === undefined) continue
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vx *= 0.96
    particle.vy *= 0.96
    particle.life -= dt
    if (particle.life <= 0) fx.particles.splice(i, 1)
  }

  for (let i = fx.rings.length - 1; i >= 0; i -= 1) {
    const pulse = fx.rings[i]
    if (pulse === undefined) continue
    pulse.life -= dt
    if (pulse.life <= 0) fx.rings.splice(i, 1)
  }
}

export function drawFx(ctx: CanvasRenderingContext2D, fx: PongFx): void {
  ctx.save()
  for (const dot of fx.trail) {
    const alpha = Math.max(0, Math.min(1, dot.life / 0.38)) * 0.28
    ctx.fillStyle = withAlpha(PALETTE.red, alpha)
    ctx.beginPath()
    ctx.arc(dot.x, dot.y, 2 + dot.life * 7, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const pulse of fx.rings) {
    const progress = 1 - pulse.life / pulse.maxLife
    ctx.strokeStyle = withAlpha(pulse.color, Math.max(0, pulse.life / pulse.maxLife) * 0.55)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(pulse.x, pulse.y, progress * pulse.maxRadius, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (const particle of fx.particles) {
    ctx.fillStyle = withAlpha(particle.color, Math.max(0, particle.life / particle.maxLife))
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

import { ARENA, POWERUP_DURATIONS } from '../engine/config'
import type { PongEngine } from '../engine/engine'
import type { PowerupType } from '../engine/types'
import type { PowerupTimer } from './types'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath } from '../../../lib/canvas'

export function itemYFor(type: PowerupType): number {
  switch (type) {
    case 'speed':
      return 100
    case 'extension':
      return 150
    case 'magnet':
      return 200
    case 'glass-wall':
      return 250
  }
}

export function drawPowerupIcon(
  ctx: CanvasRenderingContext2D,
  type: PowerupType,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const half = size / 2
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = withAlpha(color, 0.16)
  ctx.lineWidth = Math.max(1, size * 0.12)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (type === 'speed') {
    ctx.beginPath()
    ctx.moveTo(x + half * 0.2, y - half)
    ctx.lineTo(x - half * 0.15, y - half * 0.05)
    ctx.lineTo(x + half * 0.15, y - half * 0.05)
    ctx.lineTo(x - half * 0.25, y + half)
    ctx.lineTo(x + half * 0.65, y - half * 0.28)
    ctx.lineTo(x + half * 0.2, y - half * 0.28)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (type === 'extension') {
    roundRectPath(ctx, x - half * 0.6, y - half * 0.22, size * 0.6, size * 0.44, 1.5)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - half, y)
    ctx.lineTo(x - half * 0.55, y - half * 0.4)
    ctx.moveTo(x - half, y)
    ctx.lineTo(x - half * 0.55, y + half * 0.4)
    ctx.moveTo(x + half, y)
    ctx.lineTo(x + half * 0.55, y - half * 0.4)
    ctx.moveTo(x + half, y)
    ctx.lineTo(x + half * 0.55, y + half * 0.4)
    ctx.stroke()
  } else if (type === 'magnet') {
    ctx.beginPath()
    ctx.arc(x, y - half * 0.05, half * 0.65, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - half * 0.65, y + half * 0.08)
    ctx.lineTo(x - half * 0.65, y + half * 0.52)
    ctx.moveTo(x + half * 0.65, y + half * 0.08)
    ctx.lineTo(x + half * 0.65, y + half * 0.52)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.fillRect(x - half * 0.82, y + half * 0.35, half * 0.34, half * 0.28)
    ctx.fillRect(x + half * 0.48, y + half * 0.35, half * 0.34, half * 0.28)
  } else {
    ctx.beginPath()
    ctx.moveTo(x, y - half)
    ctx.lineTo(x + half * 0.72, y - half * 0.62)
    ctx.lineTo(x + half * 0.58, y + half * 0.55)
    ctx.lineTo(x, y + half)
    ctx.lineTo(x - half * 0.58, y + half * 0.55)
    ctx.lineTo(x - half * 0.72, y - half * 0.62)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - half * 0.35, y - half * 0.45)
    ctx.lineTo(x + half * 0.05, y - half * 0.08)
    ctx.lineTo(x - half * 0.18, y + half * 0.28)
    ctx.moveTo(x + half * 0.05, y - half * 0.08)
    ctx.lineTo(x + half * 0.4, y - half * 0.32)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawPowerupTimers(ctx: CanvasRenderingContext2D, engine: PongEngine, time: number): void {
  const playerTimers: PowerupTimer[] = engine.state.player.activePowerups
    .filter((p): p is typeof p & { type: PowerupType } => p.type !== 'fast-ball')
    .map((powerup) => ({
      type: powerup.type,
      timeRemaining: powerup.timeRemaining,
      duration: powerup.duration,
    }))
  if (engine.state.playerGlassWallActive) {
    playerTimers.push({
      type: 'glass-wall',
      timeRemaining: engine.state.playerGlassWallTimeRemaining,
      duration: POWERUP_DURATIONS['glass-wall'][engine.state.difficulty],
    })
  }

  const aiTimers: PowerupTimer[] = engine.state.ai.activePowerups
    .filter((p): p is typeof p & { type: PowerupType } => p.type !== 'fast-ball')
    .map((powerup) => ({
      type: powerup.type,
      timeRemaining: powerup.timeRemaining,
      duration: powerup.duration,
    }))
  for (let i = 0; i < playerTimers.length; i += 1) {
    const timer = playerTimers[i]
    if (timer !== undefined) drawPowerupTimer(ctx, timer, 474 - i * 4, 'bottom', time)
  }
  for (let i = 0; i < aiTimers.length; i += 1) {
    const timer = aiTimers[i]
    if (timer !== undefined) drawPowerupTimer(ctx, timer, 6 + i * 4, 'top', time)
  }
}

export function drawPowerupTimer(
  ctx: CanvasRenderingContext2D,
  timer: PowerupTimer,
  y: number,
  side: 'top' | 'bottom',
  time: number,
): void {
  const left = 18
  const width = ARENA.width - 36
  const progress = Math.max(0, Math.min(1, timer.timeRemaining / timer.duration))
  const end = left + width * progress

  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = withAlpha(PALETTE.orange, 0.14)
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(left + width, y)
  ctx.stroke()

  ctx.lineWidth = 2
  ctx.shadowColor = PALETTE.orange
  ctx.shadowBlur = 7
  ctx.strokeStyle = withAlpha(PALETTE.orangeBright, 0.95)
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(end, y)
  ctx.stroke()
  ctx.shadowColor = 'transparent'

  const spark = 1.8 + (Math.sin(time * 370 + y) + 1) * 0.55
  ctx.fillStyle = PALETTE.orangeBright
  ctx.beginPath()
  ctx.arc(end, y, spark, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = withAlpha(PALETTE.orangeBright, 0.72)
  ctx.lineWidth = 0.8
  for (let i = 0; i < 4; i += 1) {
    const angle = (time * 19 + (i * Math.PI) / 2 + (side === 'top' ? 0 : Math.PI / 4))
    const ray = 3 + ((Math.sin(time * 41 + i) + 1) / 2) * 3
    ctx.beginPath()
    ctx.moveTo(end + Math.cos(angle) * 1.5, y + Math.sin(angle) * 1.5)
    ctx.lineTo(end + Math.cos(angle) * ray, y + Math.sin(angle) * ray)
    ctx.stroke()
  }
  ctx.restore()
}

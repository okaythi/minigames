import { ARENA, extensionScale } from '../engine/config'
import type { PaddleState, PongState } from '../engine/types'
import type { PongFonts } from './types'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath, setCanvasFont } from '../../../lib/canvas'

export function paddleWidth(paddle: PaddleState): number {
  return paddle.w * extensionScale(paddle.activePowerups)
}

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  deepColor: string,
  time: number,
): void {
  const left = x - width / 2
  const top = y - height / 2
  ctx.save()
  ctx.shadowColor = withAlpha(color, 0.3)
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 3
  roundRectPath(ctx, left, top, width, height, 5)
  const gradient = ctx.createLinearGradient(left, top, left, top + height)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.46, color)
  gradient.addColorStop(1, deepColor)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1
  ctx.strokeStyle = withAlpha(deepColor, 0.92)
  ctx.stroke()

  ctx.globalAlpha = 0.75 + Math.sin(time * 4) * 0.12
  roundRectPath(ctx, left + 3, top + 2, width - 6, 2, 1)
  ctx.fillStyle = '#fffdf9'
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = withAlpha('#fffdf9', 0.3)
  for (let i = 0; i < 3; i += 1) {
    roundRectPath(ctx, left + width * (0.25 + i * 0.25) - 2, top + height / 2 - 1, 4, 2, 1)
    ctx.fill()
  }
  ctx.restore()
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  time: number,
): void {
  ctx.save()
  ctx.shadowColor = withAlpha(PALETTE.red, 0.68)
  ctx.shadowBlur = 18 + Math.sin(time * 5) * 3
  const gradient = ctx.createRadialGradient(x - 1.5, y - 2, 0.5, x, y, radius * 1.7)
  gradient.addColorStop(0, '#fffdf9')
  gradient.addColorStop(0.26, PALETTE.orangeBright)
  gradient.addColorStop(0.7, PALETTE.red)
  gradient.addColorStop(1, PALETTE.redDeep)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius + 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1
  ctx.strokeStyle = withAlpha(PALETTE.redDeep, 0.9)
  ctx.stroke()

  ctx.strokeStyle = withAlpha('#fffdf9', 0.75)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, radius + 4, time, time + Math.PI * 1.25)
  ctx.stroke()
  ctx.fillStyle = '#fffdf9'
  ctx.globalAlpha = 0.86
  ctx.beginPath()
  ctx.arc(x - 1.7, y - 1.8, 1.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function glassWallIsVisible(timeRemaining: number, time: number): boolean {
  if (timeRemaining > 2.4) return true
  const flicker = Math.sin(time * 37.7) + Math.sin(time * 83.1) * 0.55 + Math.sin(time * 127.3) * 0.3
  return flicker > -0.15
}

export function drawGlassWall(
  ctx: CanvasRenderingContext2D,
  playerY: number,
  timeRemaining: number,
  time: number,
): void {
  if (!glassWallIsVisible(timeRemaining, time)) return
  const wallGradient = ctx.createLinearGradient(0, playerY, 0, playerY + 18)
  wallGradient.addColorStop(0, withAlpha(PALETTE.blue, 0.05))
  wallGradient.addColorStop(0.5, withAlpha(PALETTE.blue, 0.32))
  wallGradient.addColorStop(1, withAlpha(PALETTE.blue, 0.02))
  ctx.fillStyle = wallGradient
  ctx.fillRect(0, playerY + 9, ARENA.width, 18)
  ctx.strokeStyle = withAlpha(PALETTE.blue, 0.7)
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.moveTo(0, playerY + 10)
  ctx.lineTo(ARENA.width, playerY + 10)
  ctx.stroke()
  ctx.setLineDash([])
}

export function drawMagnetPrompt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  fonts: PongFonts,
): void {
  const width = 210
  const height = 38
  const left = Math.max(12, Math.min(ARENA.width - width - 12, x - width / 2))
  const top = Math.max(24, y - 58)
  ctx.save()
  ctx.globalAlpha = 0.94 + Math.sin(time * 4) * 0.04
  roundRectPath(ctx, left, top, width, height, 8)
  ctx.fillStyle = withAlpha(PALETTE.blueDeep, 0.94)
  ctx.fill()
  ctx.strokeStyle = withAlpha(PALETTE.blue, 0.9)
  ctx.stroke()
  setCanvasFont(ctx, 800, 9, fonts.mono)
  ctx.fillStyle = PALETTE.card
  ctx.textAlign = 'center'
  ctx.fillText('MAGNET LOCKED', left + width / 2, top + 14)
  setCanvasFont(ctx, 650, 8, fonts.sans)
  ctx.fillStyle = withAlpha(PALETTE.card, 0.9)
  ctx.fillText('CLICK · TAP · SPACE TO RELEASE', left + width / 2, top + 28)
  ctx.restore()
}

export function drawNotifications(
  ctx: CanvasRenderingContext2D,
  state: PongState,
  fonts: PongFonts,
): void {
  setCanvasFont(ctx, 800, 11, fonts.mono)
  ctx.textAlign = 'center'
  for (const notification of state.notifications) {
    ctx.fillStyle = withAlpha(PALETTE.ink, Math.min(1, notification.time) * 0.86)
    ctx.fillText(notification.text, ARENA.width / 2, notification.y)
  }
}

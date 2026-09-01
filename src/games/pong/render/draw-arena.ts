import { ARENA } from '../engine/config'
import type { PongFonts } from './types'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { setCanvasFont } from '../../../lib/canvas'

export function drawArenaGrid(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save()
  for (let x = 30; x < ARENA.width; x += 30) {
    ctx.strokeStyle = withAlpha(PALETTE.line, x === 180 ? 0.32 : 0.2)
    ctx.lineWidth = x === 180 ? 1 : 0.6
    ctx.beginPath()
    ctx.moveTo(x, 14)
    ctx.lineTo(x, ARENA.height - 14)
    ctx.stroke()
  }
  for (let y = 40; y < ARENA.height; y += 40) {
    ctx.strokeStyle = withAlpha(PALETTE.line, 0.17)
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(14, y)
    ctx.lineTo(ARENA.width - 14, y)
    ctx.stroke()
  }

  const pulse = 0.46 + Math.sin(time * 3) * 0.12
  ctx.strokeStyle = withAlpha(PALETTE.orangeBright, pulse)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(18, 16)
  ctx.lineTo(62, 16)
  ctx.moveTo(ARENA.width - 62, ARENA.height - 16)
  ctx.lineTo(ARENA.width - 18, ARENA.height - 16)
  ctx.stroke()
  ctx.restore()
}

export function drawArenaBackdrop(ctx: CanvasRenderingContext2D, time: number, fonts: PongFonts): void {
  drawArenaGrid(ctx, time)
  setCanvasFont(ctx, 700, 10, fonts.mono)
  ctx.fillStyle = withAlpha(PALETTE.slate, 0.68)
  ctx.textAlign = 'left'
  ctx.fillText('NIXLABS // PONG', 20, 28)
  ctx.textAlign = 'right'
  ctx.fillText('READY', ARENA.width - 20, 28)
}

export function drawArenaCenterElements(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save()
  ctx.strokeStyle = withAlpha(PALETTE.lineStrong, 0.8)
  ctx.lineWidth = 1
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  ctx.moveTo(16, ARENA.height / 2)
  ctx.lineTo(ARENA.width - 16, ARENA.height / 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.strokeStyle = withAlpha(PALETTE.orangeBright, 0.17)
  ctx.beginPath()
  ctx.arc(ARENA.width / 2, ARENA.height / 2, 42 + Math.sin(time * 2) * 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

import { ARENA } from '../engine/config'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath, setCanvasFont } from '../../../lib/canvas'
import type { TronFonts } from './types'

export function drawArena(ctx: CanvasRenderingContext2D, time: number, fonts: TronFonts): void {
  // 1. Grid Floor Background
  ctx.fillStyle = PALETTE.paper
  ctx.fillRect(0, 0, ARENA.width, ARENA.height)

  // Ambient cyber grid glow
  const sweep = (Math.sin(time * 0.8) + 1) / 2
  const ambient = ctx.createRadialGradient(
    ARENA.width / 2,
    ARENA.height * (0.3 + sweep * 0.4),
    10,
    ARENA.width / 2,
    ARENA.height * 0.5,
    ARENA.width * 0.75,
  )
  ambient.addColorStop(0, withAlpha(PALETTE.blueTint, 0.45))
  ambient.addColorStop(0.6, withAlpha(PALETTE.sand, 0.2))
  ambient.addColorStop(1, withAlpha(PALETTE.paper, 0))
  ctx.fillStyle = ambient
  ctx.fillRect(0, 0, ARENA.width, ARENA.height)

  // 2. High-Tech Cyber Grid Lines
  ctx.lineWidth = 1
  ctx.strokeStyle = withAlpha(PALETTE.line, 0.7)
  ctx.beginPath()

  // Major grid lines every 24px
  const step = 24
  for (let x = 0; x <= ARENA.width; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, ARENA.height)
  }
  for (let y = 0; y <= ARENA.height; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(ARENA.width, y)
  }
  ctx.stroke()

  // Fine intersection crosshairs
  ctx.fillStyle = withAlpha(PALETTE.slate, 0.35)
  for (let x = step; x < ARENA.width; x += step * 2) {
    for (let y = step; y < ARENA.height; y += step * 2) {
      ctx.fillRect(x - 1, y - 1, 3, 3)
    }
  }

  // 3. Perimeter Outer Wall Hazard
  const wallMargin = 3
  const wallWidth = ARENA.width - wallMargin * 2
  const wallHeight = ARENA.height - wallMargin * 2

  // Outer glow
  ctx.save()
  ctx.shadowColor = withAlpha(PALETTE.graphite, 0.16)
  ctx.shadowBlur = 12
  roundRectPath(ctx, wallMargin, wallMargin, wallWidth, wallHeight, 4)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = PALETTE.ink
  ctx.stroke()
  ctx.restore()

  // Inner hairline perimeter
  ctx.lineWidth = 1
  ctx.strokeStyle = withAlpha(PALETTE.slate, 0.6)
  roundRectPath(ctx, wallMargin + 3, wallMargin + 3, wallWidth - 6, wallHeight - 6, 2)
  ctx.stroke()

  // Corner Brackets
  drawCornerBrackets(ctx, wallMargin, wallMargin, wallWidth, wallHeight)

  // Perimeter Coordinate Decals
  setCanvasFont(ctx, 700, 8, fonts.mono)
  ctx.fillStyle = withAlpha(PALETTE.slate, 0.65)
  ctx.textAlign = 'left'
  ctx.fillText('SECTOR // FL-3.0', 14, 16)
  ctx.textAlign = 'right'
  ctx.fillText('GRID // 80×106', ARENA.width - 14, 16)
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const arm = 16
  ctx.lineWidth = 3
  ctx.strokeStyle = PALETTE.orange

  // Top-Left
  ctx.beginPath()
  ctx.moveTo(x + 1, y + arm)
  ctx.lineTo(x + 1, y + 1)
  ctx.lineTo(x + arm, y + 1)
  ctx.stroke()

  // Top-Right
  ctx.beginPath()
  ctx.moveTo(x + w - arm - 1, y + 1)
  ctx.lineTo(x + w - 1, y + 1)
  ctx.lineTo(x + w - 1, y + arm)
  ctx.stroke()

  // Bottom-Left
  ctx.beginPath()
  ctx.moveTo(x + 1, y + h - arm - 1)
  ctx.lineTo(x + 1, y + h - 1)
  ctx.lineTo(x + arm, y + h - 1)
  ctx.stroke()

  // Bottom-Right
  ctx.beginPath()
  ctx.moveTo(x + w - arm - 1, y + h - 1)
  ctx.lineTo(x + w - 1, y + h - 1)
  ctx.lineTo(x + w - 1, y + h - arm - 1)
  ctx.stroke()
}

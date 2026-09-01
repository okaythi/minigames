import { ARENA, COSTS } from '../engine/config'
import type { PongEngine } from '../engine/engine'
import type { PowerupType } from '../engine/types'
import type { PongFonts } from './types'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath, setCanvasFont } from '../../../lib/canvas'
import { drawPowerupIcon, itemYFor } from './draw-powerups'

export const SHOP_ITEMS: readonly { type: PowerupType; name: string }[] = [
  { type: 'speed', name: 'Speed Boost' },
  { type: 'extension', name: 'Paddle Extension' },
  { type: 'magnet', name: 'Magnet' },
  { type: 'glass-wall', name: 'Glass Wall' },
]

export function drawConfig(ctx: CanvasRenderingContext2D, engine: PongEngine, fonts: PongFonts): void {
  drawPanel(ctx, 18, 18, ARENA.width - 36, ARENA.height - 36)
  setCanvasFont(ctx, 750, 21, fonts.sans)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'center'
  ctx.fillText('Game Settings', ARENA.width / 2, 52)
  setCanvasFont(ctx, 700, 10, fonts.mono)
  ctx.fillStyle = PALETTE.slate
  ctx.fillText('MATCH CONFIGURATION', ARENA.width / 2, 70)

  drawSectionLabel(ctx, 'POINTS TO WIN', 40, 93, fonts.mono)
  const modes = [11, 21, 30] as const
  for (let i = 0; i < modes.length; i += 1) {
    const mode = modes[i]
    if (mode === undefined) continue
    drawChoice(ctx, 40 + i * 100, 103, 80, 38, mode.toString(), engine.state.mode === mode, fonts.sans)
  }

  drawSectionLabel(ctx, 'DIFFICULTY', 40, 180, fonts.mono)
  const difficulties = [
    { value: 'easy', label: 'Easy', width: 60 },
    { value: 'normal', label: 'Normal', width: 80 },
    { value: 'hard', label: 'Hard', width: 60 },
  ] as const
  let x = 40
  for (const difficulty of difficulties) {
    drawChoice(
      ctx,
      x,
      200,
      difficulty.width,
      38,
      difficulty.label,
      engine.state.difficulty === difficulty.value,
      fonts.sans,
    )
    x += difficulty.width + 20
  }

  if (engine.isVeryHardUnlocked()) {
    drawChoice(ctx, 40, 250, 140, 38, 'Very Hard', engine.state.difficulty === 'very-hard', fonts.sans)
  }

  drawButton(ctx, ARENA.width / 2 - 50, ARENA.height - 80, 100, 40, 'Next', PALETTE.blue, PALETTE.blueDeep, fonts.sans)
}

export function drawLoadout(ctx: CanvasRenderingContext2D, engine: PongEngine, fonts: PongFonts): void {
  drawPanel(ctx, 18, 18, ARENA.width - 36, ARENA.height - 36)
  setCanvasFont(ctx, 750, 21, fonts.sans)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'center'
  ctx.fillText('Pre-Match Shop', ARENA.width / 2, 52)
  setCanvasFont(ctx, 650, 11, fonts.mono)
  ctx.fillStyle = PALETTE.orangeDeep
  ctx.fillText(`CANDY AVAILABLE  ${engine.deps.current.bonus}`, ARENA.width / 2, 72)

  for (const item of SHOP_ITEMS) {
    const y = itemYFor(item.type)
    drawShopItem(ctx, y, item.type, item.name, `${COSTS[item.type]} C`, fonts)
  }

  drawSectionLabel(ctx, `YOUR LOADOUT  ·  KEYS 1-${engine.state.slots.length}`, 40, 318, fonts.mono)
  const slotWidth = 30
  const gap = 10
  const totalWidth = engine.state.slots.length * slotWidth + (engine.state.slots.length - 1) * gap
  let slotX = (ARENA.width - totalWidth) / 2
  for (let i = 0; i < engine.state.slots.length; i += 1) {
    const slot = engine.state.slots[i]
    if (slot === undefined) continue
    roundRectPath(ctx, slotX, 340, slotWidth, slotWidth, 5)
    ctx.fillStyle = slot === null ? withAlpha(PALETTE.card, 0.72) : PALETTE.blueTint
    ctx.fill()
    ctx.strokeStyle = slot === null ? PALETTE.lineStrong : PALETTE.blue
    ctx.stroke()
    if (slot !== null) {
      drawPowerupIcon(ctx, slot, slotX + slotWidth / 2, 355, 10, PALETTE.blueDeep)
    }
    slotX += slotWidth + gap
  }

  drawButton(
    ctx,
    ARENA.width / 2 - 50,
    ARENA.height - 80,
    100,
    40,
    'Ready',
    PALETTE.orange,
    PALETTE.orangeDeep,
    fonts.sans,
  )
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.shadowColor = 'rgba(35, 35, 36, 0.12)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  roundRectPath(ctx, x, y, width, height, 14)
  ctx.fillStyle = withAlpha(PALETTE.card, 0.94)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = PALETTE.line
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

export function drawSectionLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
): void {
  setCanvasFont(ctx, 750, 10, font)
  ctx.fillStyle = PALETTE.slate
  ctx.textAlign = 'left'
  ctx.fillText(text, x, y)
}

export function drawChoice(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  selected: boolean,
  font: string,
  disabled = false,
): void {
  roundRectPath(ctx, x, y, width, height, 7)
  ctx.fillStyle = disabled ? withAlpha(PALETTE.sand, 0.58) : selected ? PALETTE.orange : PALETTE.card
  ctx.fill()
  ctx.strokeStyle = disabled ? PALETTE.line : selected ? PALETTE.orangeDeep : PALETTE.lineStrong
  ctx.stroke()
  setCanvasFont(ctx, 700, 13, font)
  ctx.fillStyle = disabled ? PALETTE.slate : selected ? PALETTE.card : PALETTE.ink
  ctx.textAlign = 'center'
  ctx.fillText(label, x + width / 2, y + 24)
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: string,
  deepColor: string,
  font: string,
): void {
  roundRectPath(ctx, x, y, width, height, 8)
  const gradient = ctx.createLinearGradient(x, y, x, y + height)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, deepColor)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.strokeStyle = deepColor
  ctx.stroke()
  setCanvasFont(ctx, 750, 14, font)
  ctx.fillStyle = PALETTE.card
  ctx.textAlign = 'center'
  ctx.fillText(label, x + width / 2, y + 25)
}

export function drawShopItem(
  ctx: CanvasRenderingContext2D,
  y: number,
  type: PowerupType,
  name: string,
  cost: string,
  fonts: PongFonts,
): void {
  roundRectPath(ctx, 40, y, ARENA.width - 80, 40, 7)
  ctx.fillStyle = PALETTE.card
  ctx.fill()
  ctx.strokeStyle = PALETTE.line
  ctx.stroke()
  drawPowerupIcon(ctx, type, 57, y + 20, 9, PALETTE.orangeDeep)
  setCanvasFont(ctx, 650, 13, fonts.sans)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'left'
  ctx.fillText(name, 72, y + 25)
  setCanvasFont(ctx, 750, 11, fonts.mono)
  ctx.fillStyle = PALETTE.orangeDeep
  ctx.textAlign = 'right'
  ctx.fillText(cost, ARENA.width - 52, y + 25)
}

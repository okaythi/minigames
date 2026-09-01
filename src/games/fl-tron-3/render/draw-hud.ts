import { AI_CONFIGS, ARENA, RULES } from '../engine/config'
import type { TronState } from '../engine/types'
import type { TronFonts } from './types'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath, setCanvasFont } from '../../../lib/canvas'
import { formatRunTimeComponents } from '../view-model'

export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: TronState,
  time: number,
  fonts: TronFonts,
): void {
  // Top HUD Bar: Level, Match Score, Speedrun Clock
  drawTopBar(ctx, state, fonts)

  // Bottom HUD: Turbo Battery Meters (P1 Left, AI Right)
  drawTurboMeters(ctx, state, time, fonts)
}

function drawTopBar(ctx: CanvasRenderingContext2D, state: TronState, fonts: TronFonts): void {
  const barY = 24
  const aiConfig = AI_CONFIGS[state.level]

  // Left: Level & AI Archetype
  setCanvasFont(ctx, 800, 11, fonts.mono)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'left'
  ctx.fillText(`LVL ${state.level} // ${aiConfig.name.toUpperCase()}`, 16, barY)

  // Center: Round Score Pips (First to 3)
  drawRoundScorePips(ctx, state.p1RoundWins, state.aiRoundWins, ARENA.width / 2, barY - 4)

  // Right: Speedrun Clock (mm:ss:ms with ms rendered as smaller subscript)
  const { mmss, ms } = formatRunTimeComponents(state.elapsedRunSeconds)
  ctx.textAlign = 'right'
  setCanvasFont(ctx, 800, 12, fonts.mono)
  ctx.fillStyle = PALETTE.ink
  ctx.fillText(mmss, ARENA.width - 38, barY)

  setCanvasFont(ctx, 700, 8.5, fonts.mono)
  ctx.fillStyle = PALETTE.slate
  ctx.fillText(`.${ms}`, ARENA.width - 16, barY)
}

function drawRoundScorePips(
  ctx: CanvasRenderingContext2D,
  p1Wins: number,
  aiWins: number,
  centerX: number,
  centerY: number,
): void {
  const pipRadius = 3.5
  const gap = 9
  const sideOffset = 18

  // P1 Pips (Blue) on left
  for (let i = 0; i < RULES.roundsToWinLevel; i += 1) {
    const x = centerX - sideOffset - (RULES.roundsToWinLevel - 1 - i) * gap
    ctx.beginPath()
    ctx.arc(x, centerY, pipRadius, 0, Math.PI * 2)
    if (i < p1Wins) {
      ctx.fillStyle = PALETTE.blue
      ctx.fill()
      ctx.strokeStyle = PALETTE.blueDeep
    } else {
      ctx.fillStyle = withAlpha(PALETTE.sand, 0.6)
      ctx.fill()
      ctx.strokeStyle = PALETTE.lineStrong
    }
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // VS divider text
  ctx.fillStyle = withAlpha(PALETTE.slate, 0.7)
  ctx.font = '600 8px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('VS', centerX, centerY + 2.5)

  // AI Pips (Orange) on right
  for (let i = 0; i < RULES.roundsToWinLevel; i += 1) {
    const x = centerX + sideOffset + i * gap
    ctx.beginPath()
    ctx.arc(x, centerY, pipRadius, 0, Math.PI * 2)
    if (i < aiWins) {
      ctx.fillStyle = PALETTE.orange
      ctx.fill()
      ctx.strokeStyle = PALETTE.orangeDeep
    } else {
      ctx.fillStyle = withAlpha(PALETTE.sand, 0.6)
      ctx.fill()
      ctx.strokeStyle = PALETTE.lineStrong
    }
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawTurboMeters(
  ctx: CanvasRenderingContext2D,
  state: TronState,
  time: number,
  fonts: TronFonts,
): void {
  const bottomY = ARENA.height - 24

  // P1 Turbo Battery (Bottom Left)
  drawPlayerTurbos(ctx, state.p1.turbosLeft, state.p1.isTurbo, 16, bottomY, fonts)

  // AI Turbo Battery (Bottom Right)
  drawAITurbos(ctx, state, time, ARENA.width - 16, bottomY, fonts)
}

function drawPlayerTurbos(
  ctx: CanvasRenderingContext2D,
  turbosLeft: number,
  isTurbo: boolean,
  x: number,
  y: number,
  fonts: TronFonts,
): void {
  setCanvasFont(ctx, 750, 8.5, fonts.mono)
  ctx.fillStyle = isTurbo ? PALETTE.blueDeep : PALETTE.slate
  ctx.textAlign = 'left'
  ctx.fillText('P1 TURBO [SPACE]', x, y - 6)

  const cellW = 18
  const cellH = 7
  const gap = 4

  for (let i = 0; i < RULES.playerTurbosPerRound; i += 1) {
    const cx = x + i * (cellW + gap)
    roundRectPath(ctx, cx, y, cellW, cellH, 1.5)
    if (i < turbosLeft) {
      ctx.fillStyle = isTurbo ? '#fffdf9' : PALETTE.blue
      ctx.fill()
      ctx.strokeStyle = PALETTE.blueDeep
    } else {
      ctx.fillStyle = withAlpha(PALETTE.sand, 0.5)
      ctx.fill()
      ctx.strokeStyle = PALETTE.line
    }
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawAITurbos(
  ctx: CanvasRenderingContext2D,
  state: TronState,
  time: number,
  x: number,
  y: number,
  fonts: TronFonts,
): void {
  const config = AI_CONFIGS[state.level]
  setCanvasFont(ctx, 750, 8.5, fonts.mono)
  ctx.fillStyle = state.ai.isTurbo ? PALETTE.orangeDeep : PALETTE.slate
  ctx.textAlign = 'right'
  ctx.fillText('AI TURBO', x, y - 6)

  if (config.infiniteTurbos) {
    // Infinite Turbos (Level 6 Master Core): Pulsing Infinite Symbol
    const pulse = 0.75 + Math.sin(time * 8) * 0.25
    setCanvasFont(ctx, 800, 13, fonts.mono)
    ctx.fillStyle = withAlpha(PALETTE.orangeDeep, pulse)
    ctx.fillText('∞ INFINITE', x, y + 8)
  } else if (config.level === 5) {
    // Level 5: 6 Turbos, bar flickers on use
    const cellW = 10
    const cellH = 7
    const gap = 3
    const totalW = 6 * cellW + 5 * gap
    const startX = x - totalW

    const isFlickering = state.ai.turboFlickerTimer > 0 && Math.sin(time * 35) > 0

    for (let i = 0; i < 6; i += 1) {
      const cx = startX + i * (cellW + gap)
      roundRectPath(ctx, cx, y, cellW, cellH, 1.5)
      if (isFlickering) {
        ctx.fillStyle = '#fffdf9'
      } else {
        ctx.fillStyle = PALETTE.orange
      }
      ctx.fill()
      ctx.strokeStyle = PALETTE.orangeDeep
      ctx.lineWidth = 1
      ctx.stroke()
    }
  } else {
    // Normal AI Turbos (0 to 3)
    const max = config.maxTurbos
    if (max === 0) {
      setCanvasFont(ctx, 700, 8.5, fonts.mono)
      ctx.fillStyle = withAlpha(PALETTE.slate, 0.6)
      ctx.fillText('NONE', x, y + 7)
      return
    }

    const cellW = 16
    const cellH = 7
    const gap = 4
    const totalW = max * cellW + (max - 1) * gap
    const startX = x - totalW

    for (let i = 0; i < max; i += 1) {
      const cx = startX + i * (cellW + gap)
      roundRectPath(ctx, cx, y, cellW, cellH, 1.5)
      if (i < state.ai.turbosLeft) {
        ctx.fillStyle = state.ai.isTurbo ? '#fffdf9' : PALETTE.orange
        ctx.fill()
        ctx.strokeStyle = PALETTE.orangeDeep
      } else {
        ctx.fillStyle = withAlpha(PALETTE.sand, 0.5)
        ctx.fill()
        ctx.strokeStyle = PALETTE.line
      }
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

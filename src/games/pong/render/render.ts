import type { GameViewport } from '../../runtime/types'
import type { PongEngine } from '../engine/engine'
import { ARENA } from '../engine/config'
import { drawPongCandy } from './candy'
import { PALETTE, withAlpha } from '../../../theme/palette'
import type { PongFonts, PongFx } from './types'
import { createFx, captureFx, advanceFx, drawFx } from './draw-fx'
import { drawArenaGrid, drawArenaBackdrop, drawArenaCenterElements } from './draw-arena'
import {
  drawPaddle,
  drawBall,
  drawGlassWall,
  drawMagnetPrompt,
  drawNotifications,
  paddleWidth,
} from './draw-paddle'
import { drawPowerupTimers } from './draw-powerups'
import { drawConfig, drawLoadout } from './draw-menus'

export { createFx, captureFx, advanceFx }
export type { PongFx, PongFonts }

const FALLBACK_SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const FALLBACK_MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

export function fontsFor(canvas: HTMLCanvasElement): PongFonts {
  const styles = getComputedStyle(canvas)
  return {
    sans: styles.getPropertyValue('--nx-font-sans').trim() || FALLBACK_SANS,
    mono: styles.getPropertyValue('--nx-font-mono').trim() || FALLBACK_MONO,
  }
}

export interface PongFrameInput {
  readonly context: CanvasRenderingContext2D
  readonly engine: PongEngine
  readonly viewport: GameViewport
  readonly time: number
  readonly fonts: PongFonts
  readonly fx: PongFx
}

export function drawFrame({ context: ctx, engine, viewport, time, fonts, fx }: PongFrameInput): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const background = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height)
  background.addColorStop(0, '#fffdf9')
  background.addColorStop(0.52, '#faf7f2')
  background.addColorStop(1, '#f1e9dc')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  const sweep = (Math.sin(time * 0.45) + 1) / 2
  const ambient = ctx.createRadialGradient(
    ctx.canvas.width * (0.2 + sweep * 0.6),
    ctx.canvas.height * 0.45,
    0,
    ctx.canvas.width * (0.2 + sweep * 0.6),
    ctx.canvas.height * 0.45,
    ctx.canvas.width * 0.65,
  )
  ambient.addColorStop(0, withAlpha(PALETTE.orangeBright, 0.08))
  ambient.addColorStop(1, withAlpha(PALETTE.paper, 0))
  ctx.fillStyle = ambient
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  const scale = Math.min(viewport.width / ARENA.width, viewport.height / ARENA.height)
  const offsetX = (viewport.width - ARENA.width * scale) / 2
  const offsetY = (viewport.height - ARENA.height * scale) / 2
  ctx.setTransform(
    viewport.dpr * scale,
    0,
    0,
    viewport.dpr * scale,
    viewport.dpr * offsetX,
    viewport.dpr * offsetY,
  )

  if (engine.state.phase === 'config') {
    drawConfig(ctx, engine, fonts)
  } else if (engine.state.phase === 'loadout') {
    drawLoadout(ctx, engine, fonts)
  } else if (engine.state.phase === 'playing' || engine.state.phase === 'over') {
    drawArena(ctx, engine, time, fonts, fx)
  } else {
    drawArenaBackdrop(ctx, time, fonts)
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function drawArena(
  ctx: CanvasRenderingContext2D,
  engine: PongEngine,
  time: number,
  fonts: PongFonts,
  fx: PongFx,
): void {
  drawArenaGrid(ctx, time)
  drawPowerupTimers(ctx, engine, time)
  drawArenaCenterElements(ctx, time)
  drawFx(ctx, fx)

  for (const candy of engine.state.candy) {
    if (candy.active) drawPongCandy(ctx, candy.x, candy.y, time)
  }

  const playerWidth = paddleWidth(engine.state.player)
  const aiWidth = paddleWidth(engine.state.ai)
  drawPaddle(
    ctx,
    engine.state.player.x,
    engine.state.player.y,
    playerWidth,
    engine.state.player.h,
    PALETTE.blue,
    PALETTE.blueDeep,
    time,
  )
  drawPaddle(
    ctx,
    engine.state.ai.x,
    engine.state.ai.y,
    aiWidth,
    engine.state.ai.h,
    PALETTE.orange,
    PALETTE.orangeDeep,
    time + 1,
  )

  if (engine.state.playerGlassWallActive) {
    drawGlassWall(ctx, engine.state.player.y, engine.state.playerGlassWallTimeRemaining, time)
  }

  drawBall(ctx, engine.state.ball.x, engine.state.ball.y, engine.state.ball.radius, time)
  if (engine.state.ball.stuckToPlayer) {
    drawMagnetPrompt(ctx, engine.state.ball.x, engine.state.ball.y, time, fonts)
  }
  drawNotifications(ctx, engine.state, fonts)
}

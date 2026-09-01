import type { GameViewport } from '../../runtime/types'
import type { TronEngine } from '../engine/engine'
import { applyArenaTransform } from './layout'
import { drawArena } from './draw-arena'
import { drawCycleTrails } from './draw-trails'
import { drawCycles } from './draw-cycles'
import { drawParticles } from './draw-particles'
import { drawHud } from './draw-hud'
import {
  drawMainMenu,
  drawIntermission,
  drawRoundOverlay,
  drawGameOverOrVictory,
} from './draw-menus'
import type { TronFonts } from './types'
import { PALETTE } from '../../../theme/palette'

export interface TronFrameInput {
  readonly context: CanvasRenderingContext2D
  readonly engine: TronEngine
  readonly viewport: GameViewport
  readonly time: number
  readonly fonts: TronFonts
}

export function drawFrame({ context: ctx, engine, viewport, time, fonts }: TronFrameInput): void {
  // 1. Reset canvas transform & fill backing canvas with page paper color
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = PALETTE.paper
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // 2. Set viewport DPR-scaled transform centered in arena bounds
  applyArenaTransform(ctx, viewport)

  // 3. Render Arena Floor & Grid
  drawArena(ctx, time, fonts)

  // 4. Render Light Trails
  drawCycleTrails(ctx, engine.state.p1, engine.state.ai, time)

  // 5. Render Cycle Vehicles / Shattered Tips / Smoke
  drawCycles(ctx, engine.state.p1, engine.state.ai, time)

  // 6. Render Dynamic Particles
  drawParticles(ctx, engine.state.particles)

  // 7. Render In-Game HUD Overlay
  drawHud(ctx, engine.state, time, fonts)

  // 8. Render Game Phase Overlays
  ctx.save()
  const scale = 1.18
  const cx = 480 / 2 // ARENA.width / 2
  const cy = 640 / 2 // ARENA.height / 2
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  if (engine.state.phase === 'menu') {
    drawMainMenu(ctx, fonts)
  } else if (engine.state.phase === 'intermission') {
    drawIntermission(ctx, engine, fonts)
  } else if (engine.state.phase === 'countdown' || engine.state.phase === 'round_over') {
    drawRoundOverlay(ctx, engine, fonts)
  } else if (engine.state.phase === 'victory' || engine.state.phase === 'game_over') {
    drawGameOverOrVictory(ctx, engine, fonts)
  }
  ctx.restore()

  // 9. Reset transform
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

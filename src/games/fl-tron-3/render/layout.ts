import { ARENA } from '../engine/config'
import type { GameViewport } from '../../runtime/types'

export interface ArenaTransform {
  readonly scale: number
  readonly offsetX: number
  readonly offsetY: number
}

export function computeArenaTransform(viewport: GameViewport): ArenaTransform {
  const scale = Math.min(viewport.width / ARENA.width, viewport.height / ARENA.height)
  const offsetX = (viewport.width - ARENA.width * scale) / 2
  const offsetY = (viewport.height - ARENA.height * scale) / 2
  return { scale, offsetX, offsetY }
}

export function applyArenaTransform(ctx: CanvasRenderingContext2D, viewport: GameViewport): ArenaTransform {
  const transform = computeArenaTransform(viewport)
  ctx.setTransform(
    viewport.dpr * transform.scale,
    0,
    0,
    viewport.dpr * transform.scale,
    viewport.dpr * transform.offsetX,
    viewport.dpr * transform.offsetY,
  )
  return transform
}
